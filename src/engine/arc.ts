import { ARC_CONFIG } from './config';
import type { DailyRecord, Season, SeasonSummary } from '../db/db';
import { differenceInCalendarDays, addDays, format, parseISO } from 'date-fns';

export interface ArcDayGridItem {
  arcDay: number;
  dayKey: string;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  state: 'future' | 'current' | 'completed' | 'incomplete' | 'missed' | 'protected';
  overallPct: number;
  record?: DailyRecord;
}

export interface ArcProgressStats {
  arcDay: number; // 1 to 60, or <1 if before start, or >60 if ended
  totalDays: number;
  daysRemaining: number;
  completedDays: number;
  protectedDays: number;
  incompleteDays: number;
  missedDays: number;
  perfectDays: number;
  successfulRate: number; // % of elapsed days that were successful or protected
  overallAveragePct: number;
  isArcEnded: boolean;
  isArcSuccess: boolean;
  grid: ArcDayGridItem[];
}

export function computeArcDayNumber(startDateStr: string, targetDate: Date = new Date()): number {
  const start = parseISO(startDateStr);
  return differenceInCalendarDays(targetDate, start) + 1;
}

export function computeArcProgress(
  season: Season,
  dailyRecords: DailyRecord[],
  todayLivePct: number = 0,
  referenceDate: Date = new Date()
): ArcProgressStats {
  const startDate = parseISO(season.startDate);
  const currentArcDay = differenceInCalendarDays(referenceDate, startDate) + 1;
  const todayKey = format(referenceDate, 'yyyy-MM-dd');

  const recordMap = new Map<string, DailyRecord>();
  for (const r of dailyRecords) {
    recordMap.set(r.dayKey, r);
  }

  let completedDays = 0;
  let protectedDays = 0;
  let incompleteDays = 0;
  let missedDays = 0;
  let perfectDays = 0;
  let totalPctSum = 0;
  let recordedDaysCount = 0;

  const grid: ArcDayGridItem[] = [];

  for (let i = 1; i <= ARC_CONFIG.TOTAL_DAYS; i++) {
    const dayDate = addDays(startDate, i - 1);
    const dayKey = format(dayDate, 'yyyy-MM-dd');
    const isToday = dayKey === todayKey;
    const isPast = dayDate < referenceDate && !isToday;
    const isFuture = dayDate > referenceDate && !isToday;

    const record = recordMap.get(dayKey);
    let state: ArcDayGridItem['state'] = 'future';
    let overallPct = 0;

    if (record) {
      state = record.state;
      overallPct = record.overallPct;
      totalPctSum += record.overallPct;
      recordedDaysCount++;

      if (record.overallPct >= 100) perfectDays++;
      if (record.state === 'completed') completedDays++;
      else if (record.state === 'protected') protectedDays++;
      else if (record.state === 'incomplete') incompleteDays++;
      else if (record.state === 'missed') missedDays++;
    } else if (isToday) {
      state = 'current';
      overallPct = todayLivePct;
    } else if (isPast) {
      state = 'missed';
      missedDays++;
      recordedDaysCount++;
    } else {
      state = 'future';
    }

    grid.push({
      arcDay: i,
      dayKey,
      isToday,
      isPast,
      isFuture,
      state,
      overallPct,
      record,
    });
  }

  const elapsedDays = Math.max(1, Math.min(ARC_CONFIG.TOTAL_DAYS, currentArcDay));
  const successfulOrProtected = completedDays + protectedDays;
  const successfulRate = Math.round((successfulOrProtected / elapsedDays) * 100);

  const averagePct = recordedDaysCount > 0
    ? Math.round(totalPctSum / recordedDaysCount)
    : todayLivePct;

  const isArcEnded = currentArcDay > ARC_CONFIG.TOTAL_DAYS || season.status === 'completed';
  const isArcSuccess = isArcEnded && successfulOrProtected >= Math.ceil(ARC_CONFIG.TOTAL_DAYS * ARC_CONFIG.ARC_SUCCESS_RATIO);
  const daysRemaining = Math.max(0, ARC_CONFIG.TOTAL_DAYS - Math.max(0, currentArcDay));

  return {
    arcDay: currentArcDay,
    totalDays: ARC_CONFIG.TOTAL_DAYS,
    daysRemaining,
    completedDays,
    protectedDays,
    incompleteDays,
    missedDays,
    perfectDays,
    successfulRate,
    overallAveragePct: averagePct,
    isArcEnded,
    isArcSuccess,
    grid,
  };
}

export function buildSeasonSummary(
  season: Season,
  dailyRecords: DailyRecord[],
  totalFocusSec: number,
  bestSubject: string,
  longestStreak: number,
  totalXp: number,
  finalLevel: number,
  workoutsCompleted: number
): SeasonSummary {
  let perfectDays = 0;
  let successfulDays = 0;

  for (const r of dailyRecords) {
    if (r.overallPct >= 100) perfectDays++;
    if (r.state === 'completed' || r.state === 'protected') successfulDays++;
  }

  const overallSuccessRate = Math.round((successfulDays / ARC_CONFIG.TOTAL_DAYS) * 100);

  return {
    totalFocusHours: Math.round((totalFocusSec / 3600) * 10) / 10,
    bestSubject,
    longestStreak,
    totalXp,
    finalLevel,
    workoutsCompleted,
    perfectDays,
    successfulDays,
    overallSuccessRate,
    completedAt: new Date().toISOString(),
  };
}
