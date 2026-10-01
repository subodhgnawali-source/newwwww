import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Calendar, Shield, Flame, AlertTriangle } from 'lucide-react';

export const History: React.FC = () => {
  const dailyRecords = useLiveQuery(() => db.dailyRecords.toArray()) || [];
  const penalties = useLiveQuery(() => db.penalties.toArray()) || [];

  const sorted = [...dailyRecords].sort((a, b) => b.dayKey.localeCompare(a.dayKey));

  const getDayStateBadge = (state: string) => {
    switch (state) {
      case 'completed':
        return <span className="text-emerald-400 font-bold text-xs">✓ Completed</span>;
      case 'protected':
        return <span className="text-[#7CC8FF] font-bold text-xs">🛡️ Protected</span>;
      case 'missed':
        return <span className="text-rose-400 font-bold text-xs">✕ Missed</span>;
      case 'incomplete':
        return <span className="text-amber-400 font-bold text-xs">▲ Incomplete</span>;
      default:
        return <span className="text-[#8FA3BF] text-xs">{state}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <section className="frost-card p-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#7CC8FF]" />
          <h1 className="text-xl font-bold text-white">Daily History & Records</h1>
        </div>
        <p className="text-xs text-[#8FA3BF] mt-1">
          Immutable historical audit log of every past day in your Arc.
        </p>
      </section>

      <section className="frost-card p-5">
        {sorted.length === 0 ? (
          <p className="text-xs text-[#8FA3BF] py-8 text-center">
            No finalized days yet. When midnight passes or today concludes, daily records are permanently recorded.
          </p>
        ) : (
          <div className="divide-y divide-white/10">
            {sorted.map((record) => {
              const dayPenalties = penalties.filter((p) => p.sourceDayKey === record.dayKey);

              return (
                <div key={record.dayKey} className="py-4 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm text-white font-tabular">
                        {record.dayKey}
                      </span>
                      {getDayStateBadge(record.state)}
                      {record.shieldUsed && (
                        <span className="text-[10px] font-bold bg-[#7CC8FF]/20 text-[#7CC8FF] px-2 py-0.5 rounded-full border border-[#7CC8FF]/30">
                          Shield Consumed
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs font-tabular">
                      <span className="text-emerald-400 font-bold">
                        +{record.xpEarned} XP
                      </span>
                      <span className="text-white font-extrabold text-base">
                        {record.overallPct}%
                      </span>
                    </div>
                  </div>

                  {/* Component Breakdown Strip */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-[#8FA3BF] pt-1">
                    <span>Study: <strong className="text-white font-tabular">{record.studyPct}%</strong></span>
                    <span>·</span>
                    <span>Routine: <strong className="text-white font-tabular">{record.routinePct}%</strong></span>
                    <span>·</span>
                    <span>Workout: <strong className="text-white font-tabular">{record.workoutPct}%</strong></span>
                    <span>·</span>
                    <span>Streak After: <strong className="text-amber-400 font-tabular">{record.streakAfter}d</strong></span>
                  </div>

                  {/* Penalties generated if any */}
                  {dayPenalties.length > 0 && (
                    <div className="pt-2 text-xs text-amber-300/80 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span>{dayPenalties.length} recovery task(s) generated from missed targets.</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
