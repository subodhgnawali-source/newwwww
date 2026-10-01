import Dexie, { type Table } from 'dexie';

export interface UserProfile {
  id: string; // 'default'
  name: string;
  createdAt: number;
  timezone: string;
  settings: {
    successThreshold: number; // e.g. 80
    focusMin: number;
    breakMin: number;
    longBreakMin: number;
    reducedMotion: boolean;
    weekStart: number; // 0 for Sunday, 1 for Monday
    soundEnabled: boolean;
  };
}

export type SeasonStatus = 'active' | 'completed' | 'abandoned';

export interface SeasonSummary {
  totalFocusHours: number;
  bestSubject: string;
  longestStreak: number;
  totalXp: number;
  finalLevel: number;
  workoutsCompleted: number;
  perfectDays: number;
  successfulDays: number;
  overallSuccessRate: number;
  completedAt: string;
}

export interface Season {
  id: string;
  number: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: SeasonStatus;
  summary?: SeasonSummary;
}

export interface Subject {
  id: string;
  seasonId: string;
  name: string;
  color: string;
  order: number;
  archived: boolean;
}

export interface StudyTarget {
  id: string;
  subjectId: string;
  weekday: number; // 0 (Sun) - 6 (Sat)
  minutes: number;
}

export type DayState = 'future' | 'current' | 'completed' | 'incomplete' | 'missed' | 'protected';

export interface DaySnapshotSubject {
  id: string;
  name: string;
  color: string;
  targetMinutes: number;
}

export interface DaySnapshotRoutineItem {
  id: string;
  title: string;
  startTime: string;
  durationMin: number;
  category: string;
  order: number;
}

export interface DaySnapshotExercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  durationSec?: number;
  restSec: number;
  order: number;
}

export interface DaySnapshotWorkout {
  isRest: boolean;
  name: string;
  exercises: DaySnapshotExercise[];
}

export interface DaySnapshot {
  subjects: DaySnapshotSubject[];
  routine: DaySnapshotRoutineItem[];
  workout: DaySnapshotWorkout;
}

export interface DayInstance {
  id?: string;
  dayKey: string; // YYYY-MM-DD
  seasonId: string;
  arcDay: number; // 1 to 60
  status: 'active' | 'finalized';
  snapshot: DaySnapshot;
  finalizedAt?: number;
}

export interface StudySession {
  id: string;
  seasonId: string;
  dayKey: string;
  subjectId: string;
  plannedMin: number;
  actualSec: number;
  startedAt: number;
  endedAt: number;
  source: 'timer' | 'manual';
}

export interface RoutineTemplate {
  id: string;
  weekday: number; // 0-6 (or -1 for all days if desired, but 0-6 allows custom daily splits)
  title: string;
  startTime: string; // HH:mm
  durationMin: number;
  category: 'morning' | 'study' | 'night' | 'health' | 'custom';
  order: number;
}

export interface RoutineLog {
  id: string;
  seasonId: string;
  dayKey: string;
  templateItemId: string;
  titleSnapshot: string;
  done: boolean;
  doneAt?: number;
}

export interface WorkoutTemplate {
  id: string;
  weekday: number; // 0-6
  isRest: boolean;
  name: string;
}

export interface ExerciseTemplate {
  id: string;
  workoutTemplateId: string;
  name: string;
  sets: number;
  reps: number;
  durationSec?: number;
  restSec: number;
  order: number;
}

export interface WorkoutLog {
  id: string;
  seasonId: string;
  dayKey: string;
  exerciseId: string;
  exerciseSnapshot: DaySnapshotExercise;
  setsDone: number;
  done: boolean;
}

export interface WorkoutSession {
  id: string;
  seasonId: string;
  dayKey: string;
  startedAt: number;
  endedAt: number;
  totalRestSec: number;
  completed: boolean;
}

export interface BacklogItem {
  id: string;
  subjectId: string;
  status: 'up_to_date' | 'pending';
  note: string;
  updatedAt: number;
}

export interface BacklogHistoryItem {
  id: string;
  backlogId: string;
  subjectId: string;
  fromStatus: 'up_to_date' | 'pending';
  toStatus: 'up_to_date' | 'pending';
  note: string;
  timestamp: number;
}

export type PenaltyType = 'study' | 'routine' | 'workout' | 'task';
export type PenaltyStatus = 'pending' | 'done' | 'expired';

export interface Penalty {
  id: string;
  seasonId: string;
  sourceDayKey: string;
  requirementKey: string;
  dedupeKey: string; // sourceDayKey + '__' + requirementKey
  type: PenaltyType;
  subjectId?: string;
  reason: string;
  missedAmount: number;
  penaltyAmount: number;
  unit: string; // 'min', 'reps', 'times'
  assignedDayKey: string;
  status: PenaltyStatus;
  createdAt: number;
  completedAt?: number;
}

export interface DailyRecord {
  seasonId: string;
  dayKey: string;
  compositeKey: string; // seasonId + '__' + dayKey
  studyPct: number;
  routinePct: number;
  workoutPct: number;
  taskPct: number;
  overallPct: number;
  state: DayState;
  xpEarned: number;
  penaltiesGenerated: number;
  penaltiesCompleted: number;
  shieldUsed: boolean;
  streakAfter: number;
  finalizedAt: number;
}

export interface XpEvent {
  id: string;
  seasonId: string;
  dayKey: string;
  reason: string;
  amount: number;
  refId: string;
  dedupeKey: string; // reason + '__' + refId
  createdAt: number;
}

export interface ShieldEvent {
  id: string;
  seasonId: string;
  dayKey: string;
  type: 'earned' | 'used';
  reason: string;
  createdAt: number;
}

export interface AchievementUnlocked {
  id: string; // achievement key
  seasonId: string;
  unlockedAt: number;
  context?: string;
}

export interface TimerPersistedState {
  key: 'focus' | 'workout';
  status: 'idle' | 'running' | 'paused' | 'completed';
  startedAtEpoch: number | null;
  accumulatedMs: number;
  targetMs: number;
  meta: Record<string, any>;
  updatedAt: number;
}

export interface OutboxItem {
  id: string;
  table: string;
  op: 'insert' | 'update' | 'delete';
  payload: any;
  createdAt: number;
}

export class FrostArcDatabase extends Dexie {
  profile!: Table<UserProfile, string>;
  seasons!: Table<Season, string>;
  subjects!: Table<Subject, string>;
  studyTargets!: Table<StudyTarget, string>;
  dayInstances!: Table<DayInstance, string>; // PK: compositeKey [seasonId+dayKey]
  studySessions!: Table<StudySession, string>;
  routineTemplates!: Table<RoutineTemplate, string>;
  routineLogs!: Table<RoutineLog, string>;
  workoutTemplates!: Table<WorkoutTemplate, string>;
  exerciseTemplates!: Table<ExerciseTemplate, string>;
  workoutLogs!: Table<WorkoutLog, string>;
  workoutSessions!: Table<WorkoutSession, string>;
  backlog!: Table<BacklogItem, string>;
  backlogHistory!: Table<BacklogHistoryItem, string>;
  penalties!: Table<Penalty, string>;
  dailyRecords!: Table<DailyRecord, string>;
  xpEvents!: Table<XpEvent, string>;
  shieldEvents!: Table<ShieldEvent, string>;
  achievementsUnlocked!: Table<AchievementUnlocked, string>;
  timerState!: Table<TimerPersistedState, string>;
  outbox!: Table<OutboxItem, string>;

  constructor() {
    super('FrostArcDB');

    this.version(1).stores({
      profile: 'id',
      seasons: 'id, number, status, startDate, endDate',
      subjects: 'id, seasonId, order, archived',
      studyTargets: 'id, subjectId, weekday, [subjectId+weekday]',
      dayInstances: '[seasonId+dayKey], seasonId, dayKey, status, arcDay',
      studySessions: 'id, seasonId, dayKey, subjectId, [seasonId+dayKey]',
      routineTemplates: 'id, weekday, category, order',
      routineLogs: 'id, seasonId, dayKey, templateItemId, [seasonId+dayKey]',
      workoutTemplates: 'id, weekday',
      exerciseTemplates: 'id, workoutTemplateId, order',
      workoutLogs: 'id, seasonId, dayKey, exerciseId, [seasonId+dayKey]',
      workoutSessions: 'id, seasonId, dayKey, [seasonId+dayKey]',
      backlog: 'id, subjectId, status',
      backlogHistory: 'id, backlogId, subjectId, timestamp',
      penalties: 'id, seasonId, sourceDayKey, assignedDayKey, status, dedupeKey, [seasonId+assignedDayKey]',
      dailyRecords: '[seasonId+dayKey], seasonId, dayKey, compositeKey, state, streakAfter',
      xpEvents: 'id, seasonId, dayKey, dedupeKey, [seasonId+dayKey]',
      shieldEvents: 'id, seasonId, dayKey, type, [seasonId+dayKey]',
      achievementsUnlocked: 'id, seasonId, unlockedAt',
      timerState: 'key',
      outbox: 'id, table, createdAt',
    });
  }
}

export const db = new FrostArcDatabase();
