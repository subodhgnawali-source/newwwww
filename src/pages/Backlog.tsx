import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { db } from '../db/db';
import { updateBacklogStatus } from '../commands/userCommands';
import {
  BookOpen,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Sparkles,
  History,
  Edit2,
  Check,
} from 'lucide-react';

export const Backlog: React.FC = () => {
  const activeSeason = useLiveQuery(() => db.seasons.where('status').equals('active').first());
  const subjects = useLiveQuery(
    () => (activeSeason ? db.subjects.where('seasonId').equals(activeSeason.id).filter((s) => !s.archived).sortBy('order') : []),
    [activeSeason]
  ) || [];

  const backlogItems = useLiveQuery(() => db.backlog.toArray()) || [];
  const backlogHistory = useLiveQuery(() => db.backlogHistory.orderBy('timestamp').reverse().limit(20).toArray()) || [];

  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const backlogMap = new Map<string, any>();
  for (const b of backlogItems) {
    backlogMap.set(b.subjectId, b);
  }

  const pendingCount = backlogItems.filter((b) => b.status === 'pending').length;
  const upToDateCount = subjects.length - pendingCount;

  const handleToggle = async (subjectId: string, currentStatus: string, currentNote: string) => {
    const nextStatus = currentStatus === 'up_to_date' ? 'pending' : 'up_to_date';
    await updateBacklogStatus(subjectId, nextStatus, currentNote);
  };

  const handleSaveNote = async (subjectId: string, currentStatus: string) => {
    await updateBacklogStatus(subjectId, currentStatus as any, noteText);
    setEditingSubjectId(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <section className="frost-card p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#7CC8FF]" />
            <h1 className="text-xl font-bold text-white">Syllabus & Notes Backlog Matrix</h1>
          </div>
          <p className="text-xs text-[#8FA3BF] mt-1">
            Track syllabus debts, missing lecture notes, and chapter backlogs.
          </p>
          <div className="mt-3 flex items-center gap-3 text-xs">
            <span className="text-emerald-400 font-bold">{upToDateCount} Up to Date</span>
            <span className="text-[#8FA3BF]">·</span>
            <span className="text-amber-400 font-bold">{pendingCount} Pending</span>
            <span className="text-[#8FA3BF]">·</span>
            <span className="text-[#7CC8FF]">+30 XP when cleared</span>
          </div>
        </div>
      </section>

      {/* Backlog Grid */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-white">
          Subject Syllabus Status
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {subjects.map((sub) => {
            const item = backlogMap.get(sub.id);
            const status = item?.status || 'up_to_date';
            const note = item?.note || 'Up to date with syllabus';
            const isPending = status === 'pending';
            const isEditing = editingSubjectId === sub.id;

            return (
              <div
                key={sub.id}
                className={`frost-card p-5 border transition flex flex-col justify-between ${
                  isPending
                    ? 'border-amber-500/30 bg-amber-950/15'
                    : 'border-emerald-500/20 bg-emerald-950/10'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-white/5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: sub.color }}
                      />
                      <h3 className="text-sm font-bold text-white">{sub.name}</h3>
                    </div>

                    <button
                      onClick={() => handleToggle(sub.id, status, note)}
                      className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 transition active:scale-95 ${
                        isPending
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {isPending ? (
                        <>
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Pending Backlog</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Up to Date</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Note text / edit */}
                  <div className="mt-3">
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="e.g. Chapter 4 Electromagnetism numericals pending..."
                          rows={2}
                          className="w-full rounded-xl bg-white/10 border border-white/20 p-2 text-xs text-white focus:outline-none focus:border-[#7CC8FF]"
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingSubjectId(null)}
                            className="px-2.5 py-1 text-xs text-[#8FA3BF] hover:text-white"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveNote(sub.id, status)}
                            className="px-3 py-1 rounded-lg bg-[#7CC8FF] text-slate-950 font-bold text-xs"
                          >
                            Save Note
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs text-[#8FA3BF] italic">{note}</p>
                        <button
                          onClick={() => {
                            setEditingSubjectId(sub.id);
                            setNoteText(note);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-white"
                          title="Edit note"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-[#8FA3BF]">
                  <span>Last audited: {item?.updatedAt ? format(new Date(item.updatedAt), 'MMM d, h:mm a') : 'Recently'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Backlog Audit History */}
      <section className="frost-card p-5">
        <div className="flex items-center gap-2 pb-3 border-b border-white/10">
          <History className="w-4 h-4 text-[#7CC8FF]" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-white">
            Audit History Log
          </h2>
        </div>

        {backlogHistory.length === 0 ? (
          <p className="text-xs text-[#8FA3BF] py-4 text-center">
            No backlog audit events recorded yet.
          </p>
        ) : (
          <div className="divide-y divide-white/5 mt-2">
            {backlogHistory.map((h) => {
              const sub = subjects.find((s) => s.id === h.subjectId);
              return (
                <div key={h.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-white">{sub?.name || 'Subject'}: </span>
                    <span className="text-[#8FA3BF]">
                      changed to <strong className="text-white">{h.toStatus}</strong>
                    </span>
                    {h.note && <span className="text-[#8FA3BF] italic"> — "{h.note}"</span>}
                  </div>
                  <span className="text-[11px] text-[#8FA3BF] font-tabular">
                    {format(new Date(h.timestamp), 'MMM d, h:mm a')}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
