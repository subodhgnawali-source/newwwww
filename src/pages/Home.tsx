import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { db } from '../db/db';
import { computeDayCompletion } from '../engine/completion';
import { replayStreakRecords } from '../engine/streak';
import { calculateAvailableShields } from '../engine/shields';
import { calculateLevelFromXp } from '../engine/config';
import { computeArcDayNumber } from '../engine/arc';
import { toggleRoutineItem, togglePenaltyTask } from '../commands/userCommands';
import { ProgressRing } from '../components/ui/ProgressRing';
import {
  Flame,
  Shield,
  Sparkles,
  Play,
  CheckCircle2,
  Circle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Dumbbell,
  CheckSquare,
  Clock,
} from 'lucide-react';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  // Dexie live queries (Single source of truth)
  const profile = useLiveQuery(() => db.profile.get('default'));
  const activeSeason = useLiveQuery(() => db.seasons.where('status').equals('active').first());
  const dayInstance = useLiveQuery(
    () => (activeSeason ? db.dayInstances.get([activeSeason.id, todayKey]) : undefined),
    [activeSeason, todayKey]
  );
  const studySessions = useLiveQuery(
    () => (activeSeason ? db.studySessions.where({ seasonId: activeSeason.id, dayKey: todayKey }).toArray() : []),
    [activeSeason, todayKey]
  ) || [];
  const routineLogs = useLiveQuery(
    () => (activeSeason ? db.routineLogs.where({ seasonId: activeSeason.id, dayKey: todayKey }).toArray() : []),
    [activeSeason, todayKey]
  ) || [];
  const workoutLogs = useLiveQuery(
    () => (activeSeason ? db.workoutLogs.where({ seasonId: activeSeason.id, dayKey: todayKey }).toArray() : []),
    [activeSeason, todayKey]
  ) || [];
  const todayPenalties = useLiveQuery(
    () => (activeSeason ? db.penalties.where({ seasonId: activeSeason.id, assignedDayKey: todayKey }).toArray() : []),
    [activeSeason, todayKey]
  ) || [];
  const dailyRecords = useLiveQuery(() => db.dailyRecords.toArray()) || [];
  const shieldEvents = useLiveQuery(() => db.shieldEvents.toArray()) || [];
  const xpEvents = useLiveQuery(() => db.xpEvents.toArray()) || [];

  // Live computations
  const threshold = profile?.settings?.successThreshold || 80;
  const completion = useMemo(() => {
    if (!dayInstance) {
      return {
        studyPct: 0,
        routinePct: 0,
        workoutPct: 0,
        recoveryPct: 100,
        overallPct: 0,
        isSuccessful: false,
        details: {
          totalStudyAssignedMin: 0,
          totalStudyCompletedMin: 0,
          totalRoutineItems: 0,
          doneRoutineItems: 0,
          totalExercises: 0,
          doneExercises: 0,
          isRestDay: true,
          totalPenalties: 0,
          donePenalties: 0,
        },
      };
    }
    return computeDayCompletion(
      dayInstance,
      studySessions,
      routineLogs,
      workoutLogs,
      todayPenalties,
      threshold
    );
  }, [dayInstance, studySessions, routineLogs, workoutLogs, todayPenalties, threshold]);

  const streakStats = replayStreakRecords(dailyRecords);
  const availableShields = calculateAvailableShields(shieldEvents);
  const totalXp = xpEvents.reduce((s, e) => s + e.amount, 0);
  const levelInfo = calculateLevelFromXp(totalXp);

  const arcDay = activeSeason
    ? Math.max(1, Math.min(60, computeArcDayNumber(activeSeason.startDate, new Date())))
    : 1;

  // Greeting by time of day
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Dynamic motivational quote based on progress
  const motivation = useMemo(() => {
    if (completion.overallPct >= 100) return 'Perfection attained today. Maintain this ice-cold discipline.';
    if (completion.overallPct >= threshold) return 'Standard met! You are in the green zone. Push for 100%.';
    if (completion.overallPct >= 50) return 'Past halfway. Complete your remaining blocks to secure your streak.';
    return 'The Arc demands focus. Win the morning, win the day.';
  }, [completion.overallPct, threshold]);

  const routineDoneMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const r of routineLogs) {
      if (r.done) map.set(r.templateItemId, true);
    }
    return map;
  }, [routineLogs]);

  // Next up routine items
  const routineItems = dayInstance?.snapshot?.routine || [];
  const pendingRoutine = routineItems.filter((item) => !routineDoneMap.get(item.id));

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Hero Greeting & Stats Card */}
      <section className="frost-card p-5 sm:p-7 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#7CC8FF]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#7CC8FF]">
              <span>Day {arcDay} of 60</span>
              <span aria-hidden="true">·</span>
              <span>Winter Arc</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
              {greeting}, {profile?.name || 'Student'}
            </h1>
            <p className="text-xs text-[#8FA3BF] mt-1 italic">"{motivation}"</p>
          </div>

          {/* Quick Start Focus Button */}
          <button
            onClick={() => navigate('/focus')}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7CC8FF] to-[#3B82F6] px-5 py-3 text-sm font-bold text-slate-950 shadow-lg hover:brightness-110 active:scale-95 transition"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>Start Deep Work</span>
          </button>
        </div>

        {/* Level XP Bar */}
        <div className="pt-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Level {levelInfo.level} Scholar
            </span>
            <span className="text-[#8FA3BF] font-tabular">
              {levelInfo.currentLevelXp} / {levelInfo.nextLevelXpRequired} XP to Level {levelInfo.level + 1}
            </span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-[#7CC8FF] rounded-full transition-all duration-500"
              style={{ width: `${levelInfo.levelProgressPct}%` }}
            />
          </div>
        </div>
      </section>

      {/* Main Rings Dashboard Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Overall Completion Ring */}
        <div className="md:col-span-1 frost-card p-6 flex flex-col items-center justify-center text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8FA3BF] mb-3">
            Today's Overall Score
          </p>

          <ProgressRing
            progressPct={completion.overallPct}
            size={148}
            strokeWidth={12}
            fromColor={completion.isSuccessful ? '#5EE6B8' : '#7CC8FF'}
            toColor={completion.isSuccessful ? '#34D399' : '#3B82F6'}
          >
            <span className="text-3xl font-extrabold text-white font-tabular">
              {completion.overallPct}%
            </span>
            <span className="text-[11px] font-semibold text-[#8FA3BF]">
              Target: {threshold}%
            </span>
          </ProgressRing>

          <div className="mt-4 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                completion.isSuccessful
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-white/5 text-[#8FA3BF] border border-white/10'
              }`}
            >
              {completion.isSuccessful ? '✓ Green Zone' : `${threshold - completion.overallPct}% to Success`}
            </span>
          </div>
        </div>

        {/* 3 Pillar Mini Rings (Study, Routine, Workout) */}
        <div className="md:col-span-2 frost-card p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h2 className="text-sm font-semibold text-white">Daily Arc Pillars</h2>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 fill-amber-400" />
                {streakStats.currentStreak}-Day Streak
              </span>
              <span className="text-[#7CC8FF] font-bold flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 fill-[#7CC8FF]/30" />
                {availableShields}/3 Shields
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 py-4">
            {/* Study Mini Ring */}
            <div
              onClick={() => navigate('/focus')}
              className="flex flex-col items-center p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition cursor-pointer group"
            >
              <ProgressRing
                progressPct={completion.studyPct}
                size={70}
                strokeWidth={7}
                fromColor="#7CC8FF"
                toColor="#3B82F6"
                gradientId="studyRing"
              >
                <span className="text-xs font-bold text-white font-tabular">
                  {completion.studyPct}%
                </span>
              </ProgressRing>
              <span className="text-xs font-semibold text-white mt-2 group-hover:text-[#7CC8FF] transition flex items-center gap-1">
                <BookOpen className="w-3 h-3 text-[#7CC8FF]" />
                Study (40%)
              </span>
              <span className="text-[10px] text-[#8FA3BF] font-tabular mt-0.5">
                {Math.round(completion.details.totalStudyCompletedMin)}m / {completion.details.totalStudyAssignedMin}m
              </span>
            </div>

            {/* Routine Mini Ring */}
            <div
              onClick={() => navigate('/routine')}
              className="flex flex-col items-center p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition cursor-pointer group"
            >
              <ProgressRing
                progressPct={completion.routinePct}
                size={70}
                strokeWidth={7}
                fromColor="#C084FC"
                toColor="#818CF8"
                gradientId="routineRing"
              >
                <span className="text-xs font-bold text-white font-tabular">
                  {completion.routinePct}%
                </span>
              </ProgressRing>
              <span className="text-xs font-semibold text-white mt-2 group-hover:text-[#C084FC] transition flex items-center gap-1">
                <CheckSquare className="w-3 h-3 text-[#C084FC]" />
                Routine (25%)
              </span>
              <span className="text-[10px] text-[#8FA3BF] font-tabular mt-0.5">
                {completion.details.doneRoutineItems} / {completion.details.totalRoutineItems} Done
              </span>
            </div>

            {/* Workout Mini Ring */}
            <div
              onClick={() => navigate('/workout')}
              className="flex flex-col items-center p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition cursor-pointer group"
            >
              {completion.details.isRestDay ? (
                <div className="w-[70px] h-[70px] rounded-full border border-dashed border-[#7CC8FF]/40 bg-[#7CC8FF]/10 flex flex-col items-center justify-center text-center">
                  <span className="text-base">🧊</span>
                  <span className="text-[9px] font-bold text-[#7CC8FF]">REST</span>
                </div>
              ) : (
                <ProgressRing
                  progressPct={completion.workoutPct}
                  size={70}
                  strokeWidth={7}
                  fromColor="#5EE6B8"
                  toColor="#10B981"
                  gradientId="workoutRing"
                >
                  <span className="text-xs font-bold text-white font-tabular">
                    {completion.workoutPct}%
                  </span>
                </ProgressRing>
              )}
              <span className="text-xs font-semibold text-white mt-2 group-hover:text-[#5EE6B8] transition flex items-center gap-1">
                <Dumbbell className="w-3 h-3 text-[#5EE6B8]" />
                Workout (25%)
              </span>
              <span className="text-[10px] text-[#8FA3BF] font-tabular mt-0.5">
                {completion.details.isRestDay
                  ? 'Intentional Rest'
                  : `${completion.details.doneExercises} / ${completion.details.totalExercises} Ex`}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Recovery / Interest Penalties (Assigned for Today) */}
      {todayPenalties.length > 0 && (
        <section className="frost-card p-5 border-amber-500/30 bg-amber-950/20">
          <div className="flex items-center justify-between pb-3 border-b border-amber-500/20">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-amber-200">
                Today's Recovery Tasks ({todayPenalties.filter((p) => p.status === 'done').length}/{todayPenalties.length} Cleared)
              </h2>
            </div>
            <span className="text-xs text-amber-300/80 font-tabular">+15 XP each</span>
          </div>

          <p className="text-xs text-amber-300/70 mt-2 mb-3">
            Shortfall from past days converted at 1.25x interest. Clear them to protect your Arc.
          </p>

          <div className="space-y-2">
            {todayPenalties.map((penalty) => {
              const isDone = penalty.status === 'done';
              return (
                <div
                  key={penalty.id}
                  onClick={() => togglePenaltyTask(penalty.id, isDone ? 'pending' : 'done')}
                  className={`p-3 rounded-xl border flex items-center justify-between transition cursor-pointer ${
                    isDone
                      ? 'bg-emerald-500/10 border-emerald-500/30 line-through opacity-70'
                      : 'bg-white/5 border-amber-500/30 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    )}
                    <div>
                      <p className="text-xs font-semibold text-white">{penalty.reason}</p>
                      <p className="text-[10px] text-[#8FA3BF]">
                        From {penalty.sourceDayKey} · Penalty: +{penalty.penaltyAmount} {penalty.unit}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-bold font-tabular ${
                      isDone ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {isDone ? 'DONE' : `+${penalty.penaltyAmount} ${penalty.unit}`}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Next Up Routine Checklist */}
      <section className="frost-card p-5">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#7CC8FF]" />
            <h2 className="text-sm font-semibold text-white">Daily Routine Checklist</h2>
          </div>
          <button
            onClick={() => navigate('/routine')}
            className="text-xs text-[#7CC8FF] hover:underline flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="divide-y divide-white/5 mt-2">
          {routineItems.slice(0, 5).map((item) => {
            const isDone = !!routineDoneMap.get(item.id);
            return (
              <div
                key={item.id}
                onClick={() => {
                  if (activeSeason) {
                    toggleRoutineItem(
                      activeSeason.id,
                      todayKey,
                      item.id,
                      item.title,
                      !isDone
                    );
                  }
                }}
                className="py-3 flex items-center justify-between gap-3 hover:bg-white/5 px-2 rounded-lg transition cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-[#5EE6B8] flex-shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-500 group-hover:text-[#7CC8FF] flex-shrink-0" />
                  )}
                  <span
                    className={`text-xs font-medium truncate ${
                      isDone ? 'line-through text-[#8FA3BF]' : 'text-white'
                    }`}
                  >
                    {item.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[#8FA3BF] font-tabular flex-shrink-0">
                  <span>{item.startTime}</span>
                  <span>({item.durationMin}m)</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
