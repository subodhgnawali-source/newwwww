import { db, type DayInstance, type DaySnapshot, type Season } from '../db/db';
import { computeArcDayNumber } from '../engine/arc';
import { parseISO, getDay } from 'date-fns';

/**
 * Ensures a day instance is materialized for the given dayKey.
 * If already materialized, returns the existing instance.
 * Past day snapshots remain untouched and immutable.
 */
export async function getOrMaterializeDayInstance(
  season: Season,
  dayKey: string
): Promise<DayInstance> {
  const existing = await db.dayInstances.get([season.id, dayKey]);
  if (existing) {
    return existing;
  }

  const arcDay = computeArcDayNumber(season.startDate, parseISO(dayKey));
  const targetDate = parseISO(dayKey);
  const weekday = getDay(targetDate); // 0 (Sun) - 6 (Sat)

  // 1. Fetch active subjects & their target minutes for this weekday
  const activeSubjects = await db.subjects
    .where('seasonId')
    .equals(season.id)
    .filter((s) => !s.archived)
    .sortBy('order');

  const targets = await db.studyTargets.toArray();
  const targetMap = new Map<string, number>();
  for (const t of targets) {
    if (t.weekday === weekday) {
      targetMap.set(t.subjectId, t.minutes);
    }
  }

  const snapshotSubjects = activeSubjects.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    targetMinutes: targetMap.get(s.id) || 0,
  }));

  // 2. Fetch routine templates for this weekday (or all-day if weekday === -1)
  const routineTemplates = await db.routineTemplates
    .filter((r) => r.weekday === weekday || r.weekday === -1)
    .sortBy('order');

  const snapshotRoutine = routineTemplates.map((r) => ({
    id: r.id,
    title: r.title,
    startTime: r.startTime,
    durationMin: r.durationMin,
    category: r.category,
    order: r.order,
  }));

  // 3. Fetch workout template for this weekday
  const workoutTemplate = await db.workoutTemplates.where('weekday').equals(weekday).first();
  let snapshotWorkout = {
    isRest: true,
    name: 'Rest Day',
    exercises: [] as any[],
  };

  if (workoutTemplate) {
    if (workoutTemplate.isRest) {
      snapshotWorkout = {
        isRest: true,
        name: workoutTemplate.name || 'Rest Day',
        exercises: [],
      };
    } else {
      const exercises = await db.exerciseTemplates
        .where('workoutTemplateId')
        .equals(workoutTemplate.id)
        .sortBy('order');

      snapshotWorkout = {
        isRest: false,
        name: workoutTemplate.name,
        exercises: exercises.map((e) => ({
          id: e.id,
          name: e.name,
          sets: e.sets,
          reps: e.reps,
          durationSec: e.durationSec,
          restSec: e.restSec,
          order: e.order,
        })),
      };
    }
  }

  const snapshot: DaySnapshot = {
    subjects: snapshotSubjects,
    routine: snapshotRoutine,
    workout: snapshotWorkout,
  };

  const newInstance: DayInstance = {
    seasonId: season.id,
    dayKey,
    arcDay,
    status: 'active',
    snapshot,
  };

  await db.dayInstances.put(newInstance);
  return newInstance;
}

/**
 * Re-materializes today's snapshot from current templates when the user
 * explicitly chooses "Apply changes to today too".
 */
export async function updateTodaySnapshotFromTemplates(
  season: Season,
  todayKey: string
): Promise<void> {
  const instance = await db.dayInstances.get([season.id, todayKey]);
  if (!instance || instance.status === 'finalized') return;

  // Delete existing instance so getOrMaterialize creates a fresh snapshot from current templates
  await db.dayInstances.where({ seasonId: season.id, dayKey: todayKey }).delete();
  await getOrMaterializeDayInstance(season, todayKey);
}
