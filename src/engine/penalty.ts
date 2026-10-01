import { ARC_CONFIG } from './config';
import type { DayInstance, StudySession, RoutineLog, WorkoutLog, Penalty } from '../db/db';
import { addDays, format, parseISO } from 'date-fns';

export interface UnmetTarget {
  requirementKey: string;
  type: 'study' | 'routine' | 'workout' | 'task';
  subjectId?: string;
  reason: string;
  missedAmount: number;
  calculatedPenaltyAmount: number;
  unit: string;
}

/**
 * Detects unmet targets on a past finalized day.
 */
export function detectUnmetTargets(
  dayInstance: DayInstance,
  studySessions: StudySession[],
  routineLogs: RoutineLog[],
  workoutLogs: WorkoutLog[]
): UnmetTarget[] {
  const unment: UnmetTarget[] = [];
  const snapshot = dayInstance.snapshot;

  // 1. Study shortfalls
  const studyMap = new Map<string, number>();
  for (const s of studySessions) {
    studyMap.set(s.subjectId, (studyMap.get(s.subjectId) || 0) + s.actualSec);
  }

  for (const sub of snapshot.subjects || []) {
    const targetMin = sub.targetMinutes || 0;
    if (targetMin <= 0) continue;

    const actualMin = Math.floor((studyMap.get(sub.id) || 0) / 60);
    const shortfall = targetMin - actualMin;
    if (shortfall > 0) {
      // 1.25x multiplier, rounded up to nearest 5 minutes
      const rawPenalty = shortfall * ARC_CONFIG.PENALTY.STUDY_INTEREST_MULTIPLIER;
      const penaltyAmount = Math.ceil(rawPenalty / ARC_CONFIG.PENALTY.STUDY_ROUND_UP_MINUTES) * ARC_CONFIG.PENALTY.STUDY_ROUND_UP_MINUTES;

      unment.push({
        requirementKey: `study_${sub.id}`,
        type: 'study',
        subjectId: sub.id,
        reason: `Missed ${shortfall}m of ${sub.name}`,
        missedAmount: shortfall,
        calculatedPenaltyAmount: penaltyAmount,
        unit: 'min',
      });
    }
  }

  // 2. Routine missed items
  const routineDoneMap = new Map<string, boolean>();
  for (const r of routineLogs) {
    if (r.done) routineDoneMap.set(r.templateItemId, true);
  }

  for (const item of snapshot.routine || []) {
    if (!routineDoneMap.get(item.id)) {
      unment.push({
        requirementKey: `routine_${item.id}`,
        type: 'routine',
        reason: `Missed routine: ${item.title}`,
        missedAmount: 1,
        calculatedPenaltyAmount: 1,
        unit: 'times',
      });
    }
  }

  // 3. Workout missed exercises (only if not a rest day)
  const workout = snapshot.workout;
  if (workout && !workout.isRest && (workout.exercises || []).length > 0) {
    const workoutDoneMap = new Map<string, boolean>();
    for (const w of workoutLogs) {
      if (w.done) workoutDoneMap.set(w.exerciseId, true);
    }

    for (const ex of workout.exercises) {
      if (!workoutDoneMap.get(ex.id)) {
        unment.push({
          requirementKey: `workout_${ex.id}`,
          type: 'workout',
          reason: `Missed exercise: ${ex.name}`,
          missedAmount: 1,
          calculatedPenaltyAmount: 1,
          unit: 'reps',
        });
      }
    }
  }

  return unment;
}

/**
 * Distributes unmet targets to upcoming days within the Arc respecting capacity caps:
 * - Max +60 min recovery study per day
 * - Max 3 recovery items per day
 * - Max 5 hours (300 min) total pending across the entire Arc
 * - Never assign past Day 60 (Arc end)
 * - Excess items or study minutes are marked 'expired' with a clear reason, never lost.
 */
export function schedulePenalties(
  seasonId: string,
  sourceDayKey: string,
  unmetTargets: UnmetTarget[],
  existingPenalties: Penalty[],
  seasonEndDate: string // YYYY-MM-DD
): Penalty[] {
  const newPenalties: Penalty[] = [];
  const existingKeys = new Set(existingPenalties.map((p) => p.dedupeKey));

  // Calculate current total pending minutes
  let currentTotalPendingMinutes = existingPenalties
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => (p.type === 'study' ? sum + p.penaltyAmount : sum + 10), 0);

  // Group pending penalties by assignedDayKey to check daily capacity
  const dayStudyMinutesMap = new Map<string, number>();
  const dayItemCountMap = new Map<string, number>();

  for (const p of existingPenalties) {
    if (p.status === 'pending') {
      const day = p.assignedDayKey;
      dayItemCountMap.set(day, (dayItemCountMap.get(day) || 0) + 1);
      if (p.type === 'study') {
        dayStudyMinutesMap.set(day, (dayStudyMinutesMap.get(day) || 0) + p.penaltyAmount);
      }
    }
  }

  const sourceDate = parseISO(sourceDayKey);
  const seasonEnd = parseISO(seasonEndDate);

  for (const target of unmetTargets) {
    const dedupeKey = `${sourceDayKey}__${target.requirementKey}`;
    // Idempotency: skip if already generated for this source day + requirement
    if (existingKeys.has(dedupeKey)) continue;

    // Check total backlog cap (5 hours = 300 minutes)
    const taskMinutes = target.type === 'study' ? target.calculatedPenaltyAmount : 10;
    if (currentTotalPendingMinutes + taskMinutes > ARC_CONFIG.PENALTY.MAX_PENDING_HOURS_TOTAL * 60) {
      newPenalties.push({
        id: `pen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        seasonId,
        sourceDayKey,
        requirementKey: target.requirementKey,
        dedupeKey,
        type: target.type,
        subjectId: target.subjectId,
        reason: `${target.reason} (Forgiven: Arc penalty ceiling of 5 hours exceeded)`,
        missedAmount: target.missedAmount,
        penaltyAmount: target.calculatedPenaltyAmount,
        unit: target.unit,
        assignedDayKey: sourceDayKey,
        status: 'expired',
        createdAt: Date.now(),
      });
      continue;
    }

    // Find next day with capacity, up to seasonEndDate
    let assignedDate: Date | null = null;
    let lookAheadDays = 1;

    while (lookAheadDays <= 30) {
      const candidateDate = addDays(sourceDate, lookAheadDays);
      if (candidateDate > seasonEnd) {
        // Beyond Arc end
        break;
      }
      const candidateKey = format(candidateDate, 'yyyy-MM-dd');
      const curCount = dayItemCountMap.get(candidateKey) || 0;
      const curStudy = dayStudyMinutesMap.get(candidateKey) || 0;

      const hasItemCapacity = curCount < ARC_CONFIG.PENALTY.MAX_RECOVERY_ITEMS_PER_DAY;
      const hasStudyCapacity =
        target.type !== 'study' ||
        curStudy + target.calculatedPenaltyAmount <= ARC_CONFIG.PENALTY.MAX_RECOVERY_STUDY_MIN_PER_DAY;

      if (hasItemCapacity && hasStudyCapacity) {
        assignedDate = candidateDate;
        // Reserve capacity
        dayItemCountMap.set(candidateKey, curCount + 1);
        if (target.type === 'study') {
          dayStudyMinutesMap.set(candidateKey, curStudy + target.calculatedPenaltyAmount);
        }
        break;
      }
      lookAheadDays++;
    }

    if (assignedDate) {
      const assignedDayKey = format(assignedDate, 'yyyy-MM-dd');
      newPenalties.push({
        id: `pen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        seasonId,
        sourceDayKey,
        requirementKey: target.requirementKey,
        dedupeKey,
        type: target.type,
        subjectId: target.subjectId,
        reason: target.reason,
        missedAmount: target.missedAmount,
        penaltyAmount: target.calculatedPenaltyAmount,
        unit: target.unit,
        assignedDayKey,
        status: 'pending',
        createdAt: Date.now(),
      });
      currentTotalPendingMinutes += taskMinutes;
      existingKeys.add(dedupeKey);
    } else {
      // Couldn't fit before Arc end or all future slots at maximum capacity
      newPenalties.push({
        id: `pen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        seasonId,
        sourceDayKey,
        requirementKey: target.requirementKey,
        dedupeKey,
        type: target.type,
        subjectId: target.subjectId,
        reason: `${target.reason} (Expired: capacity full or Arc concluding)`,
        missedAmount: target.missedAmount,
        penaltyAmount: target.calculatedPenaltyAmount,
        unit: target.unit,
        assignedDayKey: sourceDayKey,
        status: 'expired',
        createdAt: Date.now(),
      });
      existingKeys.add(dedupeKey);
    }
  }

  return newPenalties;
}
