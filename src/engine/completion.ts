import { ARC_CONFIG } from './config';
import type { DayInstance, RoutineLog, WorkoutLog, Penalty, StudySession } from '../db/db';

export interface DayCompletionResult {
  studyPct: number;
  routinePct: number;
  workoutPct: number;
  recoveryPct: number;
  overallPct: number;
  isSuccessful: boolean;
  activeWeights: {
    study: number;
    routine: number;
    workout: number;
    recovery: number;
  };
  details: {
    totalStudyAssignedMin: number;
    totalStudyCompletedMin: number;
    totalRoutineItems: number;
    doneRoutineItems: number;
    totalExercises: number;
    doneExercises: number;
    isRestDay: boolean;
    totalPenalties: number;
    donePenalties: number;
  };
}

export function computeDayCompletion(
  dayInstance: DayInstance,
  studySessions: StudySession[],
  routineLogs: RoutineLog[],
  workoutLogs: WorkoutLog[],
  penalties: Penalty[],
  successThreshold: number = ARC_CONFIG.DEFAULT_SUCCESS_THRESHOLD
): DayCompletionResult {
  const snapshot = dayInstance.snapshot;

  // 1. Study completion
  let totalStudyAssignedMin = 0;
  let totalStudyCompletedMin = 0;

  // Map study sessions by subject
  const subjectCompletedSecMap = new Map<string, number>();
  for (const session of studySessions) {
    const cur = subjectCompletedSecMap.get(session.subjectId) || 0;
    subjectCompletedSecMap.set(session.subjectId, cur + session.actualSec);
  }

  const subjects = snapshot.subjects || [];
  for (const sub of subjects) {
    const targetMin = sub.targetMinutes || 0;
    totalStudyAssignedMin += targetMin;
    const completedSec = subjectCompletedSecMap.get(sub.id) || 0;
    const completedMin = completedSec / 60;
    // Cap at assigned for completion % calculation (over-study doesn't inflate %)
    totalStudyCompletedMin += Math.min(completedMin, targetMin);
  }

  const hasStudy = totalStudyAssignedMin > 0;
  const studyPct = hasStudy
    ? Math.min(100, Math.round((totalStudyCompletedMin / totalStudyAssignedMin) * 100))
    : 100;

  // 2. Routine completion
  const routineItems = snapshot.routine || [];
  const totalRoutineItems = routineItems.length;
  let doneRoutineItems = 0;
  const routineDoneMap = new Map<string, boolean>();
  for (const log of routineLogs) {
    if (log.done) {
      routineDoneMap.set(log.templateItemId, true);
    }
  }

  for (const item of routineItems) {
    if (routineDoneMap.get(item.id)) {
      doneRoutineItems++;
    }
  }

  const hasRoutine = totalRoutineItems > 0;
  const routinePct = hasRoutine
    ? Math.min(100, Math.round((doneRoutineItems / totalRoutineItems) * 100))
    : 100;

  // 3. Workout completion
  const workout = snapshot.workout || { isRest: true, name: 'Rest', exercises: [] };
  const isRestDay = workout.isRest || (workout.exercises || []).length === 0;
  const exercises = workout.exercises || [];
  const totalExercises = isRestDay ? 0 : exercises.length;
  let doneExercises = 0;

  if (!isRestDay) {
    const workoutDoneMap = new Map<string, boolean>();
    for (const log of workoutLogs) {
      if (log.done) {
        workoutDoneMap.set(log.exerciseId, true);
      }
    }
    for (const ex of exercises) {
      if (workoutDoneMap.get(ex.id)) {
        doneExercises++;
      }
    }
  }

  const hasWorkout = !isRestDay && totalExercises > 0;
  const workoutPct = hasWorkout
    ? Math.min(100, Math.round((doneExercises / totalExercises) * 100))
    : 100;

  // 4. Recovery / Assigned tasks completion
  const totalPenalties = penalties.length;
  let donePenalties = 0;
  for (const p of penalties) {
    if (p.status === 'done') {
      donePenalties++;
    }
  }
  const hasRecovery = totalPenalties > 0;
  const recoveryPct = hasRecovery
    ? Math.min(100, Math.round((donePenalties / totalPenalties) * 100))
    : 100;

  // Dynamic weight renormalization
  let weightSum = 0;
  if (hasStudy) weightSum += ARC_CONFIG.WEIGHTS.STUDY;
  if (hasRoutine) weightSum += ARC_CONFIG.WEIGHTS.ROUTINE;
  if (hasWorkout) weightSum += ARC_CONFIG.WEIGHTS.WORKOUT;
  if (hasRecovery) weightSum += ARC_CONFIG.WEIGHTS.RECOVERY;

  // If literally nothing was assigned (extreme edge case)
  if (weightSum === 0) {
    return {
      studyPct: 100,
      routinePct: 100,
      workoutPct: 100,
      recoveryPct: 100,
      overallPct: 100,
      isSuccessful: true,
      activeWeights: { study: 0, routine: 0, workout: 0, recovery: 0 },
      details: {
        totalStudyAssignedMin,
        totalStudyCompletedMin,
        totalRoutineItems,
        doneRoutineItems,
        totalExercises,
        doneExercises,
        isRestDay,
        totalPenalties,
        donePenalties,
      },
    };
  }

  const normalizedStudyWeight = hasStudy ? ARC_CONFIG.WEIGHTS.STUDY / weightSum : 0;
  const normalizedRoutineWeight = hasRoutine ? ARC_CONFIG.WEIGHTS.ROUTINE / weightSum : 0;
  const normalizedWorkoutWeight = hasWorkout ? ARC_CONFIG.WEIGHTS.WORKOUT / weightSum : 0;
  const normalizedRecoveryWeight = hasRecovery ? ARC_CONFIG.WEIGHTS.RECOVERY / weightSum : 0;

  const weightedOverall =
    (studyPct * normalizedStudyWeight) +
    (routinePct * normalizedRoutineWeight) +
    (workoutPct * normalizedWorkoutWeight) +
    (recoveryPct * normalizedRecoveryWeight);

  const overallPct = Math.min(100, Math.max(0, Math.round(weightedOverall)));
  const isSuccessful = overallPct >= successThreshold;

  return {
    studyPct,
    routinePct,
    workoutPct,
    recoveryPct,
    overallPct,
    isSuccessful,
    activeWeights: {
      study: normalizedStudyWeight,
      routine: normalizedRoutineWeight,
      workout: normalizedWorkoutWeight,
      recovery: normalizedRecoveryWeight,
    },
    details: {
      totalStudyAssignedMin,
      totalStudyCompletedMin,
      totalRoutineItems,
      doneRoutineItems,
      totalExercises,
      doneExercises,
      isRestDay,
      totalPenalties,
      donePenalties,
    },
  };
}
