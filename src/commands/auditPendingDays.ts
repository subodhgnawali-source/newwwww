import { db } from '../db/db';
import { getOrMaterializeDayInstance } from './dayMaterializer';
import { recomputeDay } from './recomputeDay';
import { format, parseISO, addDays, isBefore } from 'date-fns';

/**
 * Runs on every app open, tab visibility change, or midnight rollover.
 * 1. Materializes today's day instance if not present.
 * 2. Finalizes every past day from Arc start up to yesterday in chronological order.
 * Completely idempotent and transaction-safe.
 */
export async function auditPendingDays(): Promise<void> {
  const activeSeason = await db.seasons.where('status').equals('active').first();
  if (!activeSeason) return;

  const todayDate = new Date();
  const todayKey = format(todayDate, 'yyyy-MM-dd');

  // 1. Ensure today's day instance is materialized
  await getOrMaterializeDayInstance(activeSeason, todayKey);

  // 2. Iterate through all calendar days from season.startDate up to yesterday
  const startDate = parseISO(activeSeason.startDate);
  let cursor = startDate;

  // Finalize in strictly ascending chronological order
  while (isBefore(cursor, todayDate)) {
    const dayKey = format(cursor, 'yyyy-MM-dd');
    if (dayKey === todayKey) break;

    // Check if dailyRecord already exists for this day
    const existingRecord = await db.dailyRecords.get([activeSeason.id, dayKey]);
    if (!existingRecord) {
      // Ensure day instance exists (even if user never opened app that day)
      await getOrMaterializeDayInstance(activeSeason, dayKey);
      // Finalize the day, applying penalties & streak evaluation
      await recomputeDay(activeSeason.id, dayKey, { finalize: true });
    }

    cursor = addDays(cursor, 1);
  }
}
