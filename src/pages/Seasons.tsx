import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, addDays, parseISO } from 'date-fns';
import { db, type Season } from '../db/db';
import { getOrMaterializeDayInstance } from '../commands/dayMaterializer';
import { Layers, Plus, CheckCircle2, Calendar, Trophy, Flame, Clock } from 'lucide-react';

export const Seasons: React.FC = () => {
  const seasons = useLiveQuery(() => db.seasons.orderBy('number').toArray()) || [];
  const activeSeason = seasons.find((s) => s.status === 'active');

  const [isStartingNew, setIsStartingNew] = useState(false);
  const [newStartDate, setNewStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const handleStartNewSeason = async () => {
    const nextNumber = seasons.length + 1;
    const newSeasonId = `season_${nextNumber}`;
    const start = parseISO(newStartDate);
    const end = addDays(start, 59);

    // Complete previous active season if needed
    if (activeSeason) {
      activeSeason.status = 'completed';
      await db.seasons.put(activeSeason);
    }

    const newSeason: Season = {
      id: newSeasonId,
      number: nextNumber,
      startDate: newStartDate,
      endDate: format(end, 'yyyy-MM-dd'),
      status: 'active',
    };

    await db.seasons.put(newSeason);

    // Copy existing subjects to new season
    if (activeSeason) {
      const prevSubjects = await db.subjects.where('seasonId').equals(activeSeason.id).toArray();
      for (const sub of prevSubjects) {
        await db.subjects.put({
          ...sub,
          id: `sub_${newSeasonId}_${sub.order}`,
          seasonId: newSeasonId,
        });
      }
    }

    await getOrMaterializeDayInstance(newSeason, newStartDate);
    setIsStartingNew(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <section className="frost-card p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#7CC8FF]" />
            <h1 className="text-xl font-bold text-white">Seasons & 60-Day Arcs</h1>
          </div>
          <p className="text-xs text-[#8FA3BF] mt-1">
            Browse past winter arcs or initialize a new transformation campaign.
          </p>
        </div>

        <button
          onClick={() => setIsStartingNew(!isStartingNew)}
          className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 px-4 py-2.5 text-xs font-semibold text-white transition active:scale-95 border border-white/10"
        >
          <Plus className="w-4 h-4 text-[#7CC8FF]" />
          <span>Start New Arc</span>
        </button>
      </section>

      {/* Start New Arc Modal / Panel */}
      {isStartingNew && (
        <section className="frost-card p-6 border-[#7CC8FF]/40 bg-white/5 space-y-4 animate-in fade-in">
          <div>
            <h2 className="text-sm font-bold text-white">Initialize Season {seasons.length + 1}</h2>
            <p className="text-xs text-[#8FA3BF] mt-0.5">
              Starting a new season will mark your current Arc as complete and begin a fresh 60-day cycle.
              Your existing routines and workout splits will be smoothly carried over.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8FA3BF] mb-1.5">
              New Arc Start Date
            </label>
            <input
              type="date"
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.target.value)}
              className="rounded-xl bg-white/10 border border-white/15 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#7CC8FF]"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setIsStartingNew(false)}
              className="px-4 py-2 rounded-xl text-xs text-[#8FA3BF] hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleStartNewSeason}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#7CC8FF] to-[#3B82F6] text-slate-950 font-bold text-xs shadow-md hover:brightness-110 transition"
            >
              Confirm & Launch Season {seasons.length + 1}
            </button>
          </div>
        </section>
      )}

      {/* Seasons list */}
      <section className="space-y-4">
        {seasons.map((season) => {
          const isActive = season.status === 'active';
          return (
            <div
              key={season.id}
              className={`frost-card p-5 border transition ${
                isActive ? 'border-[#7CC8FF]/40 bg-[#7CC8FF]/5' : 'border-white/10 bg-white/5'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                      isActive
                        ? 'bg-[#7CC8FF] text-slate-950'
                        : 'bg-white/10 text-white'
                    }`}
                  >
                    S{season.number}
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Season {season.number}: 60-Day Arc</span>
                      {isActive && (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          Active Arc
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-[#8FA3BF] font-tabular mt-0.5">
                      {season.startDate} to {season.endDate}
                    </p>
                  </div>
                </div>

                <span className="text-xs text-[#8FA3BF]">
                  Status: <strong className="text-white capitalize">{season.status}</strong>
                </span>
              </div>

              {/* Summary if completed */}
              {season.summary && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[#8FA3BF]">Total Focus:</span>
                    <p className="text-sm font-bold text-white mt-0.5">
                      {season.summary.totalFocusHours} hrs
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[#8FA3BF]">Longest Streak:</span>
                    <p className="text-sm font-bold text-amber-400 mt-0.5">
                      {season.summary.longestStreak} days
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[#8FA3BF]">Success Rate:</span>
                    <p className="text-sm font-bold text-emerald-400 mt-0.5">
                      {season.summary.overallSuccessRate}%
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[#8FA3BF]">Final Level:</span>
                    <p className="text-sm font-bold text-[#7CC8FF] mt-0.5">
                      Level {season.summary.finalLevel}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
};
