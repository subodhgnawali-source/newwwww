import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { db, type DaySnapshotExercise } from '../db/db';
import { toggleExerciseLog, recordWorkoutSession } from '../commands/userCommands';
import { useRestTimer } from '../features/workout/RestTimerContext';
import { ProgressRing } from '../components/ui/ProgressRing';
import {
  Dumbbell,
  CheckCircle2,
  Circle,
  Timer,
  Play,
  Pause,
  SkipForward,
  Plus,
  Flame,
  Calendar,
  Sparkles,
  RotateCcw,
} from 'lucide-react';

export const Workout: React.FC = () => {
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const activeSeason = useLiveQuery(() => db.seasons.where('status').equals('active').first());

  const dayInstance = useLiveQuery(
    () => (activeSeason ? db.dayInstances.get([activeSeason.id, todayKey]) : undefined),
    [activeSeason, todayKey]
  );

  const workoutLogs = useLiveQuery(
    () => (activeSeason ? db.workoutLogs.where({ seasonId: activeSeason.id, dayKey: todayKey }).toArray() : []),
    [activeSeason, todayKey]
  ) || [];

  const workoutSession = useLiveQuery(
    () => (activeSeason ? db.workoutSessions.where({ seasonId: activeSeason.id, dayKey: todayKey }).first() : undefined),
    [activeSeason, todayKey]
  );

  const workoutTemplates = useLiveQuery(() => db.workoutTemplates.toArray()) || [];

  // Rest timer
  const {
    status: restStatus,
    remainingSec: restRemainingSec,
    targetSec: restTargetSec,
    activeExerciseName,
    startRest,
    pauseRest,
    resumeRest,
    skipRest,
    addSeconds,
  } = useRestTimer();

  const [activeTab, setActiveTab] = useState<'today' | 'split'>('today');

  const workout = dayInstance?.snapshot?.workout || {
    isRest: true,
    name: 'Rest Day',
    exercises: [],
  };

  const exercises = workout.exercises || [];
  const isRestDay = workout.isRest || exercises.length === 0;

  const doneMap = new Map<string, boolean>();
  for (const log of workoutLogs) {
    if (log.done) doneMap.set(log.exerciseId, true);
  }

  const doneCount = exercises.filter((ex) => doneMap.get(ex.id)).length;
  const progressPct = exercises.length > 0 ? Math.round((doneCount / exercises.length) * 100) : 100;
  const isAllDone = exercises.length > 0 && doneCount === exercises.length;

  const handleToggleExercise = async (ex: DaySnapshotExercise, currentDone: boolean) => {
    if (!activeSeason) return;
    const nextDone = !currentDone;
    await toggleExerciseLog(activeSeason.id, todayKey, ex, nextDone);

    // If marked done, trigger rest timer
    if (nextDone && ex.restSec > 0) {
      startRest(ex.restSec, ex.name);
    }
  };

  const handleFinishWorkout = async () => {
    if (!activeSeason) return;
    const now = Date.now();
    await recordWorkoutSession(activeSeason.id, todayKey, now - 3600 * 1000, now, 300, true);
  };

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Tab Toggle */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-[#5EE6B8]" />
            <span>Physical Conditioning</span>
          </h1>
          <p className="text-xs text-[#8FA3BF]">
            Discipline for the body builds endurance for the mind.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-white/5 border border-white/10 rounded-xl">
          <button
            onClick={() => setActiveTab('today')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'today' ? 'bg-[#5EE6B8] text-slate-950 shadow-sm' : 'text-[#8FA3BF] hover:text-white'
            }`}
          >
            Today's Session
          </button>
          <button
            onClick={() => setActiveTab('split')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'split' ? 'bg-[#5EE6B8] text-slate-950 shadow-sm' : 'text-[#8FA3BF] hover:text-white'
            }`}
          >
            Weekly Split
          </button>
        </div>
      </div>

      {activeTab === 'today' ? (
        <>
          {/* Rest Day View */}
          {isRestDay ? (
            <div className="frost-card p-8 text-center space-y-4 border-[#7CC8FF]/30">
              <div className="w-16 h-16 rounded-2xl bg-[#7CC8FF]/10 text-3xl flex items-center justify-center mx-auto border border-[#7CC8FF]/30">
                🧊
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Intentional Rest & Recovery</h2>
                <p className="text-xs text-[#8FA3BF] max-w-md mx-auto mt-1">
                  Today is scheduled as a recovery day. Rest is an essential part of discipline—it
                  is never counted as missed and does not penalize your Arc completion.
                </p>
              </div>
              <div className="pt-2 flex justify-center gap-2">
                <span className="text-xs font-medium px-3 py-1 rounded-full bg-white/5 text-[#7CC8FF] border border-[#7CC8FF]/20">
                  Category Excluded · Weights Normalized
                </span>
              </div>
            </div>
          ) : (
            <>
              {/* Workout Progress Card */}
              <section className="frost-card p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="space-y-2 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="text-xs font-bold text-[#5EE6B8] uppercase tracking-wider">
                      Today's Training
                    </span>
                    <span className="text-[10px] text-[#8FA3BF]">·</span>
                    <span className="text-xs text-white font-medium">{workout.name}</span>
                  </div>
                  <h2 className="text-2xl font-black text-white">{workout.name}</h2>
                  <p className="text-xs text-[#8FA3BF]">
                    {doneCount} of {exercises.length} exercises complete ({progressPct}%)
                  </p>

                  {isAllDone && (
                    <div className="pt-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                        <Sparkles className="w-3.5 h-3.5" />
                        Workout Complete (+40 XP Bonus)
                      </span>
                    </div>
                  )}
                </div>

                <ProgressRing
                  progressPct={progressPct}
                  size={120}
                  strokeWidth={10}
                  fromColor="#5EE6B8"
                  toColor="#10B981"
                  gradientId="todayWorkoutRing"
                >
                  <span className="text-2xl font-black text-white font-tabular">
                    {progressPct}%
                  </span>
                  <span className="text-[10px] text-[#8FA3BF]">Done</span>
                </ProgressRing>
              </section>

              {/* Live Rest Timer Widget (if running or paused) */}
              {restStatus !== 'idle' && (
                <section className="frost-card p-4 border-[#5EE6B8]/40 bg-[#0B1524] animate-in slide-in-from-top-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#5EE6B8]/20 flex items-center justify-center text-[#5EE6B8]">
                        <Timer className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">REST INTERVAL</span>
                          <span className="text-[11px] text-[#8FA3BF] truncate max-w-[140px]">
                            {activeExerciseName}
                          </span>
                        </div>
                        <p className="text-2xl font-black text-[#5EE6B8] font-tabular">
                          {restRemainingSec}s
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => addSeconds(30)}
                        className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition active:scale-95"
                      >
                        +30s
                      </button>
                      {restStatus === 'running' ? (
                        <button
                          onClick={pauseRest}
                          className="p-2 rounded-lg bg-white/10 hover:bg-white/15 text-white transition"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={resumeRest}
                          className="p-2 rounded-lg bg-[#5EE6B8] text-slate-950 font-bold transition"
                        >
                          <Play className="w-4 h-4 fill-slate-950" />
                        </button>
                      )}
                      <button
                        onClick={skipRest}
                        className="p-2 rounded-lg bg-white/10 hover:bg-white/15 text-[#8FA3BF] hover:text-white transition"
                        title="Skip rest"
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {/* Exercise Checklist */}
              <section className="frost-card p-5 space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    Exercises Checklist
                  </h3>
                  <span className="text-xs text-[#8FA3BF] font-tabular">+5 XP per exercise</span>
                </div>

                <div className="space-y-2.5">
                  {exercises.map((ex, idx) => {
                    const isDone = !!doneMap.get(ex.id);
                    return (
                      <div
                        key={ex.id || idx}
                        onClick={() => handleToggleExercise(ex, isDone)}
                        className={`p-4 rounded-xl border flex items-center justify-between transition cursor-pointer group ${
                          isDone
                            ? 'bg-emerald-500/10 border-emerald-500/30'
                            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {isDone ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-500 group-hover:text-[#5EE6B8] flex-shrink-0" />
                          )}
                          <div>
                            <h4
                              className={`text-sm font-semibold ${
                                isDone ? 'line-through text-[#8FA3BF]' : 'text-white'
                              }`}
                            >
                              {ex.name}
                            </h4>
                            <p className="text-xs text-[#8FA3BF] font-tabular mt-0.5">
                              {ex.sets} sets × {ex.reps} {ex.durationSec ? 'sec' : 'reps'} · {ex.restSec}s rest
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startRest(ex.restSec, ex.name);
                            }}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-[#8FA3BF] hover:text-[#5EE6B8] transition"
                            title="Start rest timer for this exercise"
                          >
                            <Timer className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Finalize workout session button */}
                {isAllDone && !workoutSession && (
                  <button
                    onClick={handleFinishWorkout}
                    className="w-full mt-4 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#5EE6B8] to-[#10B981] py-3 text-sm font-bold text-slate-950 shadow-lg hover:brightness-110 active:scale-98 transition"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Complete Full Workout Session</span>
                  </button>
                )}
              </section>
            </>
          )}
        </>
      ) : (
        /* Weekly Split Overview */
        <section className="frost-card p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white">7-Day Training Split</h3>
            <p className="text-xs text-[#8FA3BF]">
              Your recurring weekly workout program. Days snapshot into the daily instance on arrival.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => {
              const tmpl = workoutTemplates.find((w) => w.weekday === dayIdx);
              const isRest = tmpl?.isRest ?? (dayIdx === 0 || dayIdx === 4);
              const name = tmpl?.name || (isRest ? 'Rest Day' : 'Training Day');

              return (
                <div
                  key={dayIdx}
                  className={`p-4 rounded-xl border flex flex-col justify-between ${
                    isRest
                      ? 'border-[#7CC8FF]/20 bg-[#7CC8FF]/5'
                      : 'border-white/10 bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-white/5">
                    <span className="text-xs font-bold uppercase text-white">
                      {weekdays[dayIdx]}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isRest
                          ? 'bg-[#7CC8FF]/20 text-[#7CC8FF]'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {isRest ? 'REST' : 'TRAIN'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white mt-2">{name}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
