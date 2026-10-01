import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { db, type TimerPersistedState } from '../../db/db';
import { soundManager } from '../../lib/sound';

export interface RestTimerContextValue {
  status: 'idle' | 'running' | 'paused';
  targetSec: number;
  remainingSec: number;
  elapsedSec: number;
  activeExerciseName: string;
  startRest: (targetSec: number, exerciseName?: string) => Promise<void>;
  pauseRest: () => Promise<void>;
  resumeRest: () => Promise<void>;
  skipRest: () => Promise<void>;
  addSeconds: (sec: number) => Promise<void>;
}

const RestTimerContext = createContext<RestTimerContextValue | null>(null);

export const RestTimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<'idle' | 'running' | 'paused'>('idle');
  const [startedAtEpoch, setStartedAtEpoch] = useState<number | null>(null);
  const [accumulatedMs, setAccumulatedMs] = useState<number>(0);
  const [targetSec, setTargetSec] = useState<number>(60);
  const [activeExerciseName, setActiveExerciseName] = useState<string>('');
  const [tick, setTick] = useState<number>(0);

  // Restore workout rest timer on mount
  useEffect(() => {
    let mounted = true;
    db.timerState.get('workout').then((saved) => {
      if (!mounted || !saved) return;
      const tSec = Math.floor(saved.targetMs / 1000);
      setTargetSec(tSec);
      setAccumulatedMs(saved.accumulatedMs);
      setActiveExerciseName(saved.meta?.exerciseName || '');

      if (saved.status === 'running' && saved.startedAtEpoch) {
        const elapsed = saved.accumulatedMs + (Date.now() - saved.startedAtEpoch);
        if (elapsed >= saved.targetMs) {
          setStatus('idle');
          setAccumulatedMs(0);
          setStartedAtEpoch(null);
        } else {
          setStatus('running');
          setStartedAtEpoch(saved.startedAtEpoch);
        }
      } else {
        setStatus(saved.status === 'running' ? 'paused' : saved.status as any);
        setStartedAtEpoch(null);
      }
    }).catch((err) => {
      console.warn('Workout timer state skipped:', err);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const persistState = useCallback(async (
    newStatus: 'idle' | 'running' | 'paused',
    newStartedAt: number | null,
    newAccumulated: number,
    tSec: number,
    exName: string
  ) => {
    const state: TimerPersistedState = {
      key: 'workout',
      status: newStatus,
      startedAtEpoch: newStartedAt,
      accumulatedMs: newAccumulated,
      targetMs: tSec * 1000,
      meta: { exerciseName: exName },
      updatedAt: Date.now(),
    };
    await db.timerState.put(state);
  }, []);

  let currentElapsedMs = accumulatedMs;
  if (status === 'running' && startedAtEpoch) {
    currentElapsedMs += Math.max(0, Date.now() - startedAtEpoch);
  }
  const currentElapsedSec = Math.floor(currentElapsedMs / 1000);
  const remainingSec = Math.max(0, targetSec - currentElapsedSec);

  // Auto-finish detection
  useEffect(() => {
    if (status === 'running' && remainingSec <= 0) {
      soundManager.playRestBeep();
      setStatus('idle');
      setStartedAtEpoch(null);
      setAccumulatedMs(0);
      persistState('idle', null, 0, targetSec, activeExerciseName);
    }
  }, [status, remainingSec, targetSec, activeExerciseName, persistState]);

  useEffect(() => {
    if (status === 'running') {
      const interval = setInterval(() => setTick((t) => t + 1), 500);
      return () => clearInterval(interval);
    }
  }, [status]);

  const startRest = async (sec: number, exerciseName: string = '') => {
    const now = Date.now();
    setStatus('running');
    setStartedAtEpoch(now);
    setAccumulatedMs(0);
    setTargetSec(sec);
    setActiveExerciseName(exerciseName);
    await persistState('running', now, 0, sec, exerciseName);
  };

  const pauseRest = async () => {
    if (status !== 'running' || !startedAtEpoch) return;
    const additional = Date.now() - startedAtEpoch;
    const totalAccum = accumulatedMs + additional;
    setStatus('paused');
    setStartedAtEpoch(null);
    setAccumulatedMs(totalAccum);
    await persistState('paused', null, totalAccum, targetSec, activeExerciseName);
  };

  const resumeRest = async () => {
    if (status !== 'paused') return;
    const now = Date.now();
    setStatus('running');
    setStartedAtEpoch(now);
    await persistState('running', now, accumulatedMs, targetSec, activeExerciseName);
  };

  const skipRest = async () => {
    setStatus('idle');
    setStartedAtEpoch(null);
    setAccumulatedMs(0);
    await persistState('idle', null, 0, targetSec, activeExerciseName);
  };

  const addSeconds = async (sec: number) => {
    const newTarget = targetSec + sec;
    setTargetSec(newTarget);
    await persistState(status, startedAtEpoch, accumulatedMs, newTarget, activeExerciseName);
  };

  return (
    <RestTimerContext.Provider
      value={{
        status,
        targetSec,
        remainingSec,
        elapsedSec: currentElapsedSec,
        activeExerciseName,
        startRest,
        pauseRest,
        resumeRest,
        skipRest,
        addSeconds,
      }}
    >
      {children}
    </RestTimerContext.Provider>
  );
};

export const useRestTimer = () => {
  const ctx = useContext(RestTimerContext);
  if (!ctx) {
    throw new Error('useRestTimer must be used within a RestTimerProvider');
  }
  return ctx;
};
