import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO } from 'date-fns';
import confetti from 'canvas-confetti';
import { db, type DailyRecord } from '../db/db';
import { computeArcProgress, type ArcDayGridItem } from '../engine/arc';
import { computeAnalytics } from '../engine/analytics';
import { ACHIEVEMENTS } from '../engine/achievements';
import { replayStreakRecords } from '../engine/streak';
import { calculateAvailableShields } from '../engine/shields';
import { calculateLevelFromXp } from '../engine/config';
import {
  TrendingUp,
  Award,
  Grid,
  Calendar,
  Layers,
  Flame,
  Shield,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronRight,
  BarChart2,
} from 'lucide-react';

export const Progress: React.FC = () => {
  const activeSeason = useLiveQuery(() => db.seasons.where('status').equals('active').first());
  const subjects = useLiveQuery(
    () => (activeSeason ? db.subjects.where('seasonId').equals(activeSeason.id).filter((s) => !s.archived).sortBy('order') : []),
    [activeSeason]
  ) || [];

  const dailyRecords = useLiveQuery(() => db.dailyRecords.toArray()) || [];
  const studySessions = useLiveQuery(() => db.studySessions.toArray()) || [];
  const workoutSessions = useLiveQuery(() => db.workoutSessions.toArray()) || [];
  const routineLogs = useLiveQuery(() => db.routineLogs.toArray()) || [];
  const backlogItems = useLiveQuery(() => db.backlog.toArray()) || [];
  const unlockedAchievements = useLiveQuery(() => db.achievementsUnlocked.toArray()) || [];
  const shieldEvents = useLiveQuery(() => db.shieldEvents.toArray()) || [];
  const xpEvents = useLiveQuery(() => db.xpEvents.toArray()) || [];

  const [activeTab, setActiveTab] = useState<'grid' | 'analytics' | 'history' | 'achievements'>('grid');
  const [selectedDay, setSelectedDay] = useState<ArcDayGridItem | null>(null);

  // Compute live Arc & analytics
  const arcProgress = useMemo(() => {
    if (!activeSeason) return null;
    return computeArcProgress(activeSeason, dailyRecords, 0, new Date());
  }, [activeSeason, dailyRecords]);

  const analytics = useMemo(() => {
    return computeAnalytics(
      subjects,
      dailyRecords,
      studySessions,
      workoutSessions,
      routineLogs,
      backlogItems
    );
  }, [subjects, dailyRecords, studySessions, workoutSessions, routineLogs, backlogItems]);

  const streakStats = replayStreakRecords(dailyRecords);
  const availableShields = calculateAvailableShields(shieldEvents);
  const totalXp = xpEvents.reduce((s, e) => s + e.amount, 0);
  const levelInfo = calculateLevelFromXp(totalXp);

  const unlockedMap = new Map<string, number>();
  for (const a of unlockedAchievements) {
    unlockedMap.set(a.id, a.unlockedAt);
  }

  // Trigger celebration confetti if Arc Completed
  const triggerCelebration = () => {
    try {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#7CC8FF', '#5EE6B8', '#A2E2FF', '#FFFFFF'],
      });
    } catch {
      // fallback
    }
  };

  const getDayStateBadge = (state: string) => {
    switch (state) {
      case 'completed':
        return <span className="text-emerald-400 font-bold text-xs">✓ Completed</span>;
      case 'protected':
        return <span className="text-[#7CC8FF] font-bold text-xs">🛡️ Protected</span>;
      case 'missed':
        return <span className="text-rose-400 font-bold text-xs">✕ Missed</span>;
      case 'incomplete':
        return <span className="text-amber-400 font-bold text-xs">▲ Incomplete</span>;
      case 'current':
        return <span className="text-cyan-300 font-bold text-xs">● Active Today</span>;
      default:
        return <span className="text-[#8FA3BF] text-xs">Upcoming</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Progress Header */}
      <section className="frost-card p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#7CC8FF]" />
            <span>Arc Progression & Analytics</span>
          </h1>
          <p className="text-xs text-[#8FA3BF] mt-1">
            Audited performance data across your 60-day discipline campaign.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 p-1 bg-white/5 border border-white/10 rounded-xl overflow-x-auto max-w-full">
          {[
            { id: 'grid', label: '60-Day Map', icon: Grid },
            { id: 'analytics', label: 'Analytics', icon: BarChart2 },
            { id: 'history', label: 'Day History', icon: Calendar },
            { id: 'achievements', label: `Awards (${unlockedAchievements.length})`, icon: Award },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  isActive
                    ? 'bg-[#7CC8FF] text-slate-950 shadow-sm'
                    : 'text-[#8FA3BF] hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Overview Stat Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="frost-card p-4">
          <p className="text-[11px] font-semibold uppercase text-[#8FA3BF]">Current Arc Day</p>
          <p className="text-xl font-black text-white font-tabular mt-1">
            Day {arcProgress?.arcDay || 1} <span className="text-xs text-[#8FA3BF]">/ 60</span>
          </p>
          <p className="text-[10px] text-[#7CC8FF] mt-0.5">
            {arcProgress?.daysRemaining || 0} days remaining
          </p>
        </div>

        <div className="frost-card p-4">
          <p className="text-[11px] font-semibold uppercase text-[#8FA3BF]">Active Streak</p>
          <p className="text-xl font-black text-amber-400 font-tabular mt-1 flex items-center gap-1">
            <Flame className="w-5 h-5 fill-amber-400" />
            {streakStats.currentStreak} Days
          </p>
          <p className="text-[10px] text-[#8FA3BF] mt-0.5">
            Best: {streakStats.longestStreak} days
          </p>
        </div>

        <div className="frost-card p-4">
          <p className="text-[11px] font-semibold uppercase text-[#8FA3BF]">Total Focus</p>
          <p className="text-xl font-black text-[#7CC8FF] font-tabular mt-1">
            {analytics.totalFocusHours} Hours
          </p>
          <p className="text-[10px] text-[#8FA3BF] mt-0.5">
            {analytics.totalSessions} completed blocks
          </p>
        </div>

        <div className="frost-card p-4">
          <p className="text-[11px] font-semibold uppercase text-[#8FA3BF]">Arc Success Rate</p>
          <p className="text-xl font-black text-emerald-400 font-tabular mt-1">
            {arcProgress?.successfulRate || 0}%
          </p>
          <p className="text-[10px] text-[#8FA3BF] mt-0.5">
            Target: 70%+ for Victory
          </p>
        </div>
      </section>

      {/* TAB 1: 60-DAY MAP GRID */}
      {activeTab === 'grid' && (
        <section className="frost-card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div>
              <h2 className="text-sm font-bold text-white">60-Day Arc Grid</h2>
              <p className="text-xs text-[#8FA3BF]">
                Each tile represents a day of the Arc. Tap any day to inspect its immutable snapshot.
              </p>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#8FA3BF]">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500/80" />
                <span>Completed</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#7CC8FF]/80" />
                <span>Protected</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-rose-500/80" />
                <span>Missed</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded border border-cyan-400 bg-cyan-400/30" />
                <span>Today</span>
              </span>
            </div>
          </div>

          {/* 60 Grid Cells */}
          <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-12 gap-2 pt-2">
            {(arcProgress?.grid || []).map((day) => {
              let cellBg = 'bg-white/5 border-white/10 text-[#8FA3BF]';

              if (day.isToday) {
                cellBg = 'border-2 border-cyan-400 bg-cyan-500/20 text-white font-bold ring-2 ring-cyan-400/30';
              } else if (day.state === 'completed') {
                cellBg = 'bg-emerald-500/25 border-emerald-500/40 text-emerald-300 font-bold';
              } else if (day.state === 'protected') {
                cellBg = 'bg-[#7CC8FF]/25 border-[#7CC8FF]/40 text-[#7CC8FF] font-bold';
              } else if (day.state === 'missed') {
                cellBg = 'bg-rose-500/25 border-rose-500/40 text-rose-300';
              } else if (day.state === 'incomplete') {
                cellBg = 'bg-amber-500/25 border-amber-500/40 text-amber-300';
              }

              return (
                <button
                  key={day.arcDay}
                  onClick={() => setSelectedDay(day)}
                  className={`aspect-square rounded-xl border flex flex-col items-center justify-center text-center p-1 hover:scale-105 active:scale-95 transition-all ${cellBg}`}
                  title={`Day ${day.arcDay} (${day.dayKey}): ${day.state} (${day.overallPct}%)`}
                >
                  <span className="text-xs font-tabular">{day.arcDay}</span>
                  {day.state !== 'future' && (
                    <span className="text-[9px] font-tabular mt-0.5 opacity-80">
                      {day.overallPct}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Day Detail Modal */}
          {selectedDay && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
              <div className="w-full max-w-md rounded-2xl bg-[#0B1324] border border-[#7CC8FF]/30 p-6 shadow-2xl text-[#EAF4FF] space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Day {selectedDay.arcDay} Record
                    </h3>
                    <p className="text-xs text-[#8FA3BF]">{selectedDay.dayKey}</p>
                  </div>
                  <button
                    onClick={() => setSelectedDay(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[#8FA3BF]">State:</span>
                    <span>{getDayStateBadge(selectedDay.state)}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[#8FA3BF]">Overall Score:</span>
                    <span className="font-bold font-tabular text-sm text-white">
                      {selectedDay.overallPct}%
                    </span>
                  </div>

                  {selectedDay.record && (
                    <div className="space-y-2 p-3 rounded-xl bg-white/5 border border-white/10">
                      <p className="font-semibold text-white">Breakdown:</p>
                      <div className="flex justify-between text-[11px] text-[#8FA3BF]">
                        <span>Study: {selectedDay.record.studyPct}%</span>
                        <span>Routine: {selectedDay.record.routinePct}%</span>
                        <span>Workout: {selectedDay.record.workoutPct}%</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-[#8FA3BF] pt-1">
                        <span>XP Earned: +{selectedDay.record.xpEarned}</span>
                        <span>Streak After: {selectedDay.record.streakAfter}d</span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setSelectedDay(null)}
                  className="w-full rounded-xl bg-white/10 py-2.5 text-xs font-semibold text-white hover:bg-white/15 transition"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* TAB 2: ANALYTICS */}
      {activeTab === 'analytics' && (
        <section className="space-y-4">
          {/* Study Time Per Subject */}
          <div className="frost-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-white">Focus Time by Subject</h3>
            <div className="space-y-3">
              {analytics.subjectsBreakdown.map((sub) => (
                <div key={sub.subjectId} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-white flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sub.color }} />
                      {sub.subjectName}
                    </span>
                    <span className="font-tabular text-[#8FA3BF]">
                      {sub.totalHours} hrs ({sub.pctOfTotalStudy}%) · {sub.sessionCount} sessions
                    </span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${sub.pctOfTotalStudy}%`,
                        backgroundColor: sub.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pillars completion rates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="frost-card p-5 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#8FA3BF]">
                Habit Adherence Rate
              </h3>
              <p className="text-2xl font-black text-[#C084FC] font-tabular">
                {analytics.routineCompletionRate}%
              </p>
              <p className="text-[11px] text-[#8FA3BF]">
                Average daily completion of routine check items.
              </p>
            </div>

            <div className="frost-card p-5 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#8FA3BF]">
                Workout Execution Rate
              </h3>
              <p className="text-2xl font-black text-[#5EE6B8] font-tabular">
                {analytics.workoutCompletionRate}%
              </p>
              <p className="text-[11px] text-[#8FA3BF]">
                Average completion on scheduled training days.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* TAB 3: DAILY HISTORY */}
      {activeTab === 'history' && (
        <section className="frost-card p-5 space-y-3">
          <h2 className="text-sm font-bold text-white pb-3 border-b border-white/10">
            Finalized Day Records ({dailyRecords.length})
          </h2>

          {dailyRecords.length === 0 ? (
            <p className="text-xs text-[#8FA3BF] py-6 text-center">
              No finalized records yet. Past days will finalize at midnight or on day rollover.
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {[...dailyRecords].reverse().map((record) => (
                <div key={record.dayKey} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{record.dayKey}</span>
                      {getDayStateBadge(record.state)}
                    </div>
                    <p className="text-[11px] text-[#8FA3BF] font-tabular mt-0.5">
                      Study: {record.studyPct}% · Routine: {record.routinePct}% · Workout: {record.workoutPct}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-white font-tabular">
                      {record.overallPct}%
                    </p>
                    <p className="text-[11px] text-emerald-400 font-tabular">
                      +{record.xpEarned} XP
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 4: ACHIEVEMENTS */}
      {activeTab === 'achievements' && (
        <section className="space-y-4">
          <div className="frost-card p-5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Discipline Trophies</h2>
              <p className="text-xs text-[#8FA3BF] mt-0.5">
                {unlockedAchievements.length} of {ACHIEVEMENTS.length} unlocked
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              {Math.round((unlockedAchievements.length / ACHIEVEMENTS.length) * 100)}% Complete
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ACHIEVEMENTS.map((ach) => {
              const isUnlocked = unlockedMap.has(ach.id);
              const unlockedAt = unlockedMap.get(ach.id);

              return (
                <div
                  key={ach.id}
                  className={`frost-card p-4 flex items-start gap-3.5 transition ${
                    isUnlocked
                      ? 'border-[#7CC8FF]/40 bg-[#7CC8FF]/5'
                      : 'opacity-50 grayscale'
                  }`}
                >
                  <div className="text-2xl flex-shrink-0 p-2 rounded-xl bg-white/5">
                    {ach.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-white truncate">{ach.name}</h3>
                      <span className="text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded bg-white/10 text-[#7CC8FF]">
                        {ach.tier}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8FA3BF] mt-1 line-clamp-2">
                      {ach.description}
                    </p>
                    {isUnlocked && unlockedAt && (
                      <p className="text-[10px] text-emerald-400 mt-2 font-tabular">
                        ✓ Unlocked {format(new Date(unlockedAt), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
