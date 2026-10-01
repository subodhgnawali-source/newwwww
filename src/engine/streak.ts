import type { DailyRecord } from '../db/db';

export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
  totalSuccessfulDays: number;
  totalMissedDays: number;
  protectedDays: number;
  perfectDays: number;
}

/**
 * Pure function: calculates streak progression by replaying daily records in chronological order.
 * - Completed (>= threshold): streak + 1
 * - Protected (shield used): streak remains unchanged (neither +1 nor reset to 0)
 * - Missed / Incomplete finalized: streak resets to 0
 */
export function replayStreakRecords(records: DailyRecord[]): StreakStats {
  // Sort records strictly by dayKey ascending
  const sorted = [...records].sort((a, b) => a.dayKey.localeCompare(b.dayKey));

  let currentStreak = 0;
  let longestStreak = 0;
  let totalSuccessfulDays = 0;
  let totalMissedDays = 0;
  let protectedDays = 0;
  let perfectDays = 0;

  for (const record of sorted) {
    if (record.overallPct >= 100) {
      perfectDays++;
    }

    if (record.state === 'completed') {
      currentStreak++;
      totalSuccessfulDays++;
      if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
      }
    } else if (record.state === 'protected') {
      protectedDays++;
      // Streak frozen/protected: neither incremented nor reset to 0
    } else if (record.state === 'missed' || record.state === 'incomplete') {
      currentStreak = 0;
      totalMissedDays++;
    }
  }

  return {
    currentStreak,
    longestStreak,
    totalSuccessfulDays,
    totalMissedDays,
    protectedDays,
    perfectDays,
  };
}
