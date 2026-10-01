import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { rebuildAll } from '../commands/userCommands';
import { PWAInstallButton } from '../components/pwa/PWAInstallButton';
import {
  Settings as SettingsIcon,
  Shield,
  Download,
  Upload,
  RefreshCw,
  AlertOctagon,
  CheckCircle2,
  Volume2,
  VolumeX,
  Sparkles,
  Cloud,
} from 'lucide-react';

export const Settings: React.FC = () => {
  const profile = useLiveQuery(() => db.profile.get('default'));

  const [name, setName] = useState('');
  const [threshold, setThreshold] = useState(80);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [rebuildResult, setRebuildResult] = useState<any>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);
  const [saveToast, setSaveToast] = useState(false);

  // Sync state with loaded profile
  React.useEffect(() => {
    if (profile) {
      setName(profile.name);
      setThreshold(profile.settings.successThreshold);
      setSoundEnabled(profile.settings.soundEnabled ?? true);
      setReducedMotion(profile.settings.reducedMotion ?? false);
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!profile) return;
    await db.profile.put({
      ...profile,
      name: name.trim() || profile.name,
      settings: {
        ...profile.settings,
        successThreshold: threshold,
        soundEnabled,
        reducedMotion,
      },
    });
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  const handleRebuild = async () => {
    setIsRebuilding(true);
    try {
      const res = await rebuildAll();
      setRebuildResult(res);
    } finally {
      setIsRebuilding(false);
    }
  };

  const handleExportData = async () => {
    const data: Record<string, any> = {};
    for (const table of db.tables) {
      data[table.name] = await table.toArray();
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `frostarc-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        await db.transaction('rw', db.tables, async () => {
          for (const table of db.tables) {
            if (json[table.name]) {
              await table.clear();
              await table.bulkPut(json[table.name]);
            }
          }
        });
        alert('Data successfully imported! The app will reload.');
        window.location.reload();
      } catch (err) {
        alert('Failed to import backup file. Ensure it is a valid FrostArc JSON export.');
      }
    };
    reader.readAsText(file);
  };

  const handleResetAllData = async () => {
    if (confirmText !== 'RESET ARC') return;
    await db.delete();
    window.location.reload();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <section className="frost-card p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-[#7CC8FF]" />
            <h1 className="text-xl font-bold text-white">Arc Settings & System Controls</h1>
          </div>
          <p className="text-xs text-[#8FA3BF] mt-1">
            Configure student parameters, audit mechanics, data backups, and rebuild calculations.
          </p>
        </div>

        {saveToast && (
          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 animate-in fade-in">
            ✓ Settings Saved
          </span>
        )}
      </section>

      {/* Profile & Discipline Calibration */}
      <section className="frost-card p-6 space-y-4">
        <h2 className="text-sm font-bold text-white">Student Profile & Discipline Standard</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#8FA3BF] mb-1.5">
              Callsign / Student Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7CC8FF]"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-[#8FA3BF]">
                Success Threshold
              </label>
              <span className="text-xs font-bold text-[#7CC8FF] font-tabular">{threshold}%</span>
            </div>
            <input
              type="range"
              min={50}
              max={95}
              step={5}
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value))}
              className="w-full accent-[#7CC8FF] cursor-pointer mt-2"
            />
            <div className="flex justify-between text-[10px] text-[#8FA3BF] mt-1">
              <span>50%</span>
              <span>80% (Standard)</span>
              <span>95%</span>
            </div>
          </div>
        </div>

        {/* Audio & Motion Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition text-left"
          >
            <div className="flex items-center gap-3">
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-[#7CC8FF]" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-500" />
              )}
              <div>
                <p className="text-xs font-semibold text-white">Acoustic Chimes</p>
                <p className="text-[10px] text-[#8FA3BF]">Web Audio synthesizer sound alerts</p>
              </div>
            </div>
            <span className={`text-xs font-bold ${soundEnabled ? 'text-[#7CC8FF]' : 'text-slate-500'}`}>
              {soundEnabled ? 'ON' : 'OFF'}
            </span>
          </button>

          <button
            onClick={() => setReducedMotion(!reducedMotion)}
            className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition text-left"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-[#5EE6B8]" />
              <div>
                <p className="text-xs font-semibold text-white">Reduced Motion</p>
                <p className="text-[10px] text-[#8FA3BF]">Disable animations & confetti</p>
              </div>
            </div>
            <span className={`text-xs font-bold ${reducedMotion ? 'text-emerald-400' : 'text-slate-500'}`}>
              {reducedMotion ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSaveProfile}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7CC8FF] to-[#3B82F6] text-slate-950 font-bold text-xs shadow-md hover:brightness-110 active:scale-95 transition"
          >
            Save Profile Settings
          </button>
        </div>
      </section>

      {/* Cloud Sync & Architecture Section */}
      <section className="frost-card p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Cloud className="w-5 h-5 text-[#7CC8FF]" />
            <div>
              <h2 className="text-sm font-bold text-white">Cloud Sync Adapter</h2>
              <p className="text-xs text-[#8FA3BF]">
                100% offline-first by design. All data stays local in IndexedDB.
              </p>
            </div>
          </div>
          <button
            onClick={() => setCloudSyncEnabled(!cloudSyncEnabled)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
              cloudSyncEnabled
                ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                : 'border-white/10 bg-white/5 text-[#8FA3BF]'
            }`}
          >
            {cloudSyncEnabled ? 'Adapter Ready' : 'Local Only'}
          </button>
        </div>

        <p className="text-xs text-[#8FA3BF] leading-relaxed">
          FrostArc operates completely without any user account or cloud backend. An optional
          <code className="mx-1 px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[11px]">SyncAdapter</code>
          interface is included for Supabase with Row Level Security.
        </p>
      </section>

      {/* Data Verification & Maintenance */}
      <section className="frost-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-[#7CC8FF]" />
          <h2 className="text-sm font-bold text-white">Audited Maintenance & Stat Rebuild</h2>
        </div>
        <p className="text-xs text-[#8FA3BF]">
          All derived stats (streaks, XP totals, levels, and achievements) can be verified and
          recomputed from raw fact logs at any time.
        </p>

        <button
          onClick={handleRebuild}
          disabled={isRebuilding}
          className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 px-4 py-2.5 text-xs font-semibold text-white transition active:scale-95 disabled:opacity-50 border border-white/10"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#7CC8FF] ${isRebuilding ? 'animate-spin' : ''}`} />
          <span>{isRebuilding ? 'Rebuilding Records...' : 'Verify & Rebuild Stats'}</span>
        </button>

        {rebuildResult && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 space-y-1 animate-in fade-in">
            <p className="font-bold">✓ Audit Rebuild Complete</p>
            <p className="text-[#8FA3BF]">
              Rebuilt {rebuildResult.totalRecordsRebuilt} daily records · Current Streak: {rebuildResult.currentStreak}d · Total XP: {rebuildResult.totalXp} · Level: {rebuildResult.level}
            </p>
          </div>
        )}
      </section>

      {/* Backup Export / Import */}
      <section className="frost-card p-6 space-y-4">
        <h2 className="text-sm font-bold text-white">Data Portability (JSON Backup)</h2>
        <p className="text-xs text-[#8FA3BF]">
          Export your entire Arc database (sessions, logs, routines, workouts, penalties) as a
          portable JSON file, or restore a previous backup.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportData}
            className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 px-4 py-2.5 text-xs font-semibold text-white transition active:scale-95 border border-white/10"
          >
            <Download className="w-3.5 h-3.5 text-[#7CC8FF]" />
            <span>Export JSON Backup</span>
          </button>

          <label className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 px-4 py-2.5 text-xs font-semibold text-white transition active:scale-95 border border-white/10 cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-[#5EE6B8]" />
            <span>Restore From File</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportData}
              className="hidden"
            />
          </label>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="frost-card p-6 border-rose-500/30 bg-rose-950/15 space-y-4">
        <div className="flex items-center gap-2 text-rose-400">
          <AlertOctagon className="w-4 h-4" />
          <h2 className="text-sm font-bold">Danger Zone: Complete Reset</h2>
        </div>
        <p className="text-xs text-rose-300/80 leading-relaxed">
          Wipes the local IndexedDB database entirely, deleting all seasons, logs, profiles, and
          records. This cannot be undone.
        </p>

        {showResetConfirm ? (
          <div className="space-y-3 pt-2">
            <p className="text-xs text-white">
              Type <strong className="text-rose-400">RESET ARC</strong> below to confirm:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="RESET ARC"
              className="w-full max-w-xs rounded-xl bg-rose-950/40 border border-rose-500/40 px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-400"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleResetAllData}
                disabled={confirmText !== 'RESET ARC'}
                className="px-4 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-500 disabled:opacity-30 transition"
              >
                Permanently Wipe Database
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-4 py-2 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-semibold border border-rose-500/30 transition active:scale-95"
          >
            Reset All Arc Data...
          </button>
        )}
      </section>
    </div>
  );
};
