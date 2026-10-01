import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { db, type RoutineTemplate } from '../db/db';
import { toggleRoutineItem } from '../commands/userCommands';
import { updateTodaySnapshotFromTemplates } from '../commands/dayMaterializer';
import {
  CheckSquare,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Clock,
  Sparkles,
  Copy,
  Sun,
  Moon,
  Heart,
  BookOpen,
} from 'lucide-react';

export const Routine: React.FC = () => {
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const activeSeason = useLiveQuery(() => db.seasons.where('status').equals('active').first());

  const dayInstance = useLiveQuery(
    () => (activeSeason ? db.dayInstances.get([activeSeason.id, todayKey]) : undefined),
    [activeSeason, todayKey]
  );

  const routineLogs = useLiveQuery(
    () => (activeSeason ? db.routineLogs.where({ seasonId: activeSeason.id, dayKey: todayKey }).toArray() : []),
    [activeSeason, todayKey]
  ) || [];

  const routineTemplates = useLiveQuery(() => db.routineTemplates.orderBy('order').toArray()) || [];

  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('07:00');
  const [newDuration, setNewDuration] = useState(15);
  const [newCategory, setNewCategory] = useState<'morning' | 'study' | 'night' | 'health' | 'custom'>('morning');

  const routineDoneMap = new Map<string, boolean>();
  for (const log of routineLogs) {
    if (log.done) routineDoneMap.set(log.templateItemId, true);
  }

  // Today's active snapshot items
  const todayItems = dayInstance?.snapshot?.routine || [];
  const doneCount = todayItems.filter((i) => routineDoneMap.get(i.id)).length;
  const totalCount = todayItems.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 100;

  const handleAddItem = async () => {
    if (!newTitle.trim()) return;
    const order = routineTemplates.length + 1;
    const newId = `rout_tmpl_${Date.now()}`;

    await db.routineTemplates.put({
      id: newId,
      weekday: -1,
      title: newTitle.trim(),
      startTime: newTime,
      durationMin: newDuration,
      category: newCategory,
      order,
    });

    if (activeSeason) {
      // Re-snapshot today to include new item
      await updateTodaySnapshotFromTemplates(activeSeason, todayKey);
    }

    setNewTitle('');
    setIsAdding(false);
  };

  const handleDeleteItem = async (id: string) => {
    await db.routineTemplates.delete(id);
    if (activeSeason) {
      await updateTodaySnapshotFromTemplates(activeSeason, todayKey);
    }
  };

  const handleMoveItem = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= routineTemplates.length) return;

    const items = [...routineTemplates];
    const temp = items[index];
    items[index] = items[targetIndex];
    items[targetIndex] = temp;

    // Save updated orders
    for (let i = 0; i < items.length; i++) {
      items[i].order = i + 1;
      await db.routineTemplates.put(items[i]);
    }

    if (activeSeason) {
      await updateTodaySnapshotFromTemplates(activeSeason, todayKey);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'morning':
        return <Sun className="w-3.5 h-3.5 text-amber-400" />;
      case 'study':
        return <BookOpen className="w-3.5 h-3.5 text-[#7CC8FF]" />;
      case 'health':
        return <Heart className="w-3.5 h-3.5 text-[#5EE6B8]" />;
      case 'night':
        return <Moon className="w-3.5 h-3.5 text-indigo-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <section className="frost-card p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-[#C084FC]" />
            <h1 className="text-xl font-bold text-white">Daily Routine & Rhythm</h1>
          </div>
          <p className="text-xs text-[#8FA3BF] mt-1">
            Unconscious consistency turns struggle into automatic momentum.
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="font-bold text-white font-tabular">{doneCount} / {totalCount} completed</span>
            <span className="text-[#8FA3BF]">·</span>
            <span className="text-[#C084FC] font-semibold">{pct}% score</span>
            {doneCount === totalCount && totalCount > 0 && (
              <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                +25 XP Bonus
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/15 px-4 py-2 text-xs font-semibold text-white transition active:scale-95 border border-white/10"
        >
          <Plus className="w-4 h-4 text-[#7CC8FF]" />
          <span>Add Routine Item</span>
        </button>
      </section>

      {/* Add New Item Dialog */}
      {isAdding && (
        <section className="frost-card p-5 border-[#7CC8FF]/30 space-y-4 animate-in fade-in">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            Create Routine Habit
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] text-[#8FA3BF] mb-1">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. 10m Formula Recall"
                className="w-full rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#7CC8FF]"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-[11px] text-[#8FA3BF] mb-1">Start Time</label>
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-full rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#7CC8FF]"
              />
            </div>

            <div>
              <label className="block text-[11px] text-[#8FA3BF] mb-1">Duration (min)</label>
              <input
                type="number"
                min={5}
                max={180}
                value={newDuration}
                onChange={(e) => setNewDuration(parseInt(e.target.value) || 15)}
                className="w-full rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#7CC8FF]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#8FA3BF]">Category:</span>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as any)}
                className="bg-white/10 border border-white/15 rounded-lg px-2 py-1 text-xs text-white"
              >
                <option value="morning" className="bg-[#0B1324]">Morning</option>
                <option value="study" className="bg-[#0B1324]">Study</option>
                <option value="health" className="bg-[#0B1324]">Health</option>
                <option value="night" className="bg-[#0B1324]">Night</option>
                <option value="custom" className="bg-[#0B1324]">Custom</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setIsAdding(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-[#8FA3BF] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                className="px-4 py-1.5 rounded-lg bg-[#7CC8FF] text-slate-950 font-bold text-xs hover:brightness-110"
              >
                Save Item
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Routine Timeline Checklist */}
      <section className="frost-card p-5 space-y-2">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white">
            Today's Timeline Checklist
          </h2>
          <span className="text-xs text-[#8FA3BF] font-tabular">+3 XP per item</span>
        </div>

        {todayItems.length === 0 ? (
          <p className="text-xs text-[#8FA3BF] py-6 text-center">
            No routine items configured. Click "Add Routine Item" above to build your daily rhythm.
          </p>
        ) : (
          <div className="space-y-2">
            {todayItems.map((item, idx) => {
              const isDone = !!routineDoneMap.get(item.id);
              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition ${
                    isDone
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  {/* Left: Checkmark & Content */}
                  <div
                    onClick={() => {
                      if (activeSeason) {
                        toggleRoutineItem(
                          activeSeason.id,
                          todayKey,
                          item.id,
                          item.title,
                          !isDone
                        );
                      }
                    }}
                    className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer"
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-500 hover:text-[#7CC8FF] flex-shrink-0" />
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(item.category)}
                        <h3
                          className={`text-sm font-semibold truncate ${
                            isDone ? 'line-through text-[#8FA3BF]' : 'text-white'
                          }`}
                        >
                          {item.title}
                        </h3>
                      </div>
                      <p className="text-[11px] text-[#8FA3BF] font-tabular mt-0.5">
                        {item.startTime} · {item.durationMin} minutes
                      </p>
                    </div>
                  </div>

                  {/* Right: Reorder / Delete Controls */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMoveItem(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-20 transition"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMoveItem(idx, 'down')}
                      disabled={idx === todayItems.length - 1}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-20 transition"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 rounded-lg text-rose-400/60 hover:text-rose-400 transition"
                      title="Delete routine item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
