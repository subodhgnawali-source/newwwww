import React, { useState } from 'react';
import { format, addDays, parseISO } from 'date-fns';
import { db } from '../db/db';
import { STARTER_SUBJECT_PRESETS, STARTER_ROUTINE, STARTER_WORKOUT_SPLIT } from '../features/onboarding/defaultTemplates';
import { getOrMaterializeDayInstance } from '../commands/dayMaterializer';
import { Flame, ArrowRight, ArrowLeft, Check, Sparkles, BookOpen, Clock, Dumbbell, ShieldAlert } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Identity & Timing
  const [name, setName] = useState('');
  const [startDateStr, setStartDateStr] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Step 2: Subject Stream
  const [selectedStream, setSelectedStream] = useState<string>('science_pcm');
  const [subjectsList, setSubjectsList] = useState(STARTER_SUBJECT_PRESETS.science_pcm);

  // Step 3: Success threshold & Daily rhythm
  const [successThreshold, setSuccessThreshold] = useState<number>(80);

  const handleStreamChange = (streamKey: string) => {
    setSelectedStream(streamKey);
    setSubjectsList(STARTER_SUBJECT_PRESETS[streamKey] || STARTER_SUBJECT_PRESETS.general);
  };

  const updateSubjectMinutes = (idx: number, mins: number) => {
    const updated = [...subjectsList];
    updated[idx] = { ...updated[idx], defaultMinutes: Math.max(15, mins) };
    setSubjectsList(updated);
  };

  const handleFinish = async () => {
    if (!name.trim()) return;

    const startDate = parseISO(startDateStr);
    const endDate = addDays(startDate, 59);
    const endDateStr = format(endDate, 'yyyy-MM-dd');
    const seasonId = 'season_1';
    const now = Date.now();

    // 1. Profile
    await db.profile.put({
      id: 'default',
      name: name.trim(),
      createdAt: now,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      settings: {
        successThreshold,
        focusMin: 25,
        breakMin: 5,
        longBreakMin: 15,
        reducedMotion: false,
        weekStart: 1, // Monday
        soundEnabled: true,
      },
    });

    // 2. Season 1
    const season = {
      id: seasonId,
      number: 1,
      startDate: startDateStr,
      endDate: endDateStr,
      status: 'active' as const,
    };
    await db.seasons.put(season);

    // 3. Subjects & Study Targets & Initial Backlog
    let order = 1;
    for (const sub of subjectsList) {
      const subjectId = `sub_${Date.now()}_${order}_${Math.random().toString(36).slice(2, 6)}`;
      await db.subjects.put({
        id: subjectId,
        seasonId,
        name: sub.name,
        color: sub.color,
        order,
        archived: false,
      });

      // Study targets for each day of week (0 to 6)
      // Sundays slightly lighter by default (e.g. 50% target or full)
      for (let day = 0; day <= 6; day++) {
        const mins = day === 0 ? Math.round(sub.defaultMinutes * 0.6) : sub.defaultMinutes;
        await db.studyTargets.put({
          id: `target_${subjectId}_${day}`,
          subjectId,
          weekday: day,
          minutes: mins,
        });
      }

      // Initial backlog tracker
      await db.backlog.put({
        id: `backlog_${subjectId}`,
        subjectId,
        status: 'up_to_date',
        note: 'All current chapters & notes up to date',
        updatedAt: now,
      });

      order++;
    }

    // 4. Routine Templates
    for (const r of STARTER_ROUTINE) {
      await db.routineTemplates.put({
        id: `rout_tmpl_${r.order}`,
        weekday: -1, // applies all days
        title: r.title,
        startTime: r.startTime,
        durationMin: r.durationMin,
        category: r.category,
        order: r.order,
      });
    }

    // 5. Workout Templates & Exercises
    for (const w of STARTER_WORKOUT_SPLIT) {
      const workoutTmplId = `work_tmpl_${w.weekday}`;
      await db.workoutTemplates.put({
        id: workoutTmplId,
        weekday: w.weekday,
        isRest: w.isRest,
        name: w.name,
      });

      if (!w.isRest && w.exercises) {
        for (const ex of w.exercises) {
          await db.exerciseTemplates.put({
            id: `ex_tmpl_${w.weekday}_${ex.order}`,
            workoutTemplateId: workoutTmplId,
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            durationSec: (ex as any).durationSec,
            restSec: ex.restSec,
            order: ex.order,
          });
        }
      }
    }

    // 6. Materialize Day 1
    await getOrMaterializeDayInstance(season, startDateStr);

    onComplete();
  };

  return (
    <div className="min-h-screen bg-[#070B14] flex flex-col justify-center items-center p-4 sm:p-6 text-[#EAF4FF]">
      {/* Background glowing ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#7CC8FF]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-80 h-80 bg-[#3B82F6]/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-xl frost-card p-6 sm:p-8 shadow-2xl border border-[rgba(160,210,255,0.18)]">
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7CC8FF] to-[#3B82F6] flex items-center justify-center text-slate-950 font-black shadow-lg">
              ❄️
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                FrostArc
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-[#7CC8FF]/20 text-[#7CC8FF]">
                  60-Day Arc
                </span>
              </h1>
              <p className="text-xs text-[#8FA3BF]">Step {step} of 3 · Student Transformation Setup</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <div className={`w-6 h-1.5 rounded-full transition-all ${step >= 1 ? 'bg-[#7CC8FF]' : 'bg-white/10'}`} />
            <div className={`w-6 h-1.5 rounded-full transition-all ${step >= 2 ? 'bg-[#7CC8FF]' : 'bg-white/10'}`} />
            <div className={`w-6 h-1.5 rounded-full transition-all ${step >= 3 ? 'bg-[#7CC8FF]' : 'bg-white/10'}`} />
          </div>
        </div>

        {/* Step 1: Name and Start Date */}
        {step === 1 && (
          <div className="py-6 space-y-6 animate-in fade-in">
            <div>
              <h2 className="text-lg font-semibold text-white">Enter the Arc</h2>
              <p className="text-xs text-[#8FA3BF] mt-1">
                Your 60-day winter arc begins with commitment. Choose your callsign and starting day.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#8FA3BF] mb-2">
                  Student Name or Callsign
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex, Rahul, Maya"
                  className="w-full rounded-xl bg-white/5 border border-[rgba(160,210,255,0.2)] px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#7CC8FF] focus:ring-1 focus:ring-[#7CC8FF] transition"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#8FA3BF] mb-2">
                  Arc Start Date
                </label>
                <input
                  type="date"
                  value={startDateStr}
                  onChange={(e) => setStartDateStr(e.target.value)}
                  className="w-full rounded-xl bg-white/5 border border-[rgba(160,210,255,0.2)] px-4 py-3 text-sm text-white focus:outline-none focus:border-[#7CC8FF] transition"
                />
                <p className="text-[11px] text-[#8FA3BF] mt-1.5">
                  The Arc runs 60 consecutive calendar days from this date.
                </p>
              </div>

              <div className="rounded-xl border border-[rgba(160,210,255,0.14)] bg-white/5 p-4 text-xs text-[#8FA3BF] space-y-2">
                <div className="flex items-center gap-2 text-white font-medium">
                  <ShieldAlert className="w-4 h-4 text-[#7CC8FF]" />
                  <span>The Rules of FrostArc</span>
                </div>
                <p>• 80% daily completion required to earn streak + XP bonuses.</p>
                <p>• Off-days below 80% can be auto-protected by Shields (up to 3 held).</p>
                <p>• Missed targets create fair 1.25x Interest Penalties scheduled into future days.</p>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!name.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7CC8FF] to-[#3B82F6] py-3 text-sm font-semibold text-slate-950 shadow-md hover:brightness-110 active:scale-98 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Continue to Subjects</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: Subject Stream & Study Targets */}
        {step === 2 && (
          <div className="py-6 space-y-6 animate-in fade-in">
            <div>
              <h2 className="text-lg font-semibold text-white">Academic Focus & Syllabus</h2>
              <p className="text-xs text-[#8FA3BF] mt-1">
                Select your academic stream and customize daily focus targets.
              </p>
            </div>

            {/* Stream selector */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'science_pcm', label: 'PCM', desc: 'Physics, Chem, Math' },
                { id: 'science_pcb', label: 'PCB', desc: 'Physics, Chem, Bio' },
                { id: 'commerce', label: 'Commerce', desc: 'Accounts, Eco, Math' },
                { id: 'general', label: 'Custom', desc: 'Self-tailored' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleStreamChange(s.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedStream === s.id
                      ? 'border-[#7CC8FF] bg-[#7CC8FF]/15 text-white shadow-md'
                      : 'border-white/10 bg-white/5 text-[#8FA3BF] hover:bg-white/10'
                  }`}
                >
                  <p className="font-semibold text-xs text-white">{s.label}</p>
                  <p className="text-[10px] text-[#8FA3BF] mt-0.5">{s.desc}</p>
                </button>
              ))}
            </div>

            {/* Subject targets adjustment */}
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {subjectsList.map((sub, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: sub.color }}
                    />
                    <span className="text-sm font-medium text-white">{sub.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step={15}
                      min={15}
                      max={240}
                      value={sub.defaultMinutes}
                      onChange={(e) => updateSubjectMinutes(idx, parseInt(e.target.value) || 30)}
                      className="w-16 rounded-lg bg-white/10 border border-white/15 px-2 py-1 text-xs text-center text-white font-tabular"
                    />
                    <span className="text-xs text-[#8FA3BF]">min/day</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm text-[#8FA3BF] hover:text-white transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7CC8FF] to-[#3B82F6] py-3 text-sm font-semibold text-slate-950 shadow-md hover:brightness-110 active:scale-98 transition"
              >
                <span>Continue to Rhythm</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Success Threshold & Routine Overview */}
        {step === 3 && (
          <div className="py-6 space-y-6 animate-in fade-in">
            <div>
              <h2 className="text-lg font-semibold text-white">Daily Standard & Discipline</h2>
              <p className="text-xs text-[#8FA3BF] mt-1">
                Calibrate the daily success threshold and review your routine and workout splits.
              </p>
            </div>

            {/* Threshold slider */}
            <div className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-white">Daily Success Threshold</span>
                <span className="text-sm font-bold text-[#7CC8FF] font-tabular">{successThreshold}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={95}
                step={5}
                value={successThreshold}
                onChange={(e) => setSuccessThreshold(parseInt(e.target.value))}
                className="w-full accent-[#7CC8FF] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#8FA3BF]">
                <span>50% (Forgiving)</span>
                <span>80% (Recommended Standard)</span>
                <span>95% (Hardcore)</span>
              </div>
            </div>

            {/* Included starters overview */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl border border-white/10 bg-white/5 space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <Clock className="w-4 h-4 text-[#7CC8FF]" />
                  <span>Routine Starter</span>
                </div>
                <p className="text-[11px] text-[#8FA3BF]">
                  7 daily items: Morning cold splash, formula review, deep blocks, audit, screen curfew.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-white/10 bg-white/5 space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <Dumbbell className="w-4 h-4 text-[#5EE6B8]" />
                  <span>Workout Split</span>
                </div>
                <p className="text-[11px] text-[#8FA3BF]">
                  Push, Pull, Legs, Conditioning + 2 intentional rest days. No equipment required.
                </p>
              </div>
            </div>

            <p className="text-[11px] text-center text-[#8FA3BF]">
              All routines, workout exercises, and study targets can be fully customized anytime in the app.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm text-[#8FA3BF] hover:text-white transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                onClick={handleFinish}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7CC8FF] via-[#5EE6B8] to-[#3B82F6] py-3 text-sm font-bold text-slate-950 shadow-xl hover:brightness-110 active:scale-98 transition"
              >
                <Flame className="w-4 h-4 text-slate-950 fill-slate-950" />
                <span>Ignite 60-Day Arc</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
