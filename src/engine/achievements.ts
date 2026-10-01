import type { DailyRecord, StudySession, WorkoutSession, RoutineLog, BacklogItem, Penalty } from '../db/db';

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface AchievementEvaluationContext {
  arcDay: number;
  dailyRecords: DailyRecord[];
  allStudySessions: StudySession[];
  allWorkoutSessions: WorkoutSession[];
  allRoutineLogs: RoutineLog[];
  allBacklog: BacklogItem[];
  allPenalties: Penalty[];
  currentStreak: number;
  longestStreak: number;
  totalXp: number;
  currentLevel: number;
  shieldsUsedTotal: number;
  todayKey: string;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  tier: AchievementTier;
  icon: string;
  evaluate: (ctx: AchievementEvaluationContext) => boolean;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first_frost',
    name: 'First Frost',
    description: 'Complete Day 1 of your Arc with a successful or protected score.',
    tier: 'bronze',
    icon: '❄️',
    evaluate: (ctx) => ctx.dailyRecords.some((r) => r.state === 'completed' || r.state === 'protected'),
  },
  {
    id: 'iron_week',
    name: 'Iron Week',
    description: 'Reach a streak of 7 consecutive successful days.',
    tier: 'bronze',
    icon: '⚔️',
    evaluate: (ctx) => ctx.longestStreak >= 7,
  },
  {
    id: 'fortnight_forged',
    name: 'Fortnight Forged',
    description: 'Reach a streak of 14 consecutive successful days.',
    tier: 'silver',
    icon: '🛡️',
    evaluate: (ctx) => ctx.longestStreak >= 14,
  },
  {
    id: 'month_of_ice',
    name: 'Month of Ice',
    description: 'Maintain an unbroken streak for 30 full days.',
    tier: 'gold',
    icon: '🧊',
    evaluate: (ctx) => ctx.longestStreak >= 30,
  },
  {
    id: 'absolute_zero',
    name: 'Absolute Zero',
    description: 'Complete the entire 60-day Arc with honor.',
    tier: 'platinum',
    icon: '👑',
    evaluate: (ctx) => ctx.dailyRecords.length >= 60,
  },
  {
    id: 'perfect_day',
    name: 'Flawless Execution',
    description: 'Achieve a 100% completion score across all categories in a single day.',
    tier: 'bronze',
    icon: '✨',
    evaluate: (ctx) => ctx.dailyRecords.some((r) => r.overallPct >= 100),
  },
  {
    id: 'triple_perfect',
    name: 'Triple Perfection',
    description: 'Achieve 100% completion for 3 consecutive days.',
    tier: 'silver',
    icon: '💎',
    evaluate: (ctx) => {
      let streak100 = 0;
      for (const r of ctx.dailyRecords) {
        if (r.overallPct >= 100) {
          streak100++;
          if (streak100 >= 3) return true;
        } else {
          streak100 = 0;
        }
      }
      return false;
    },
  },
  {
    id: 'deep_work_initiate',
    name: 'Deep Work Initiate',
    description: 'Log 4 or more hours of focus study in a single day.',
    tier: 'silver',
    icon: '🧠',
    evaluate: (ctx) => {
      const daySecMap = new Map<string, number>();
      for (const s of ctx.allStudySessions) {
        daySecMap.set(s.dayKey, (daySecMap.get(s.dayKey) || 0) + s.actualSec);
      }
      for (const sec of daySecMap.values()) {
        if (sec >= 4 * 3600) return true;
      }
      return false;
    },
  },
  {
    id: 'centurion',
    name: 'Centurion',
    description: 'Accumulate 100 hours of genuine focus study across the Arc.',
    tier: 'gold',
    icon: '🏛️',
    evaluate: (ctx) => {
      const totalSec = ctx.allStudySessions.reduce((sum, s) => sum + s.actualSec, 0);
      return totalSec >= 100 * 3600;
    },
  },
  {
    id: 'marathon_mind',
    name: 'Marathon Mind',
    description: 'Complete a single continuous focus session of 60 minutes or longer.',
    tier: 'bronze',
    icon: '⏳',
    evaluate: (ctx) => ctx.allStudySessions.some((s) => s.actualSec >= 3600),
  },
  {
    id: 'gym_rat',
    name: 'Iron Temple',
    description: 'Log 20 completed workout sessions in this Arc.',
    tier: 'silver',
    icon: '🏋️',
    evaluate: (ctx) => ctx.allWorkoutSessions.filter((w) => w.completed).length >= 20,
  },
  {
    id: 'early_bird',
    name: 'Dawn Vanguard',
    description: 'Complete your first morning routine item before 6:30 AM.',
    tier: 'bronze',
    icon: '🌅',
    evaluate: (ctx) => {
      return ctx.allRoutineLogs.some((l) => {
        if (!l.done || !l.doneAt) return false;
        const d = new Date(l.doneAt);
        const hours = d.getHours();
        const mins = d.getMinutes();
        return hours < 6 || (hours === 6 && mins <= 30);
      });
    },
  },
  {
    id: 'shield_bearer',
    name: 'Shield Bearer',
    description: 'Survive an off-day by having your streak saved by a shield.',
    tier: 'bronze',
    icon: '🛡️',
    evaluate: (ctx) => ctx.shieldsUsedTotal > 0 || ctx.dailyRecords.some((r) => r.state === 'protected'),
  },
  {
    id: 'comeback_kid',
    name: 'The Comeback',
    description: 'Achieve a successful day immediately after a missed day.',
    tier: 'silver',
    icon: '⚡',
    evaluate: (ctx) => {
      const sorted = [...ctx.dailyRecords].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i - 1].state === 'missed' && sorted[i].state === 'completed') {
          return true;
        }
      }
      return false;
    },
  },
  {
    id: 'clean_slate',
    name: 'Clean Slate',
    description: 'Mark all syllabus & subject backlog items as up-to-date.',
    tier: 'silver',
    icon: '📋',
    evaluate: (ctx) => ctx.allBacklog.length > 0 && ctx.allBacklog.every((b) => b.status === 'up_to_date'),
  },
  {
    id: 'debt_collector',
    name: 'Debt Settler',
    description: 'Complete 5 recovery penalty tasks to make up for missed work.',
    tier: 'bronze',
    icon: '⚖️',
    evaluate: (ctx) => ctx.allPenalties.filter((p) => p.status === 'done').length >= 5,
  },
  {
    id: 'level_5',
    name: 'Frost Initiate (Lvl 5)',
    description: 'Attain Level 5 through disciplined XP gain.',
    tier: 'bronze',
    icon: '⭐',
    evaluate: (ctx) => ctx.currentLevel >= 5,
  },
  {
    id: 'level_10',
    name: 'Glacier Adept (Lvl 10)',
    description: 'Attain Level 10 through relentless consistency.',
    tier: 'silver',
    icon: '🌟',
    evaluate: (ctx) => ctx.currentLevel >= 10,
  },
  {
    id: 'level_20',
    name: 'Blizzard Sovereign (Lvl 20)',
    description: 'Reach Level 20 — mastery of the Arc.',
    tier: 'gold',
    icon: '💫',
    evaluate: (ctx) => ctx.currentLevel >= 20,
  },
  {
    id: 'iron_routine',
    name: 'Unshakable Habit',
    description: 'Achieve 100% routine completion for 5 days in a row.',
    tier: 'silver',
    icon: '🎯',
    evaluate: (ctx) => {
      let run = 0;
      for (const r of ctx.dailyRecords) {
        if (r.routinePct >= 100) {
          run++;
          if (run >= 5) return true;
        } else {
          run = 0;
        }
      }
      return false;
    },
  },
  {
    id: 'halfway_hero',
    name: 'Halfway Sovereign',
    description: 'Reach Day 30 of the 60-day Arc.',
    tier: 'silver',
    icon: '🏔️',
    evaluate: (ctx) => ctx.arcDay >= 30,
  },
  {
    id: 'zero_debt',
    name: 'Clean Ledger',
    description: 'Zero pending penalties with at least 14 days of the Arc completed.',
    tier: 'gold',
    icon: '🕊️',
    evaluate: (ctx) => {
      const hasPending = ctx.allPenalties.some((p) => p.status === 'pending');
      return !hasPending && ctx.dailyRecords.length >= 14;
    },
  },
];
