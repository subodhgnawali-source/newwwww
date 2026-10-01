/**
 * FrostArc Core Configuration & Constants
 * All game rules, weights, thresholds, and limits defined here.
 */

export const ARC_CONFIG = {
  TOTAL_DAYS: 60,
  DEFAULT_SUCCESS_THRESHOLD: 80, // 80% default (configurable 50-100)
  SHIELD_MIN_THRESHOLD: 50, // Minimum % needed for shield auto-protection
  MAX_SHIELDS: 3,
  ARC_SUCCESS_RATIO: 0.7, // >= 70% of days successful or protected for Arc Victory

  // Completion Weights (Normalized dynamically if a category does not apply)
  WEIGHTS: {
    STUDY: 0.40,
    ROUTINE: 0.25,
    WORKOUT: 0.25,
    RECOVERY: 0.10,
  },

  // XP Rules
  XP: {
    PER_FOCUS_MINUTE: 1,
    MIN_FOCUS_SESSION_MINUTES_FOR_XP: 5,
    DAILY_FOCUS_XP_CAP: 300,
    FULL_SESSION_COMPLETED_BONUS: 10,
    SUBJECT_TARGET_MET: 20,
    ROUTINE_ITEM_DONE: 3,
    ALL_ROUTINE_DONE_BONUS: 25,
    EXERCISE_DONE: 5,
    FULL_WORKOUT_DONE_BONUS: 40,
    SUCCESSFUL_DAY_BONUS: 50,
    MAX_STREAK_BONUS: 30, // +min(streak, 30)
    BACKLOG_CLEARED: 30,
    RECOVERY_TASK_DONE: 15,
    ARC_COMPLETED_BONUS: 500,
  },

  // Penalty / Interest Rules
  PENALTY: {
    STUDY_INTEREST_MULTIPLIER: 1.25, // 125% of missed time
    STUDY_ROUND_UP_MINUTES: 5, // rounded up to next 5 minutes
    MAX_RECOVERY_STUDY_MIN_PER_DAY: 60, // max 60 min extra study / day
    MAX_RECOVERY_ITEMS_PER_DAY: 3,
    MAX_PENDING_HOURS_TOTAL: 5, // max 300 min total pending penalties
  },

  // Timer defaults (minutes)
  TIMER: {
    DEFAULT_FOCUS_MIN: 25,
    DEFAULT_BREAK_MIN: 5,
    DEFAULT_LONG_BREAK_MIN: 15,
    POMODORO_LONG_BREAK_INTERVAL: 4,
    DEFAULT_WORKOUT_REST_SEC: 60,
  },
} as const;

/**
 * Cumulative XP required to reach Level n:
 * T(n) = 50 * n * (n + 1)
 * Level 1 = 100 XP
 * Level 2 = 300 XP
 * Level 3 = 600 XP
 * Level 4 = 1000 XP
 */
export function getCumulativeXpForLevel(level: number): number {
  if (level <= 0) return 0;
  return 50 * level * (level + 1);
}

/**
 * Calculates current level and progress from total XP.
 * Level = largest n with T(n-1) <= xp
 */
export function calculateLevelFromXp(totalXp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXpRequired: number;
  levelProgressPct: number;
} {
  const safeXp = Math.max(0, Math.floor(totalXp));
  let level = 0;
  
  // Find highest level where T(level) <= safeXp
  while (getCumulativeXpForLevel(level + 1) <= safeXp) {
    level++;
  }

  const prevTierXp = getCumulativeXpForLevel(level);
  const nextTierXp = getCumulativeXpForLevel(level + 1);
  const span = nextTierXp - prevTierXp;
  const currentInLevel = safeXp - prevTierXp;
  const pct = span > 0 ? Math.min(100, Math.max(0, Math.round((currentInLevel / span) * 100))) : 0;

  return {
    level: level + 1, // Start user display at Level 1
    currentLevelXp: currentInLevel,
    nextLevelXpRequired: span,
    levelProgressPct: pct,
  };
}
