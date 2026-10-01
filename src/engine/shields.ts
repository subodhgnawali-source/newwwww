import { ARC_CONFIG } from './config';
import type { ShieldEvent } from '../db/db';

export interface ShieldEvaluationResult {
  shouldProtect: boolean;
  shieldsRemaining: number;
  consumedShield: boolean;
  reason?: string;
}

/**
 * Calculates current available shields from event history, capped at MAX_SHIELDS (3).
 */
export function calculateAvailableShields(events: ShieldEvent[]): number {
  let count = 0;
  // Sort events chronologically
  const sorted = [...events].sort((a, b) => a.createdAt - b.createdAt);
  for (const ev of sorted) {
    if (ev.type === 'earned') {
      count = Math.min(ARC_CONFIG.MAX_SHIELDS, count + 1);
    } else if (ev.type === 'used') {
      count = Math.max(0, count - 1);
    }
  }
  return count;
}

/**
 * Checks if a streak count reached a new 7-day milestone (7, 14, 21, 28, etc.)
 */
export function isStreakMilestone(streak: number): boolean {
  return streak > 0 && streak % 7 === 0;
}

/**
 * Evaluates whether a day should be auto-protected by a shield upon finalization.
 * Rules:
 * - Not on Day 1 (arcDay > 1)
 * - Overall % must be between 50% and (threshold - 1)%
 * - At least 1 shield must be available
 */
export function evaluateShieldProtection(
  arcDay: number,
  overallPct: number,
  successThreshold: number,
  availableShields: number
): ShieldEvaluationResult {
  // Never protect Day 1
  if (arcDay <= 1) {
    return {
      shouldProtect: false,
      shieldsRemaining: availableShields,
      consumedShield: false,
    };
  }

  // Check eligible range [50%, threshold - 1%]
  const isEligibleScore =
    overallPct >= ARC_CONFIG.SHIELD_MIN_THRESHOLD &&
    overallPct < successThreshold;

  if (isEligibleScore && availableShields > 0) {
    return {
      shouldProtect: true,
      shieldsRemaining: availableShields - 1,
      consumedShield: true,
      reason: `Auto-protected at ${overallPct}% (threshold ${successThreshold}%)`,
    };
  }

  return {
    shouldProtect: false,
    shieldsRemaining: availableShields,
    consumedShield: false,
  };
}
