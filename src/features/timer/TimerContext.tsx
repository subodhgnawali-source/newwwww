import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { db, type TimerPersistedState } from '../../db/db';
import { recordFocusSession } from '../../commands/userCommands';
import { soundManager } from '../../lib/sound';
import { deviceManager } from '../../lib/device';
import { format } from 'date-fns';

export type TimerMode = 'focus' | 'break' | 'long_break';

export interface FocusTimerMeta {
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  plannedMin: number;
  mode: TimerMode;
  pomodoroCycleCount: number;
}

export interface FocusTimerContextValue {
  status: 'idle' | 'running' | 'paused' | 'completed';
  mode: TimerMode;
  targetMs: number;
  elapsedMs: number;
  remainingMs: number;
  progressPct: number;
  meta: FocusTimerMeta;
  startSession: (subjectId: string, subjectName: string, subjectColor: string, minutes: number, mode?: TimerMode) => Promise<void>;
  pauseSession: () => Promise<void>;
  resumeSession: () => Promise<void>;
  completeSessionEarly: () => Promise<void>;
  cancelSession: () => Promise<void>;
  switchMode: (mode: TimerMode, durationMinutes: number) => Promise<void>;
  isMiniBarVisible: boolean;
}

const defaultMeta: FocusTimerMeta = {
  subjectId: '',
  subjectName: 'Deep Work',
  subjectColor: '#7CC8FF',
  plannedMin: 25,
  mode: 'focus',
  pomodoroCycleCount: 0,
};

const TimerContext = createContext<FocusTimerContextValue | null>(null);

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<'idle' | 'running' | 'paused' | 'completed'>('idle');
  const [startedAtEpoch, setStartedAtEpoch] = useState<number | null>(null);
  const [accumulatedMs, setAccumulatedMs] = useState<number>(0);
  const [targetMs, setTargetMs] = useState<number>(25 * 60 * 1000);
  const [meta, setMeta] = useState<FocusTimerMeta>(defaultMeta);
  const [renderTick, setRenderTick] = useState<number>(0);

  const timerRef = useRef<number | null>(null);

  // Restore state from IndexedDB on startup
  useEffect(() => {
    let mounted = true;
    db.timerState.get('focus').then((saved) => {
      if (!mounted || !saved) return;

      setTargetMs(saved.targetMs);
      setAccumulatedMs(saved.accumulatedMs);
      setMeta(saved.meta as FocusTimerMeta || defaultMeta);

      if (saved.status === 'running' && saved.startedAtEpoch) {
        const elapsedSinceStart = Date.now() - saved.startedAtEpoch;
        const totalElapsed = saved.accumulatedMs + elapsedSinceStart;

        if (totalElapsed >= saved.targetMs) {
          // Session completed while tab was away
          setStatus('completed');
          setAccumulatedMs(saved.targetMs);
          setStartedAtEpoch(null);
        } else {
          setStatus('running');
          setStartedAtEpoch(saved.startedAtEpoch);
          deviceManager.requestWakeLock();
        }
      } else {
        setStatus(saved.status);
        setStartedAtEpoch(null);
      }
    }).catch((err) => {
      console.warn('Timer state load skipped:', err);
    });

    return () => {
      mounted = false;
    };
  }, []);

  // Save changes to Dexie timerState table
  const persistState = useCallback(async (
    newStatus: 'idle' | 'running' | 'paused' | 'completed',
    newStartedAt: number | null,
    newAccumulated: number,
    newTarget: number,
    newMeta: FocusTimerMeta
  ) => {
    const state: TimerPersistedState = {
      key: 'focus',
      status: newStatus,
      startedAtEpoch: newStartedAt,
      accumulatedMs: newAccumulated,
      targetMs: newTarget,
      meta: newMeta,
      updatedAt: Date.now(),
    };
    await db.timerState.put(state);
  }, []);

  // Compute live elapsed Ms derived from Date.now()
  let currentElapsedMs = accumulatedMs;
  if (status === 'running' && startedAtEpoch) {
    currentElapsedMs += Math.max(0, Date.now() - startedAtEpoch);
  }
  const remainingMs = Math.max(0, targetMs - currentElapsedMs);
  const progressPct = targetMs > 0 ? Math.min(100, Math.round((currentElapsedMs / targetMs) * 100)) : 0;

  // Auto-completion detection
  useEffect(() => {
    if (status === 'running' && remainingMs <= 0) {
      // Complete!
      handleSessionFinished();
    }
  }, [status, remainingMs]);

  // RequestAnimationFrame or 1-second interval purely for UI redraw
  useEffect(() => {
    if (status === 'running') {
      const interval = setInterval(() => {
        setRenderTick((t) => t + 1);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [status]);

  // Auto-finish handler
  const handleSessionFinished = async () => {
    soundManager.playIceChime();
    deviceManager.notify('Session Completed! ❄️', `${meta.subjectName} focus session complete.`);
    deviceManager.releaseWakeLock();

    const finalElapsedSec = Math.floor(targetMs / 1000);
    const activeSeason = await db.seasons.where('status').equals('active').first();

    if (activeSeason && meta.mode === 'focus' && meta.subjectId) {
      const todayKey = format(new Date(), 'yyyy-MM-dd');
      await recordFocusSession(
        activeSeason.id,
        todayKey,
        meta.subjectId,
        meta.plannedMin,
        finalElapsedSec,
        'timer'
      );
    }

    setStatus('completed');
    setStartedAtEpoch(null);
    setAccumulatedMs(targetMs);

    const nextPomodoro = meta.mode === 'focus' ? meta.pomodoroCycleCount + 1 : meta.pomodoroCycleCount;
    const nextMeta = { ...meta, pomodoroCycleCount: nextPomodoro };
    setMeta(nextMeta);

    await persistState('completed', null, targetMs, targetMs, nextMeta);
  };

  const startSession = async (
    subjectId: string,
    subjectName: string,
    subjectColor: string,
    minutes: number,
    mode: TimerMode = 'focus'
  ) => {
    deviceManager.requestWakeLock();
    deviceManager.requestNotificationPermission();

    const target = minutes * 60 * 1000;
    const now = Date.now();
    const newMeta: FocusTimerMeta = {
      subjectId,
      subjectName,
      subjectColor,
      plannedMin: minutes,
      mode,
      pomodoroCycleCount: meta.pomodoroCycleCount,
    };

    setStatus('running');
    setStartedAtEpoch(now);
    setAccumulatedMs(0);
    setTargetMs(target);
    setMeta(newMeta);

    await persistState('running', now, 0, target, newMeta);
  };

  const pauseSession = async () => {
    if (status !== 'running' || !startedAtEpoch) return;
    deviceManager.releaseWakeLock();

    const additional = Date.now() - startedAtEpoch;
    const totalAccum = accumulatedMs + additional;

    setStatus('paused');
    setStartedAtEpoch(null);
    setAccumulatedMs(totalAccum);

    await persistState('paused', null, totalAccum, targetMs, meta);
  };

  const resumeSession = async () => {
    if (status !== 'paused') return;
    deviceManager.requestWakeLock();

    const now = Date.now();
    setStatus('running');
    setStartedAtEpoch(now);

    await persistState('running', now, accumulatedMs, targetMs, meta);
  };

  const completeSessionEarly = async () => {
    if (status === 'idle') return;

    let finalSec = Math.floor(currentElapsedMs / 1000);
    deviceManager.releaseWakeLock();
    soundManager.playIceChime();

    const activeSeason = await db.seasons.where('status').equals('active').first();
    if (activeSeason && meta.mode === 'focus' && meta.subjectId && finalSec >= 60) {
      const todayKey = format(new Date(), 'yyyy-MM-dd');
      await recordFocusSession(
        activeSeason.id,
        todayKey,
        meta.subjectId,
        meta.plannedMin,
        finalSec,
        'timer'
      );
    }

    setStatus('idle');
    setStartedAtEpoch(null);
    setAccumulatedMs(0);

    await persistState('idle', null, 0, targetMs, meta);
  };

  const cancelSession = async () => {
    deviceManager.releaseWakeLock();
    setStatus('idle');
    setStartedAtEpoch(null);
    setAccumulatedMs(0);

    await persistState('idle', null, 0, targetMs, meta);
  };

  const switchMode = async (newMode: TimerMode, durationMinutes: number) => {
    deviceManager.releaseWakeLock();
    const newTarget = durationMinutes * 60 * 1000;
    const newMeta: FocusTimerMeta = {
      ...meta,
      mode: newMode,
      plannedMin: durationMinutes,
    };

    setStatus('idle');
    setStartedAtEpoch(null);
    setAccumulatedMs(0);
    setTargetMs(newTarget);
    setMeta(newMeta);

    await persistState('idle', null, 0, newTarget, newMeta);
  };

  const isMiniBarVisible = status === 'running' || status === 'paused';

  return (
    <TimerContext.Provider
      value={{
        status,
        mode: meta.mode,
        targetMs,
        elapsedMs: currentElapsedMs,
        remainingMs,
        progressPct,
        meta,
        startSession,
        pauseSession,
        resumeSession,
        completeSessionEarly,
        cancelSession,
        switchMode,
        isMiniBarVisible,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
};

export const useFocusTimer = () => {
  const ctx = useContext(TimerContext);
  if (!ctx) {
    throw new Error('useFocusTimer must be used within a TimerProvider');
  }
  return ctx;
};
