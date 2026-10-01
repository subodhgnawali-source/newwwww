import React, { useEffect, useState, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type UserProfile, type Season } from './db/db';
import { auditPendingDays } from './commands/auditPendingDays';
import { TimerProvider } from './features/timer/TimerContext';
import { RestTimerProvider } from './features/workout/RestTimerContext';
import { AppLayout } from './components/layout/AppLayout';
import { Onboarding } from './pages/Onboarding';
import { Home } from './pages/Home';
import { Focus } from './pages/Focus';
import { Workout } from './pages/Workout';
import { Routine } from './pages/Routine';
import { Progress } from './pages/Progress';
import { Backlog } from './pages/Backlog';
import { History } from './pages/History';
import { Achievements } from './pages/Achievements';
import { Seasons } from './pages/Seasons';
import { Settings } from './pages/Settings';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);

  // Live queries to stay reactive after any updates
  const liveProfile = useLiveQuery(async () => {
    try {
      const p = await db.profile.get('default');
      return p ?? null;
    } catch {
      return null;
    }
  });

  const liveSeason = useLiveQuery(async () => {
    try {
      const s = await db.seasons.where('status').equals('active').first();
      return s ?? null;
    } catch {
      return null;
    }
  });

  const loadData = useCallback(async () => {
    try {
      await db.open();
      const p = await db.profile.get('default');
      const s = await db.seasons.where('status').equals('active').first();
      setProfile(p ?? null);
      setActiveSeason(s ?? null);
    } catch (err) {
      console.error('Dexie open error:', err);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Safety fallback timeout to prevent ever getting stuck on initializing
    const timer = setTimeout(() => setIsReady(true), 500);
    return () => clearTimeout(timer);
  }, [loadData]);

  // Synchronize with live query when emitted
  const currentProfile = liveProfile !== undefined ? liveProfile : profile;
  const currentSeason = liveSeason !== undefined ? liveSeason : activeSeason;

  // Catch-up audit on open & on tab visibility change / focus
  useEffect(() => {
    if (!currentProfile || !currentSeason) return;

    const runAudit = async () => {
      try {
        await auditPendingDays();
      } catch (err) {
        console.error('Audit failed:', err);
      }
    };

    runAudit();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runAudit();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', runAudit);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', runAudit);
    };
  }, [currentProfile?.id, currentSeason?.id]);

  // Loading state while checking IndexedDB
  if (!isReady) {
    return (
      <div className="min-h-screen bg-[#070B14] flex flex-col items-center justify-center text-[#EAF4FF]">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#7CC8FF] to-[#3B82F6] flex items-center justify-center font-bold text-slate-950 text-xl shadow-xl animate-pulse">
          ❄️
        </div>
        <p className="mt-4 text-xs font-semibold tracking-wider text-[#8FA3BF] uppercase">
          Initializing FrostArc...
        </p>
      </div>
    );
  }

  // If student hasn't completed onboarding yet
  if (!currentProfile || !currentSeason) {
    return <Onboarding onComplete={loadData} />;
  }

  return (
    <TimerProvider>
      <RestTimerProvider>
        <HashRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/focus" element={<Focus />} />
              <Route path="/workout" element={<Workout />} />
              <Route path="/routine" element={<Routine />} />
              <Route path="/progress" element={<Progress />} />
              <Route path="/backlog" element={<Backlog />} />
              <Route path="/history" element={<History />} />
              <Route path="/achievements" element={<Achievements />} />
              <Route path="/seasons" element={<Seasons />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </RestTimerProvider>
    </TimerProvider>
  );
}
