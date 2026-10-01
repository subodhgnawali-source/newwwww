import { db, type DaySnapshotExercise, type PenaltyStatus } from '../db/db';
import { recomputeDay } from './recomputeDay';
import { ARC_CONFIG, calculateLevelFromXp } from '../engine/config';
import { calculateFocusSessionXp } from '../engine/xp';
import { replayStreakRecords } from '../engine/streak';

/**
 * Toggles or marks a routine item as done/undone.
 */
export async function toggleRoutineItem(
  seasonId: string,
  dayKey: string,
  templateItemId: string,
  titleSnapshot: string,
  done: boolean
): Promise<void> {
  const logId = `rout_${seasonId}_${dayKey}_${templateItemId}`;
  await db.routineLogs.put({
    id: logId,
    seasonId,
    dayKey,
    templateItemId,
    titleSnapshot,
    done,
    doneAt: done ? Date.now() : undefined,
  });

  await recomputeDay(seasonId, dayKey);
}

/**
 * Logs a completed focus session and awards XP with daily minute cap.
 */
export async function recordFocusSession(
  seasonId: string,
  dayKey: string,
  subjectId: string,
  plannedMin: number,
  actualSec: number,
  source: 'timer' | 'manual' = 'timer'
): Promise<string> {
  const sessionId = `focus_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();

  await db.transaction('rw', [db.studySessions, db.xpEvents], async () => {
    // Save session
    await db.studySessions.put({
      id: sessionId,
      seasonId,
      dayKey,
      subjectId,
      plannedMin,
      actualSec,
      startedAt: now - actualSec * 1000,
      endedAt: now,
      source,
    });

    // Calculate existing focus XP earned today to enforce daily cap
    const todayXp = await db.xpEvents.where({ seasonId, dayKey }).toArray();
    const currentFocusXp = todayXp
      .filter((e) => e.reason === 'focus_minutes')
      .reduce((sum, e) => sum + e.amount, 0);

    const xpCalc = calculateFocusSessionXp(actualSec, plannedMin, currentFocusXp);
    if (xpCalc.xpEarned > 0) {
      await db.xpEvents.put({
        id: `xp_focus_${sessionId}`,
        seasonId,
        dayKey,
        reason: 'focus_minutes',
        amount: xpCalc.xpEarned,
        refId: sessionId,
        dedupeKey: `focus_minutes__${sessionId}`,
        createdAt: now,
      });
    }
  });

  await recomputeDay(seasonId, dayKey);
  return sessionId;
}

/**
 * Toggles an exercise in today's workout as done/undone.
 */
export async function toggleExerciseLog(
  seasonId: string,
  dayKey: string,
  exerciseSnapshot: DaySnapshotExercise,
  done: boolean
): Promise<void> {
  const logId = `work_${seasonId}_${dayKey}_${exerciseSnapshot.id}`;
  await db.workoutLogs.put({
    id: logId,
    seasonId,
    dayKey,
    exerciseId: exerciseSnapshot.id,
    exerciseSnapshot,
    setsDone: done ? exerciseSnapshot.sets : 0,
    done,
  });

  await recomputeDay(seasonId, dayKey);
}

/**
 * Completes a workout session.
 */
export async function recordWorkoutSession(
  seasonId: string,
  dayKey: string,
  startedAt: number,
  endedAt: number,
  totalRestSec: number,
  completed: boolean = true
): Promise<void> {
  const sessionId = `worksession_${seasonId}_${dayKey}`;
  await db.workoutSessions.put({
    id: sessionId,
    seasonId,
    dayKey,
    startedAt,
    endedAt,
    totalRestSec,
    completed,
  });

  await recomputeDay(seasonId, dayKey);
}

/**
 * Toggles a recovery penalty task status between pending and done.
 */
export async function togglePenaltyTask(
  penaltyId: string,
  status: PenaltyStatus
): Promise<void> {
  const penalty = await db.penalties.get(penaltyId);
  if (!penalty) return;

  penalty.status = status;
  penalty.completedAt = status === 'done' ? Date.now() : undefined;
  await db.penalties.put(penalty);

  await recomputeDay(penalty.seasonId, penalty.assignedDayKey);
}

/**
 * Updates a subject's syllabus backlog status with audit history.
 */
export async function updateBacklogStatus(
  subjectId: string,
  newStatus: 'up_to_date' | 'pending',
  note: string = ''
): Promise<void> {
  const now = Date.now();
  let existing = await db.backlog.where('subjectId').equals(subjectId).first();
  const fromStatus = existing ? existing.status : 'pending';

  if (!existing) {
    existing = {
      id: `backlog_${subjectId}`,
      subjectId,
      status: newStatus,
      note,
      updatedAt: now,
    };
  } else {
    existing.status = newStatus;
    existing.note = note;
    existing.updatedAt = now;
  }

  await db.backlog.put(existing);

  // Log history
  await db.backlogHistory.put({
    id: `bh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    backlogId: existing.id,
    subjectId,
    fromStatus,
    toStatus: newStatus,
    note,
    timestamp: now,
  });

  // Award XP if backlog was cleared (pending -> up_to_date)
  const activeSeason = await db.seasons.where('status').equals('active').first();
  if (activeSeason && fromStatus === 'pending' && newStatus === 'up_to_date') {
    const todayKey = new Date().toISOString().slice(0, 10);
    await db.xpEvents.put({
      id: `xp_backlog_${subjectId}_${now}`,
      seasonId: activeSeason.id,
      dayKey: todayKey,
      reason: 'backlog_cleared',
      amount: ARC_CONFIG.XP.BACKLOG_CLEARED,
      refId: `${subjectId}_${now}`,
      dedupeKey: `backlog_cleared__${subjectId}_${now}`,
      createdAt: now,
    });
    await recomputeDay(activeSeason.id, todayKey);
  }
}

/**
 * REBUILD ALL: Recalculates all derived records, streaks, XP totals, and achievements
 * by replaying from raw facts. Available via Settings -> "Verify & Rebuild Stats".
 */
export async function rebuildAll(): Promise<{
  success: boolean;
  totalRecordsRebuilt: number;
  currentStreak: number;
  totalXp: number;
  level: number;
}> {
  const activeSeason = await db.seasons.where('status').equals('active').first();
  if (!activeSeason) {
    return { success: false, totalRecordsRebuilt: 0, currentStreak: 0, totalXp: 0, level: 1 };
  }

  // Fetch all day instances
  const dayInstances = await db.dayInstances
    .where('seasonId')
    .equals(activeSeason.id)
    .toArray();

  const sortedDays = dayInstances.sort((a, b) => a.dayKey.localeCompare(b.dayKey));

  for (const instance of sortedDays) {
    const isPast = instance.status === 'finalized';
    await recomputeDay(activeSeason.id, instance.dayKey, { finalize: isPast });
  }

  // Re-read daily records
  const allRecords = await db.dailyRecords.where('seasonId').equals(activeSeason.id).toArray();
  const streakStats = replayStreakRecords(allRecords);

  const allXp = await db.xpEvents.where('seasonId').equals(activeSeason.id).toArray();
  const totalXp = allXp.reduce((s, e) => s + e.amount, 0);
  const lvlInfo = calculateLevelFromXp(totalXp);

  return {
    success: true,
    totalRecordsRebuilt: sortedDays.length,
    currentStreak: streakStats.currentStreak,
    totalXp,
    level: lvlInfo.level,
  };
}
