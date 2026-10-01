import { ARC_CONFIG, calculateLevelFromXp } from './config';
import type { XpEvent } from '../db/db';

export { calculateLevelFromXp };

export interface PendingXpFact {
  reason: string;
  refId: string;
  amount: number;
}

/**
 * Calculates focus session XP:
 * - 1 XP per minute if session >= 5 min
 * - +10 XP if session met/exceeded planned minutes
 * Note: Subject to DAILY_FOCUS_XP_CAP (300) across all focus sessions for that day.
 */
export function calculateFocusSessionXp(
  actualSec: number,
  plannedMin: number,
  currentDayFocusXpSoFar: number
): { xpEarned: number; newTotalFocusXp: number; fullBonusAwarded: boolean } {
  const fullMinutes = Math.floor(actualSec / 60);
  if (fullMinutes < ARC_CONFIG.XP.MIN_FOCUS_SESSION_MINUTES_FOR_XP) {
    return { xpEarned: 0, newTotalFocusXp: currentDayFocusXpSoFar, fullBonusAwarded: false };
  }

  // Base minute XP
  const allowedXp = Math.max(0, ARC_CONFIG.XP.DAILY_FOCUS_XP_CAP - currentDayFocusXpSoFar);
  const rawMinuteXp = fullMinutes * ARC_CONFIG.XP.PER_FOCUS_MINUTE;
  const minuteXp = Math.min(allowedXp, rawMinuteXp);

  // Planned completion bonus (does not count towards minute cap)
  const fullBonus = (plannedMin > 0 && fullMinutes >= plannedMin)
    ? ARC_CONFIG.XP.FULL_SESSION_COMPLETED_BONUS
    : 0;

  return {
    xpEarned: minuteXp + fullBonus,
    newTotalFocusXp: currentDayFocusXpSoFar + minuteXp,
    fullBonusAwarded: fullBonus > 0,
  };
}

/**
 * Computes total XP from a list of XpEvents.
 */
export function sumTotalXp(events: XpEvent[]): number {
  return events.reduce((sum, ev) => sum + ev.amount, 0);
}
