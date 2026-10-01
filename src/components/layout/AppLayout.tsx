import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { calculateAvailableShields } from '../../engine/shields';
import { replayStreakRecords } from '../../engine/streak';
import { calculateLevelFromXp } from '../../engine/config';
import { computeArcDayNumber } from '../../engine/arc';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import { OfflineIndicator } from '../pwa/OfflineIndicator';
import { MiniTimerBar } from '../timer/MiniTimerBar';
import {
  Home,
  Timer,
  Dumbbell,
  CheckSquare,
  TrendingUp,
  Flame,
  Shield,
  Menu,
  X,
  Settings,
  BookOpen,
  Award,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';

export const AppLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Single source of truth: Dexie live queries
  const profile = useLiveQuery(() => db.profile.get('default'));
  const activeSeason = useLiveQuery(() => db.seasons.where('status').equals('active').first());
  const dailyRecords = useLiveQuery(() => db.dailyRecords.toArray()) || [];
  const shieldEvents = useLiveQuery(() => db.shieldEvents.toArray()) || [];
  const xpEvents = useLiveQuery(() => db.xpEvents.toArray()) || [];

  // Derived live stats
  const availableShields = calculateAvailableShields(shieldEvents);
  const streakStats = replayStreakRecords(dailyRecords);
  const totalXp = xpEvents.reduce((sum, e) => sum + e.amount, 0);
  const levelInfo = calculateLevelFromXp(totalXp);

  const arcDay = activeSeason
    ? Math.max(1, Math.min(60, computeArcDayNumber(activeSeason.startDate, new Date())))
    : 1;

  const navLinks = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/focus', label: 'Focus', icon: Timer },
    { to: '/workout', label: 'Workout', icon: Dumbbell },
    { to: '/routine', label: 'Routine', icon: CheckSquare },
    { to: '/progress', label: 'Progress', icon: TrendingUp },
  ];

  const secondaryLinks = [
    { to: '/backlog', label: 'Syllabus Backlog', icon: BookOpen },
    { to: '/history', label: 'Daily History', icon: Calendar },
    { to: '/achievements', label: 'Achievements', icon: Award },
    { to: '/seasons', label: 'Seasons & Arcs', icon: Layers },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#070B14] text-[#EAF4FF] flex flex-col lg:flex-row pb-20 lg:pb-0">
      {/* Desktop Left Rail Navigation */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-[rgba(160,210,255,0.12)] bg-[#0A101D]/70 backdrop-blur-xl p-5 sticky top-0 h-screen select-none z-30">
        {/* Brand */}
        <div className="flex items-center gap-3 pb-6 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7CC8FF] to-[#3B82F6] flex items-center justify-center font-black text-slate-950 shadow-md">
            ❄️
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
              FrostArc
            </h1>
            <p className="text-[11px] text-[#8FA3BF]">Winter Arc Command</p>
          </div>
        </div>

        {/* Arc Day & Live Status Widget */}
        <div className="my-5 p-3.5 rounded-xl border border-[rgba(160,210,255,0.14)] bg-white/5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white">Day {arcDay} of 60</span>
            <span className="text-[11px] font-bold text-[#7CC8FF]">
              {Math.round((arcDay / 60) * 100)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#7CC8FF] to-[#3B82F6] rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.round((arcDay / 60) * 100))}%` }}
            />
          </div>

          {/* Quick metrics */}
          <div className="flex items-center justify-between pt-1 text-xs">
            <div className="flex items-center gap-1 text-amber-400 font-semibold" title="Current Active Streak">
              <Flame className="w-3.5 h-3.5 fill-amber-400" />
              <span>{streakStats.currentStreak}d</span>
            </div>
            <div className="flex items-center gap-1 text-[#7CC8FF] font-semibold" title="Available Shields (Max 3)">
              <Shield className="w-3.5 h-3.5 fill-[#7CC8FF]/30" />
              <span>{availableShields}/3</span>
            </div>
            <div className="flex items-center gap-1 text-emerald-300 font-semibold" title="Discipline Level">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Lvl {levelInfo.level}</span>
            </div>
          </div>
        </div>

        {/* Primary Nav Links */}
        <nav className="space-y-1 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#8FA3BF] px-3 py-1">
            Command Center
          </p>
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#7CC8FF]/15 text-[#7CC8FF] border border-[#7CC8FF]/30 font-semibold shadow-sm'
                    : 'text-[#8FA3BF] hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#7CC8FF]' : 'text-slate-400'}`} />
                <span>{link.label}</span>
              </NavLink>
            );
          })}

          <div className="pt-4 mt-4 border-t border-white/10">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8FA3BF] px-3 py-1">
              Arc Systems
            </p>
            {secondaryLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-white/10 text-white font-semibold'
                      : 'text-[#8FA3BF] hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 text-slate-400" />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* Bottom PWA Install & Student Profile */}
        <div className="pt-4 border-t border-white/10 space-y-3">
          <PWAInstallButton />
          <div className="flex items-center justify-between text-xs text-[#8FA3BF] px-1">
            <span className="truncate max-w-[120px] font-medium text-white">
              {profile?.name || 'Student'}
            </span>
            <span className="font-tabular text-[11px]">{totalXp} XP</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile / Universal Top Header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-[rgba(160,210,255,0.12)] bg-[#070B14]/80 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#7CC8FF] to-[#3B82F6] flex items-center justify-center text-xs text-slate-950 font-bold">
              ❄️
            </div>
            <div>
              <span className="font-bold text-sm text-white">FrostArc</span>
              <span className="ml-1.5 text-[11px] text-[#7CC8FF] font-semibold">
                D{arcDay}/60
              </span>
            </div>
          </div>

          {/* Quick Mobile Status Chips */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
              <Flame className="w-3 h-3 fill-amber-400" />
              <span>{streakStats.currentStreak}</span>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-[#7CC8FF] bg-[#7CC8FF]/10 px-2 py-0.5 rounded-lg border border-[#7CC8FF]/20">
              <Shield className="w-3 h-3 fill-[#7CC8FF]/30" />
              <span>{availableShields}</span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white bg-white/5 border border-white/10"
              aria-label="Open Secondary Menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Mobile Dropdown Secondary Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 top-14 bg-[#070B14]/95 backdrop-blur-2xl z-40 p-5 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <p className="text-sm font-bold text-white">{profile?.name || 'Student'}</p>
                <p className="text-xs text-[#8FA3BF]">Level {levelInfo.level} · {totalXp} XP</p>
              </div>
              <PWAInstallButton compact />
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8FA3BF] py-1">
                Arc Navigation
              </p>
              {secondaryLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <button
                    key={link.to}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate(link.to);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-200 hover:bg-white/10 text-left transition"
                  >
                    <Icon className="w-4 h-4 text-[#7CC8FF]" />
                    <span>{link.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Page Viewport */}
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-[rgba(160,210,255,0.12)] bg-[#0A101D]/90 backdrop-blur-xl px-2 py-1.5 flex items-center justify-around">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.to;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl min-w-[56px] transition-all ${
                isActive ? 'text-[#7CC8FF]' : 'text-[#8FA3BF] hover:text-white'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              <span className="text-[10px] font-medium mt-0.5">{link.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Global Floating Mini-Timer Bar */}
      <MiniTimerBar />

      {/* Offline Toast Indicator */}
      <OfflineIndicator />
    </div>
  );
};
