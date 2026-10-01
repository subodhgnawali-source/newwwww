import type { DailyRecord, StudySession, Subject, WorkoutSession, RoutineLog, BacklogItem } from '../db/db';

export interface SubjectStudyAnalytics {
  subjectId: string;
  subjectName: string;
  color: string;
  totalSec: number;
  totalHours: number;
  pctOfTotalStudy: number;
  sessionCount: number;
}

export interface DayTrendPoint {
  dayKey: string;
  arcDay: number;
  studyPct: number;
  routinePct: number;
  workoutPct: number;
  overallPct: number;
  xpEarned: number;
  state: string;
}

export interface AnalyticsSummary {
  totalFocusHours: number;
  totalSessions: number;
  averageSessionMin: number;
  overallSuccessRate: number;
  averageOverallPct: number;
  subjectsBreakdown: SubjectStudyAnalytics[];
  dailyTrends: DayTrendPoint[];
  routineCompletionRate: number;
  workoutCompletionRate: number;
  backlogCounts: {
    total: number;
    upToDate: number;
    pending: number;
    upToDatePct: number;
  };
}

export function computeAnalytics(
  subjects: Subject[],
  dailyRecords: DailyRecord[],
  studySessions: StudySession[],
  workoutSessions: WorkoutSession[],
  routineLogs: RoutineLog[],
  backlogItems: BacklogItem[]
): AnalyticsSummary {
  // 1. Study sessions stats
  const totalFocusSec = studySessions.reduce((sum, s) => sum + s.actualSec, 0);
  const totalFocusHours = Math.round((totalFocusSec / 3600) * 10) / 10;
  const totalSessions = studySessions.length;
  const averageSessionMin = totalSessions > 0
    ? Math.round(totalFocusSec / totalSessions / 60)
    : 0;

  // Subjects breakdown
  const subSecMap = new Map<string, { sec: number; count: number }>();
  for (const s of studySessions) {
    const cur = subSecMap.get(s.subjectId) || { sec: 0, count: 0 };
    cur.sec += s.actualSec;
    cur.count += 1;
    subSecMap.set(s.subjectId, cur);
  }

  const subjectsBreakdown: SubjectStudyAnalytics[] = subjects.map((sub) => {
    const data = subSecMap.get(sub.id) || { sec: 0, count: 0 };
    const pct = totalFocusSec > 0 ? Math.round((data.sec / totalFocusSec) * 100) : 0;
    return {
      subjectId: sub.id,
      subjectName: sub.name,
      color: sub.color,
      totalSec: data.sec,
      totalHours: Math.round((data.sec / 3600) * 10) / 10,
      pctOfTotalStudy: pct,
      sessionCount: data.count,
    };
  });

  // Daily trends
  const sortedRecords = [...dailyRecords].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  const dailyTrends: DayTrendPoint[] = sortedRecords.map((r, idx) => ({
    dayKey: r.dayKey,
    arcDay: idx + 1,
    studyPct: r.studyPct,
    routinePct: r.routinePct,
    workoutPct: r.workoutPct,
    overallPct: r.overallPct,
    xpEarned: r.xpEarned,
    state: r.state,
  }));

  // Overall rates
  const totalRecords = dailyRecords.length;
  const successfulRecords = dailyRecords.filter((r) => r.state === 'completed' || r.state === 'protected').length;
  const overallSuccessRate = totalRecords > 0 ? Math.round((successfulRecords / totalRecords) * 100) : 0;
  const averageOverallPct = totalRecords > 0
    ? Math.round(dailyRecords.reduce((sum, r) => sum + r.overallPct, 0) / totalRecords)
    : 0;

  // Routine & Workout rates
  const avgRoutine = totalRecords > 0
    ? Math.round(dailyRecords.reduce((sum, r) => sum + r.routinePct, 0) / totalRecords)
    : 0;
  const avgWorkout = totalRecords > 0
    ? Math.round(dailyRecords.reduce((sum, r) => sum + r.workoutPct, 0) / totalRecords)
    : 0;

  // Backlog counts
  const totalBacklog = backlogItems.length;
  const upToDateBacklog = backlogItems.filter((b) => b.status === 'up_to_date').length;
  const pendingBacklog = totalBacklog - upToDateBacklog;
  const upToDatePct = totalBacklog > 0 ? Math.round((upToDateBacklog / totalBacklog) * 100) : 100;

  return {
    totalFocusHours,
    totalSessions,
    averageSessionMin,
    overallSuccessRate,
    averageOverallPct,
    subjectsBreakdown,
    dailyTrends,
    routineCompletionRate: avgRoutine,
    workoutCompletionRate: avgWorkout,
    backlogCounts: {
      total: totalBacklog,
      upToDate: upToDateBacklog,
      pending: pendingBacklog,
      upToDatePct,
    },
  };
}
