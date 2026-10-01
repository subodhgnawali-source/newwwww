import { describe, it, expect } from 'vitest';
import { computeDayCompletion } from '../src/engine/completion';
import { replayStreakRecords } from '../src/engine/streak';
import { calculateAvailableShields, evaluateShieldProtection } from '../src/engine/shields';
import { calculateLevelFromXp, calculateFocusSessionXp } from '../src/engine/xp';
import { detectUnmetTargets, schedulePenalties } from '../src/engine/penalty';
import { computeArcProgress } from '../src/engine/arc';
import type { DayInstance, StudySession, RoutineLog, WorkoutLog, Penalty, DailyRecord, ShieldEvent, Season } from '../src/db/db';

describe('Completion Engine', () => {
  it('renormalizes weights correctly on workout rest days', () => {
    const dayInstance: DayInstance = {
      seasonId: 'season_1',
      dayKey: '2026-10-01',
      arcDay: 1,
      status: 'active',
      snapshot: {
        subjects: [{ id: 'sub_1', name: 'Physics', color: '#3B82F6', targetMinutes: 60 }],
        routine: [{ id: 'rout_1', title: 'Wake at 6am', startTime: '06:00', durationMin: 10, category: 'morning', order: 0 }],
        workout: { isRest: true, name: 'Rest Day', exercises: [] },
      },
    };

    const studySessions: StudySession[] = [
      { id: 'sess_1', seasonId: 'season_1', dayKey: '2026-10-01', subjectId: 'sub_1', plannedMin: 60, actualSec: 3600, startedAt: 0, endedAt: 3600, source: 'timer' },
    ];
    const routineLogs: RoutineLog[] = [
      { id: 'log_1', seasonId: 'season_1', dayKey: '2026-10-01', templateItemId: 'rout_1', titleSnapshot: 'Wake at 6am', done: true },
    ];
    const workoutLogs: WorkoutLog[] = [];
    const penalties: Penalty[] = [];

    const result = computeDayCompletion(dayInstance, studySessions, routineLogs, workoutLogs, penalties, 80);

    // Study 100%, Routine 100%, Workout Rest (excluded), Recovery None (excluded)
    expect(result.studyPct).toBe(100);
    expect(result.routinePct).toBe(100);
    expect(result.overallPct).toBe(100);
    expect(result.isSuccessful).toBe(true);
    // Weights normalized between Study (0.40) and Routine (0.25) => 0.40/0.65 and 0.25/0.65
    expect(result.activeWeights.workout).toBe(0);
    expect(result.activeWeights.study + result.activeWeights.routine).toBeCloseTo(1.0, 4);
  });

  it('caps study completion percentage at assigned minutes', () => {
    const dayInstance: DayInstance = {
      seasonId: 'season_1',
      dayKey: '2026-10-01',
      arcDay: 1,
      status: 'active',
      snapshot: {
        subjects: [{ id: 'sub_1', name: 'Math', color: '#3B82F6', targetMinutes: 60 }],
        routine: [],
        workout: { isRest: true, name: 'Rest', exercises: [] },
      },
    };

    // Studied 120 minutes on a 60 min target
    const studySessions: StudySession[] = [
      { id: 'sess_1', seasonId: 'season_1', dayKey: '2026-10-01', subjectId: 'sub_1', plannedMin: 60, actualSec: 7200, startedAt: 0, endedAt: 7200, source: 'timer' },
    ];

    const result = computeDayCompletion(dayInstance, studySessions, [], [], [], 80);
    expect(result.studyPct).toBe(100); // Does not artificially exceed 100%
  });
});

describe('Streak Engine', () => {
  it('correctly handles completed, protected, and missed days', () => {
    const records: DailyRecord[] = [
      { seasonId: 's1', dayKey: '2026-10-01', compositeKey: 's1__2026-10-01', studyPct: 90, routinePct: 90, workoutPct: 90, taskPct: 100, overallPct: 90, state: 'completed', xpEarned: 100, penaltiesGenerated: 0, penaltiesCompleted: 0, shieldUsed: false, streakAfter: 1, finalizedAt: 1 },
      { seasonId: 's1', dayKey: '2026-10-02', compositeKey: 's1__2026-10-02', studyPct: 95, routinePct: 95, workoutPct: 95, taskPct: 100, overallPct: 95, state: 'completed', xpEarned: 100, penaltiesGenerated: 0, penaltiesCompleted: 0, shieldUsed: false, streakAfter: 2, finalizedAt: 2 },
      // Day 3 protected by shield: streak does not increment, but does NOT reset
      { seasonId: 's1', dayKey: '2026-10-03', compositeKey: 's1__2026-10-03', studyPct: 60, routinePct: 60, workoutPct: 60, taskPct: 100, overallPct: 60, state: 'protected', xpEarned: 50, penaltiesGenerated: 1, penaltiesCompleted: 0, shieldUsed: true, streakAfter: 2, finalizedAt: 3 },
      // Day 4 completed: streak resumes incrementing
      { seasonId: 's1', dayKey: '2026-10-04', compositeKey: 's1__2026-10-04', studyPct: 85, routinePct: 85, workoutPct: 85, taskPct: 100, overallPct: 85, state: 'completed', xpEarned: 100, penaltiesGenerated: 0, penaltiesCompleted: 0, shieldUsed: false, streakAfter: 3, finalizedAt: 4 },
      // Day 5 missed: streak resets to 0
      { seasonId: 's1', dayKey: '2026-10-05', compositeKey: 's1__2026-10-05', studyPct: 20, routinePct: 20, workoutPct: 20, taskPct: 0, overallPct: 20, state: 'missed', xpEarned: 10, penaltiesGenerated: 2, penaltiesCompleted: 0, shieldUsed: false, streakAfter: 0, finalizedAt: 5 },
      // Day 6 completed: streak restarts at 1
      { seasonId: 's1', dayKey: '2026-10-06', compositeKey: 's1__2026-10-06', studyPct: 90, routinePct: 90, workoutPct: 90, taskPct: 100, overallPct: 90, state: 'completed', xpEarned: 100, penaltiesGenerated: 0, penaltiesCompleted: 0, shieldUsed: false, streakAfter: 1, finalizedAt: 6 },
    ];

    const stats = replayStreakRecords(records);
    expect(stats.currentStreak).toBe(1);
    expect(stats.longestStreak).toBe(3);
    expect(stats.totalSuccessfulDays).toBe(4);
    expect(stats.protectedDays).toBe(1);
    expect(stats.totalMissedDays).toBe(1);
  });
});

describe('Shield Engine', () => {
  it('caps shields at 3 and computes consumption correctly', () => {
    const events: ShieldEvent[] = [
      { id: '1', seasonId: 's1', dayKey: '2026-10-07', type: 'earned', reason: '7-day streak', createdAt: 100 },
      { id: '2', seasonId: 's1', dayKey: '2026-10-14', type: 'earned', reason: '14-day streak', createdAt: 200 },
      { id: '3', seasonId: 's1', dayKey: '2026-10-21', type: 'earned', reason: '21-day streak', createdAt: 300 },
      { id: '4', seasonId: 's1', dayKey: '2026-10-28', type: 'earned', reason: '28-day streak', createdAt: 400 }, // Would be 4th
    ];

    expect(calculateAvailableShields(events)).toBe(3);

    // Consume one
    events.push({ id: '5', seasonId: 's1', dayKey: '2026-10-29', type: 'used', reason: 'Auto-protected', createdAt: 500 });
    expect(calculateAvailableShields(events)).toBe(2);
  });

  it('never shields Day 1 and requires >= 50% score', () => {
    // Day 1 at 70% with 2 shields -> No protection (Day 1 rule)
    expect(evaluateShieldProtection(1, 70, 80, 2).shouldProtect).toBe(false);

    // Day 5 at 48% (below 50%) -> No protection
    expect(evaluateShieldProtection(5, 48, 80, 2).shouldProtect).toBe(false);

    // Day 5 at 65% with 2 shields -> Protected!
    const protectResult = evaluateShieldProtection(5, 65, 80, 2);
    expect(protectResult.shouldProtect).toBe(true);
    expect(protectResult.shieldsRemaining).toBe(1);
  });
});

describe('XP & Level Engine', () => {
  it('correctly maps cumulative XP to level tiers', () => {
    // T(n) = 50 * n * (n + 1)
    // T(1) = 100
    // T(2) = 300
    // T(3) = 600
    expect(calculateLevelFromXp(50).level).toBe(1);
    expect(calculateLevelFromXp(100).level).toBe(2);
    expect(calculateLevelFromXp(250).level).toBe(2);
    expect(calculateLevelFromXp(300).level).toBe(3);
    expect(calculateLevelFromXp(600).level).toBe(4);
  });

  it('respects focus XP minimum and session completion bonuses', () => {
    // Less than 5 min gives 0 XP
    expect(calculateFocusSessionXp(4 * 60, 25, 0).xpEarned).toBe(0);

    // 25 min completed on a 25 min target: 25 + 10 bonus = 35 XP
    const sessionRes = calculateFocusSessionXp(25 * 60, 25, 0);
    expect(sessionRes.xpEarned).toBe(35);
    expect(sessionRes.fullBonusAwarded).toBe(true);
  });
});

describe('Interest Penalty Engine', () => {
  it('calculates 1.25x penalty rounded up to next 5 minutes', () => {
    const dayInstance: DayInstance = {
      seasonId: 's1',
      dayKey: '2026-10-01',
      arcDay: 1,
      status: 'finalized',
      snapshot: {
        subjects: [{ id: 'chem', name: 'Chemistry', color: '#10B981', targetMinutes: 60 }],
        routine: [],
        workout: { isRest: true, name: 'Rest', exercises: [] },
      },
    };

    // Studied 43 minutes, shortfall is 17 minutes
    // 17 * 1.25 = 21.25 -> rounded up to 25 minutes
    const studySessions: StudySession[] = [
      { id: 'chem_1', seasonId: 's1', dayKey: '2026-10-01', subjectId: 'chem', plannedMin: 60, actualSec: 43 * 60, startedAt: 0, endedAt: 43 * 60, source: 'timer' },
    ];

    const unmet = detectUnmetTargets(dayInstance, studySessions, [], []);
    expect(unmet.length).toBe(1);
    expect(unmet[0].missedAmount).toBe(17);
    expect(unmet[0].calculatedPenaltyAmount).toBe(25);
  });

  it('schedules penalties with deduplication and daily capacity limits', () => {
    const unmet = [
      { requirementKey: 'study_chem', type: 'study' as const, subjectId: 'chem', reason: 'Chemistry missed', missedAmount: 30, calculatedPenaltyAmount: 40, unit: 'min' },
      { requirementKey: 'study_phys', type: 'study' as const, subjectId: 'phys', reason: 'Physics missed', missedAmount: 30, calculatedPenaltyAmount: 40, unit: 'min' },
    ];

    const scheduled = schedulePenalties('s1', '2026-10-01', unmet, [], '2026-11-30');
    // First 40 min assigned to 2026-10-02
    // Second 40 min would exceed 60 min limit on 2026-10-02 (40 + 40 = 80 > 60), so assigned to 2026-10-03!
    expect(scheduled.length).toBe(2);
    expect(scheduled[0].assignedDayKey).toBe('2026-10-02');
    expect(scheduled[1].assignedDayKey).toBe('2026-10-03');
  });
});

describe('Arc Engine', () => {
  it('correctly reports Arc status and progress', () => {
    const season: Season = {
      id: 's1',
      number: 1,
      startDate: '2026-10-01',
      endDate: '2026-11-29',
      status: 'active',
    };

    const records: DailyRecord[] = [];
    const stats = computeArcProgress(season, records, 50, new Date('2026-10-01T12:00:00Z'));
    expect(stats.arcDay).toBe(1);
    expect(stats.totalDays).toBe(60);
    expect(stats.daysRemaining).toBe(59);
    expect(stats.grid.length).toBe(60);
  });
});
