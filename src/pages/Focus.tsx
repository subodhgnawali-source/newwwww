import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { db, type Subject } from '../db/db';
import { useFocusTimer, type TimerMode } from '../features/timer/TimerContext';
import { ProgressRing } from '../components/ui/ProgressRing';
import { recomputeDay } from '../commands/recomputeDay';
import {
  Play,
  Pause,
  RotateCcw,
  Check,
  X,
  Plus,
  BookOpen,
  Coffee,
  Settings,
  Clock,
  Sparkles,
  ChevronDown,
} from 'lucide-react';

export const Focus: React.FC = () => {
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const activeSeason = useLiveQuery(() => db.seasons.where('status').equals('active').first());
  const subjects = useLiveQuery(
    () => (activeSeason ? db.subjects.where('seasonId').equals(activeSeason.id).filter((s) => !s.archived).sortBy('order') : []),
    [activeSeason]
  ) || [];

  const studySessions = useLiveQuery(
    () => (activeSeason ? db.studySessions.where({ seasonId: activeSeason.id, dayKey: todayKey }).toArray() : []),
    [activeSeason, todayKey]
  ) || [];

  const dayInstance = useLiveQuery(
    () => (activeSeason ? db.dayInstances.get([activeSeason.id, todayKey]) : undefined),
    [activeSeason, todayKey]
  );

  const {
    status,
    mode,
    remainingMs,
    elapsedMs,
    targetMs,
    progressPct,
    meta,
    startSession,
    pauseSession,
    resumeSession,
    completeSessionEarly,
    cancelSession,
    switchMode,
  } = useFocusTimer();

  // Local state for modal / custom target editing
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [customMinutes, setCustomMinutes] = useState<number>(25);
  const [isEditingTargets, setIsEditingTargets] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState('#38BDF8');

  // Compute completed study seconds per subject today
  const subjectStudyMap = new Map<string, number>();
  for (const sess of studySessions) {
    subjectStudyMap.set(sess.subjectId, (subjectStudyMap.get(sess.subjectId) || 0) + sess.actualSec);
  }

  // Format MM:SS for big timer display
  const totalRemainingSec = Math.floor(remainingMs / 1000);
  const remMinutes = Math.floor(totalRemainingSec / 60);
  const remSeconds = totalRemainingSec % 60;
  const timeFormatted = `${String(remMinutes).padStart(2, '0')}:${String(remSeconds).padStart(2, '0')}`;

  const elapsedTotalSec = Math.floor(elapsedMs / 1000);
  const elMinutes = Math.floor(elapsedTotalSec / 60);
  const elSeconds = elapsedTotalSec % 60;
  const elapsedFormatted = `${String(elMinutes).padStart(2, '0')}:${String(elSeconds).padStart(2, '0')}`;

  const activeSubject = subjects.find((s) => s.id === (selectedSubjectId || meta.subjectId)) || subjects[0];

  const handleStartTimer = (sub?: Subject, mins: number = customMinutes) => {
    const s = sub || activeSubject;
    if (!s) return;
    startSession(s.id, s.name, s.color, mins, 'focus');
  };

  const handleAddSubject = async () => {
    if (!newSubjectName.trim() || !activeSeason) return;
    const subId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await db.subjects.put({
      id: subId,
      seasonId: activeSeason.id,
      name: newSubjectName.trim(),
      color: newSubjectColor,
      order: subjects.length + 1,
      archived: false,
    });
    // Add default target 60 min
    for (let day = 0; day <= 6; day++) {
      await db.studyTargets.put({
        id: `target_${subId}_${day}`,
        subjectId: subId,
        weekday: day,
        minutes: 60,
      });
    }
    setNewSubjectName('');
    setIsEditingTargets(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Timer Hero Card */}
      <section className="frost-card p-6 sm:p-8 flex flex-col items-center justify-center text-center relative overflow-hidden">
        {/* Subtle background glow from active subject color */}
        <div
          className="absolute -top-20 w-80 h-80 rounded-full blur-3xl opacity-20 pointer-events-none transition-all duration-700"
          style={{ backgroundColor: meta.subjectColor || '#7CC8FF' }}
        />

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-1 p-1 bg-white/5 border border-white/10 rounded-xl mb-6">
          <button
            onClick={() => switchMode('focus', 25)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              mode === 'focus' ? 'bg-[#7CC8FF] text-slate-950 shadow-sm' : 'text-[#8FA3BF] hover:text-white'
            }`}
          >
            Deep Focus (25m)
          </button>
          <button
            onClick={() => switchMode('break', 5)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              mode === 'break' ? 'bg-[#5EE6B8] text-slate-950 shadow-sm' : 'text-[#8FA3BF] hover:text-white'
            }`}
          >
            Break (5m)
          </button>
          <button
            onClick={() => switchMode('long_break', 15)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              mode === 'long_break' ? 'bg-[#C084FC] text-slate-950 shadow-sm' : 'text-[#8FA3BF] hover:text-white'
            }`}
          >
            Long Break (15m)
          </button>
        </div>

        {/* Active Subject Selector (if idle) */}
        {status === 'idle' ? (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xs text-[#8FA3BF]">Subject:</span>
            <select
              value={selectedSubjectId || (activeSubject ? activeSubject.id : '')}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="bg-white/10 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-[#7CC8FF]"
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id} className="bg-[#0B1324] text-white">
                  {sub.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="mb-3 flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: meta.subjectColor || '#7CC8FF' }}
            />
            <span className="text-sm font-bold text-white tracking-wide">
              {meta.subjectName}
            </span>
            <span className="text-xs text-[#8FA3BF]">· Pomodoro #{meta.pomodoroCycleCount + 1}</span>
          </div>
        )}

        {/* Large Countdown Ring */}
        <div className="my-2">
          <ProgressRing
            progressPct={progressPct}
            size={220}
            strokeWidth={14}
            fromColor={meta.subjectColor || '#7CC8FF'}
            toColor="#3B82F6"
            label="Focus Session Timer"
          >
            <span className="text-5xl font-black text-white font-tabular tracking-tight">
              {timeFormatted}
            </span>
            <span className="text-xs font-semibold text-[#8FA3BF] mt-1 font-tabular">
              {elapsedFormatted} elapsed
            </span>
          </ProgressRing>
        </div>

        {/* Action Controls */}
        <div className="mt-6 flex items-center justify-center gap-3">
          {status === 'idle' && (
            <button
              onClick={() => handleStartTimer()}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7CC8FF] to-[#3B82F6] px-8 py-3 text-sm font-bold text-slate-950 shadow-lg hover:brightness-110 active:scale-95 transition"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>Start Session</span>
            </button>
          )}

          {status === 'running' && (
            <>
              <button
                onClick={pauseSession}
                className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 px-6 py-3 text-sm font-semibold text-white transition active:scale-95 border border-white/10"
              >
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </button>
              <button
                onClick={completeSessionEarly}
                className="flex items-center gap-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-6 py-3 text-sm font-semibold transition active:scale-95 border border-emerald-500/30"
              >
                <Check className="w-4 h-4" />
                <span>Finish Early</span>
              </button>
            </>
          )}

          {status === 'paused' && (
            <>
              <button
                onClick={resumeSession}
                className="flex items-center gap-2 rounded-xl bg-[#7CC8FF] text-slate-950 px-6 py-3 text-sm font-bold transition active:scale-95 hover:brightness-110"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Resume</span>
              </button>
              <button
                onClick={completeSessionEarly}
                className="flex items-center gap-2 rounded-xl bg-emerald-500/20 text-emerald-300 px-5 py-3 text-sm font-semibold transition active:scale-95 border border-emerald-500/30"
              >
                <Check className="w-4 h-4" />
                <span>Save</span>
              </button>
              <button
                onClick={cancelSession}
                className="p-3 rounded-xl bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 transition active:scale-95"
                title="Discard session"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}

          {status === 'completed' && (
            <button
              onClick={() => handleStartTimer()}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7CC8FF] to-[#3B82F6] px-8 py-3 text-sm font-bold text-slate-950 shadow-lg hover:brightness-110 active:scale-95 transition"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>Next Session</span>
            </button>
          )}
        </div>
      </section>

      {/* Subject Daily Target Cards */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#7CC8FF]" />
            <h2 className="text-sm font-semibold text-white">Subject Targets Today</h2>
          </div>
          <button
            onClick={() => setIsEditingTargets(!isEditingTargets)}
            className="text-xs text-[#7CC8FF] hover:underline flex items-center gap-1"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Manage Subjects</span>
          </button>
        </div>

        {/* Add new subject dialog if toggled */}
        {isEditingTargets && (
          <div className="frost-card p-4 border-[#7CC8FF]/30 bg-white/5 space-y-3 animate-in fade-in">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">Add New Subject</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder="Subject Name (e.g. Sanskrit, Biology)"
                className="flex-1 rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#7CC8FF]"
              />
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newSubjectColor}
                  onChange={(e) => setNewSubjectColor(e.target.value)}
                  className="w-9 h-9 rounded-xl bg-transparent border-0 cursor-pointer"
                />
                <button
                  onClick={handleAddSubject}
                  className="rounded-xl bg-[#7CC8FF] text-slate-950 px-4 py-2 text-xs font-bold hover:brightness-110 transition"
                >
                  Add Subject
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {subjects.map((sub) => {
            const snapSub = dayInstance?.snapshot?.subjects?.find((s) => s.id === sub.id);
            const targetMin = snapSub?.targetMinutes || 60;
            const completedSec = subjectStudyMap.get(sub.id) || 0;
            const completedMin = Math.round(completedSec / 60);
            const pct = Math.min(100, Math.round((completedMin / Math.max(1, targetMin)) * 100));
            const isMet = completedMin >= targetMin;

            return (
              <div
                key={sub.id}
                onClick={() => {
                  if (status === 'idle') {
                    setSelectedSubjectId(sub.id);
                    handleStartTimer(sub);
                  }
                }}
                className="frost-card-interactive p-4 flex flex-col justify-between cursor-pointer group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: sub.color }}
                    />
                    <div>
                      <h3 className="text-sm font-semibold text-white group-hover:text-[#7CC8FF] transition">
                        {sub.name}
                      </h3>
                      <p className="text-[11px] text-[#8FA3BF] font-tabular mt-0.5">
                        {completedMin}m of {targetMin}m done
                      </p>
                    </div>
                  </div>
                  {isMet && (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      ✓ MET (+20 XP)
                    </span>
                  )}
                </div>

                {/* Subject progress bar */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-[10px] text-[#8FA3BF] font-tabular">
                    <span>Progress</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: sub.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Today's Study Sessions History */}
      <section className="frost-card p-5">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#7CC8FF]" />
            <h2 className="text-sm font-semibold text-white">
              Today's Completed Study Blocks ({studySessions.length})
            </h2>
          </div>
          <span className="text-xs text-[#8FA3BF] font-tabular">
            Total:{' '}
            {Math.round(
              studySessions.reduce((sum, s) => sum + s.actualSec, 0) / 60
            )}
            m
          </span>
        </div>

        {studySessions.length === 0 ? (
          <p className="text-xs text-[#8FA3BF] py-4 text-center">
            No focus blocks completed yet today. Start your first session above!
          </p>
        ) : (
          <div className="divide-y divide-white/5 mt-2">
            {studySessions.map((session) => {
              const sub = subjects.find((s) => s.id === session.subjectId);
              const durationMin = Math.round(session.actualSec / 60);
              return (
                <div key={session.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: sub?.color || '#7CC8FF' }}
                    />
                    <div>
                      <p className="text-xs font-semibold text-white">
                        {sub?.name || 'Study Block'}
                      </p>
                      <p className="text-[10px] text-[#8FA3BF]">
                        Started {format(new Date(session.startedAt), 'hh:mm a')}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-white font-tabular">
                    {durationMin} min
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
