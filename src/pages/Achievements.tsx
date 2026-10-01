import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { db } from '../db/db';
import { ACHIEVEMENTS } from '../engine/achievements';
import { Award, Sparkles, CheckCircle2 } from 'lucide-react';

export const Achievements: React.FC = () => {
  const unlocked = useLiveQuery(() => db.achievementsUnlocked.toArray()) || [];
  const unlockedMap = new Map<string, number>();
  for (const a of unlocked) {
    unlockedMap.set(a.id, a.unlockedAt);
  }

  const pct = Math.round((unlocked.length / ACHIEVEMENTS.length) * 100);

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'platinum':
        return 'text-cyan-300 border-cyan-400/40 bg-cyan-400/10';
      case 'gold':
        return 'text-amber-300 border-amber-400/40 bg-amber-400/10';
      case 'silver':
        return 'text-slate-200 border-slate-300/40 bg-slate-300/10';
      default:
        return 'text-orange-300 border-orange-400/40 bg-orange-400/10';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <section className="frost-card p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-bold text-white">Discipline Milestones & Trophies</h1>
          </div>
          <p className="text-xs text-[#8FA3BF] mt-1">
            Permanent recognition for high consistency, deep work, and Arc survival.
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs text-[#8FA3BF]">Trophies Unlocked</p>
          <p className="text-xl font-black text-white font-tabular mt-0.5">
            {unlocked.length} <span className="text-xs text-[#8FA3BF]">/ {ACHIEVEMENTS.length}</span>
          </p>
        </div>
      </section>

      {/* Progress Bar */}
      <div className="frost-card p-4 space-y-2">
        <div className="flex justify-between text-xs">
          <span className="font-semibold text-white">Overall Trophy Completion</span>
          <span className="font-bold text-[#7CC8FF] font-tabular">{pct}%</span>
        </div>
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#7CC8FF] to-amber-400 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Grid of all achievements */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ACHIEVEMENTS.map((ach) => {
          const isUnlocked = unlockedMap.has(ach.id);
          const unlockedAt = unlockedMap.get(ach.id);

          return (
            <div
              key={ach.id}
              className={`frost-card p-4 flex items-start gap-3.5 transition-all ${
                isUnlocked
                  ? 'border-[#7CC8FF]/40 bg-[#7CC8FF]/5 shadow-lg shadow-[#7CC8FF]/5'
                  : 'opacity-40 grayscale hover:opacity-60'
              }`}
            >
              <div className="text-2xl flex-shrink-0 p-2 rounded-xl bg-white/5 border border-white/10">
                {ach.icon}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <h3 className="text-xs font-bold text-white truncate">{ach.name}</h3>
                  <span
                    className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border ${getTierColor(
                      ach.tier
                    )}`}
                  >
                    {ach.tier}
                  </span>
                </div>
                <p className="text-[11px] text-[#8FA3BF] mt-1 leading-relaxed">
                  {ach.description}
                </p>

                {isUnlocked && unlockedAt ? (
                  <p className="text-[10px] text-emerald-400 mt-2 font-tabular flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Unlocked {format(new Date(unlockedAt), 'MMM d, yyyy')}</span>
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-500 mt-2 font-tabular">
                    Locked
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
};
