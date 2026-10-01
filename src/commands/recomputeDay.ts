import { db, type DailyRecord, type DayState } from '../db/db';
import { computeDayCompletion } from '../engine/completion';
import { ARC_CONFIG, calculateLevelFromXp } from '../engine/config';
import { replayStreakRecords } from '../engine/streak';
import { calculateAvailableShields, evaluateShieldProtection, isStreakMilestone } from '../engine/shields';
import { ACHIEVEMENTS, type AchievementEvaluationContext } from '../engine/achievements';
import { detectUnmetTargets, schedulePenalties } from '../engine/penalty';

export interface RecomputeOptions {
  finalize?: boolean;
}

/**
 * Recomputes completion, XP, streaks, shields, penalties, and achievements
 * for a day inside a single transactional context. Idempotent and deterministic.
 */
export async function recomputeDay(
  seasonId: string,
  dayKey: string,
  options: RecomputeOptions = {}
): Promise<void> {
  const profile = await db.profile.get('default');
  const season = await db.seasons.get(seasonId);
  if (!season) return;

  const threshold = profile?.settings.successThreshold ?? ARC_CONFIG.DEFAULT_SUCCESS_THRESHOLD;

  // Run in a Dexie transaction across all relevant tables
  await db.transaction('rw', [
    db.dayInstances,
    db.dailyRecords,
    db.studySessions,
    db.routineLogs,
    db.workoutLogs,
    db.workoutSessions,
    db.penalties,
    db.xpEvents,
    db.shieldEvents,
    db.achievementsUnlocked,
    db.backlog,
  ], async () => {
    const dayInstance = await db.dayInstances.get([seasonId, dayKey]);
    if (!dayInstance) return;

    // 1. Fetch all raw facts for this day
    const studySessions = await db.studySessions.where({ seasonId, dayKey }).toArray();
    const routineLogs = await db.routineLogs.where({ seasonId, dayKey }).toArray();
    const workoutLogs = await db.workoutLogs.where({ seasonId, dayKey }).toArray();
    const penalties = await db.penalties.where({ seasonId, assignedDayKey: dayKey }).toArray();

    // 2. Compute completion
    const completion = computeDayCompletion(
      dayInstance,
      studySessions,
      routineLogs,
      workoutLogs,
      penalties,
      threshold
    );

    // 3. XP Engine re-sync for this day
    // We clean up existing XP events for routine, workout, target, and recovery for this day
    // and re-materialize them deterministically.
    const existingDayXpEvents = await db.xpEvents.where({ seasonId, dayKey }).toArray();
    const toDeleteIds: string[] = [];

    // Keep focus session XP events intact (they were logged with actual durations),
    // but recompute routine, workout, target, recovery XP events
    for (const ev of existingDayXpEvents) {
      if (['routine_item', 'all_routine_done', 'exercise_done', 'full_workout_done', 'target_met', 'recovery_done', 'day_success'].includes(ev.reason)) {
        toDeleteIds.push(ev.id);
      }
    }
    if (toDeleteIds.length > 0) {
      await db.xpEvents.bulkDelete(toDeleteIds);
    }

    const newXpEvents: any[] = [];
    const now = Date.now();

    // Routine items XP
    const doneRoutineCount = routineLogs.filter((r) => r.done).length;
    for (const r of routineLogs) {
      if (r.done) {
        newXpEvents.push({
          id: `xp_${seasonId}_${dayKey}_rout_${r.templateItemId}`,
          seasonId,
          dayKey,
          reason: 'routine_item',
          amount: ARC_CONFIG.XP.ROUTINE_ITEM_DONE,
          refId: r.templateItemId,
          dedupeKey: `routine_item__${r.templateItemId}`,
          createdAt: now,
        });
      }
    }
    if (doneRoutineCount > 0 && doneRoutineCount === (dayInstance.snapshot.routine || []).length) {
      newXpEvents.push({
        id: `xp_${seasonId}_${dayKey}_all_routine`,
        seasonId,
        dayKey,
        reason: 'all_routine_done',
        amount: ARC_CONFIG.XP.ALL_ROUTINE_DONE_BONUS,
        refId: dayKey,
        dedupeKey: `all_routine_done__${dayKey}`,
        createdAt: now,
      });
    }

    // Workout exercises XP
    const workout = dayInstance.snapshot.workout;
    const isRest = workout?.isRest || (workout?.exercises || []).length === 0;
    if (!isRest) {
      const doneExerciseCount = workoutLogs.filter((w) => w.done).length;
      for (const w of workoutLogs) {
        if (w.done) {
          newXpEvents.push({
            id: `xp_${seasonId}_${dayKey}_ex_${w.exerciseId}`,
            seasonId,
            dayKey,
            reason: 'exercise_done',
            amount: ARC_CONFIG.XP.EXERCISE_DONE,
            refId: w.exerciseId,
            dedupeKey: `exercise_done__${w.exerciseId}`,
            createdAt: now,
          });
        }
      }
      if (doneExerciseCount > 0 && doneExerciseCount === (workout?.exercises || []).length) {
        newXpEvents.push({
          id: `xp_${seasonId}_${dayKey}_full_workout`,
          seasonId,
          dayKey,
          reason: 'full_workout_done',
          amount: ARC_CONFIG.XP.FULL_WORKOUT_DONE_BONUS,
          refId: dayKey,
          dedupeKey: `full_workout_done__${dayKey}`,
          createdAt: now,
        });
      }
    }

    // Subject targets met XP
    const subjectSecMap = new Map<string, number>();
    for (const s of studySessions) {
      subjectSecMap.set(s.subjectId, (subjectSecMap.get(s.subjectId) || 0) + s.actualSec);
    }
    for (const sub of dayInstance.snapshot.subjects || []) {
      const targetMin = sub.targetMinutes || 0;
      if (targetMin > 0) {
        const actualMin = (subjectSecMap.get(sub.id) || 0) / 60;
        if (actualMin >= targetMin) {
          newXpEvents.push({
            id: `xp_${seasonId}_${dayKey}_target_${sub.id}`,
            seasonId,
            dayKey,
            reason: 'target_met',
            amount: ARC_CONFIG.XP.SUBJECT_TARGET_MET,
            refId: sub.id,
            dedupeKey: `target_met__${sub.id}`,
            createdAt: now,
          });
        }
      }
    }

    // Recovery tasks done XP
    for (const p of penalties) {
      if (p.status === 'done') {
        newXpEvents.push({
          id: `xp_${seasonId}_${dayKey}_rec_${p.id}`,
          seasonId,
          dayKey,
          reason: 'recovery_done',
          amount: ARC_CONFIG.XP.RECOVERY_TASK_DONE,
          refId: p.id,
          dedupeKey: `recovery_done__${p.id}`,
          createdAt: now,
        });
      }
    }

    if (newXpEvents.length > 0) {
      await db.xpEvents.bulkPut(newXpEvents);
    }

    // 4. Finalization or live day status handling
    const isFinalizing = options.finalize || dayInstance.status === 'finalized';
    let dayState: DayState = 'current';
    let shieldUsed = false;

    if (isFinalizing) {
      // Evaluate shield protection
      const shieldEvents = await db.shieldEvents.toArray();
      const availableShields = calculateAvailableShields(shieldEvents);

      if (completion.isSuccessful) {
        dayState = 'completed';
      } else {
        const shieldEval = evaluateShieldProtection(
          dayInstance.arcDay,
          completion.overallPct,
          threshold,
          availableShields
        );

        if (shieldEval.shouldProtect) {
          dayState = 'protected';
          shieldUsed = true;
          // Log shield consumption event
          await db.shieldEvents.put({
            id: `shield_used_${seasonId}_${dayKey}`,
            seasonId,
            dayKey,
            type: 'used',
            reason: shieldEval.reason || `Protected Day ${dayInstance.arcDay}`,
            createdAt: now,
          });
        } else if (completion.overallPct > 0) {
          dayState = 'incomplete';
        } else {
          dayState = 'missed';
        }
      }

      // Schedule unmet target penalties if not successful and finalized
      if (!completion.isSuccessful && dayState !== 'protected') {
        const unmetTargets = detectUnmetTargets(
          dayInstance,
          studySessions,
          routineLogs,
          workoutLogs
        );
        if (unmetTargets.length > 0) {
          const allPenalties = await db.penalties.where('seasonId').equals(seasonId).toArray();
          const scheduled = schedulePenalties(
            seasonId,
            dayKey,
            unmetTargets,
            allPenalties,
            season.endDate
          );
          if (scheduled.length > 0) {
            await db.penalties.bulkPut(scheduled);
          }
        }
      }

      // Fetch all daily records to compute streak after this day
      const existingRecords = await db.dailyRecords.where('seasonId').equals(seasonId).toArray();
      // Replace or add current record
      const otherRecords = existingRecords.filter((r) => r.dayKey !== dayKey);
      const streakStatsBefore = replayStreakRecords(otherRecords);

      let streakAfter = streakStatsBefore.currentStreak;
      if (dayState === 'completed') {
        streakAfter = streakStatsBefore.currentStreak + 1;
        // Check 7-day milestone for shield reward
        if (isStreakMilestone(streakAfter)) {
          await db.shieldEvents.put({
            id: `shield_earn_streak_${seasonId}_${streakAfter}`,
            seasonId,
            dayKey,
            type: 'earned',
            reason: `Reached ${streakAfter}-day streak milestone!`,
            createdAt: now,
          });
        }
      } else if (dayState === 'protected') {
        streakAfter = streakStatsBefore.currentStreak; // Unchanged
      } else {
        streakAfter = 0; // Reset
      }

      // Calculate total XP earned on this day
      const allDayXp = await db.xpEvents.where({ seasonId, dayKey }).toArray();
      let dayTotalXp = allDayXp.reduce((sum, e) => sum + e.amount, 0);

      // Add success bonus if completed
      if (dayState === 'completed') {
        const streakBonus = Math.min(streakAfter, ARC_CONFIG.XP.MAX_STREAK_BONUS);
        const successBonus = ARC_CONFIG.XP.SUCCESSFUL_DAY_BONUS + streakBonus;
        await db.xpEvents.put({
          id: `xp_${seasonId}_${dayKey}_success`,
          seasonId,
          dayKey,
          reason: 'day_success',
          amount: successBonus,
          refId: dayKey,
          dedupeKey: `day_success__${dayKey}`,
          createdAt: now,
        });
        dayTotalXp += successBonus;
      }

      const generatedPenalties = await db.penalties.where({ seasonId, sourceDayKey: dayKey }).count();
      const completedPenalties = penalties.filter((p) => p.status === 'done').length;

      const dailyRecord: DailyRecord = {
        seasonId,
        dayKey,
        compositeKey: `${seasonId}__${dayKey}`,
        studyPct: completion.studyPct,
        routinePct: completion.routinePct,
        workoutPct: completion.workoutPct,
        taskPct: completion.recoveryPct,
        overallPct: completion.overallPct,
        state: dayState,
        xpEarned: dayTotalXp,
        penaltiesGenerated: generatedPenalties,
        penaltiesCompleted: completedPenalties,
        shieldUsed,
        streakAfter,
        finalizedAt: dayInstance.finalizedAt || now,
      };

      await db.dailyRecords.put(dailyRecord);

      // Mark dayInstance as finalized
      dayInstance.status = 'finalized';
      dayInstance.finalizedAt = dayInstance.finalizedAt || now;
      await db.dayInstances.put(dayInstance);
    }

    // 5. Evaluate Achievements
    const allRecords = await db.dailyRecords.where('seasonId').equals(seasonId).toArray();
    const streakStats = replayStreakRecords(allRecords);
    const allXpEvents = await db.xpEvents.where('seasonId').equals(seasonId).toArray();
    const totalXp = allXpEvents.reduce((s, e) => s + e.amount, 0);
    const levelInfo = calculateLevelFromXp(totalXp);

    const allStudy = await db.studySessions.where('seasonId').equals(seasonId).toArray();
    const allWorkouts = await db.workoutSessions.where('seasonId').equals(seasonId).toArray();
    const allRoutines = await db.routineLogs.where('seasonId').equals(seasonId).toArray();
    const allBacklog = await db.backlog.toArray();
    const allPens = await db.penalties.where('seasonId').equals(seasonId).toArray();
    const allShieldEvents = await db.shieldEvents.where('seasonId').equals(seasonId).toArray();
    const shieldsUsedTotal = allShieldEvents.filter((e) => e.type === 'used').length;

    const achContext: AchievementEvaluationContext = {
      arcDay: dayInstance.arcDay,
      dailyRecords: allRecords,
      allStudySessions: allStudy,
      allWorkoutSessions: allWorkouts,
      allRoutineLogs: allRoutines,
      allBacklog: allBacklog,
      allPenalties: allPens,
      currentStreak: streakStats.currentStreak,
      longestStreak: streakStats.longestStreak,
      totalXp,
      currentLevel: levelInfo.level,
      shieldsUsedTotal,
      todayKey: dayKey,
    };

    const unlocked = await db.achievementsUnlocked.where('seasonId').equals(seasonId).toArray();
    const unlockedIds = new Set(unlocked.map((a) => a.id));

    for (const ach of ACHIEVEMENTS) {
      if (!unlockedIds.has(ach.id)) {
        if (ach.evaluate(achContext)) {
          await db.achievementsUnlocked.put({
            id: ach.id,
            seasonId,
            unlockedAt: now,
            context: `Unlocked on Day ${dayInstance.arcDay}`,
          });
        }
      }
    }
  });
}
