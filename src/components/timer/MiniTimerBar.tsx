import React from 'react';
import { useFocusTimer } from '../../features/timer/TimerContext';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, Check, Square, Flame } from 'lucide-react';

export const MiniTimerBar: React.FC = () => {
  const {
    status,
    remainingMs,
    elapsedMs,
    meta,
    pauseSession,
    resumeSession,
    completeSessionEarly,
    cancelSession,
  } = useFocusTimer();
  const navigate = useNavigate();

  if (status !== 'running' && status !== 'paused') {
    return null;
  }

  const totalSec = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="fixed bottom-16 lg:bottom-4 left-4 right-4 lg:left-auto lg:right-6 lg:w-96 z-40 animate-in slide-in-from-bottom-3 duration-200">
      <div className="frost-card p-2.5 sm:p-3 bg-[#0B1324]/90 border border-[#7CC8FF]/40 shadow-2xl flex items-center justify-between gap-3">
        {/* Click to open Focus screen */}
        <div
          onClick={() => navigate('/focus')}
          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group"
        >
          <div
            className="w-2.5 h-2.5 rounded-full animate-pulse flex-shrink-0"
            style={{ backgroundColor: meta.subjectColor || '#7CC8FF' }}
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate group-hover:text-[#7CC8FF] transition">
              {meta.subjectName}
            </p>
            <p className="text-[11px] text-[#8FA3BF] font-tabular">
              {meta.mode === 'focus' ? 'Deep Work' : 'Break'} · {timeFormatted} remaining
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {status === 'running' ? (
            <button
              onClick={pauseSession}
              aria-label="Pause focus timer"
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white transition active:scale-95"
            >
              <Pause className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={resumeSession}
              aria-label="Resume focus timer"
              className="p-1.5 rounded-lg bg-[#7CC8FF] hover:brightness-110 text-slate-950 font-bold transition active:scale-95"
            >
              <Play className="w-4 h-4 fill-slate-950" />
            </button>
          )}

          <button
            onClick={completeSessionEarly}
            aria-label="Complete session early"
            title="Complete early"
            className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 transition active:scale-95"
          >
            <Check className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
