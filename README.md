# FrostArc ❄️ — 60-Day Student Transformation Web App

> A disciplined command center engineered for Class 11 & 12 students undertaking a 60-day "Winter Arc" transformation covering academics, daily routines, physical conditioning, and momentum.

---

## 1. Product Vision & Architecture

FrostArc is built local-first. Every calculation, streak, shield event, penalty, and timer tick is mathematically verified, persisted in IndexedDB via Dexie, and resilient against network disconnects, tab reloads, and midnight transitions.

```text
+-----------------------------------------------------------------------------------+
|                                  USER INTERFACE                                    |
|   Home (Rings) · Focus Timer · Workout Splits · Routine Timeline · 60-Day Progress |
+-----------------------------------------------------------------------------------+
                                         │
                         Event-Driven Commands Layer
                                         ▼
+-----------------------------------------------------------------------------------+
|                             COMMANDS & RECOMPUTE DAY                              |
|   recomputeDay() inside single Dexie transaction:                                 |
|   1. Completion Engine   2. XP Engine   3. Streak Replay   4. Shield System       |
|   5. Penalty Engine      6. Arc Engine  7. Achievements Evaluation                |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
|                        INDEXEDDB DATA STORE (DEXIE)                               |
|   profile · seasons · subjects · studyTargets · dayInstances · studySessions      |
|   routineTemplates · routineLogs · workoutTemplates · exerciseTemplates           |
|   workoutLogs · workoutSessions · backlog · backlogHistory · penalties            |
|   dailyRecords · xpEvents · shieldEvents · achievementsUnlocked · timerState      |
+-----------------------------------------------------------------------------------+
                                         │
                      (Optional Decoupled Sync Adapter)
                                         ▼
+-----------------------------------------------------------------------------------+
|                                 SUPABASE (RLS)                                    |
+-----------------------------------------------------------------------------------+
```

---

## 2. Core Game Rules & Constants

All constants are isolated in `/src/engine/config.ts`:

- **Completion Weighting**:
  - Study: **40%** (`Σ min(completed, assigned) / Σ assigned`)
  - Routine: **25%** (`done items / total items`)
  - Workout: **25%** (`done exercises / total exercises`, *Rest days automatically excluded & renormalized*)
  - Recovery/Assigned Tasks: **10%** (`penalties completed / assigned`)
  - **Success Threshold**: $\ge 80\%$ (User-calibrated 50–95%)
- **Day States**:
  - `completed`: $\ge \text{threshold}$ (Streak +1)
  - `protected`: $50\% \le \text{score} < \text{threshold}$, shield auto-consumed (Streak frozen)
  - `incomplete` / `missed`: Finalized shortfall (Streak resets to 0)
- **Shield System**:
  - Max held: **3 shields**
  - Earn 1 per 7-day streak milestone (7, 14, 21...) and 1 for completing full scheduled training weeks.
  - Auto-protects scores between 50% and (threshold - 1)% (not applicable on Day 1).
- **Interest Penalties**:
  - Missed study targets converted into recovery study with **1.25x interest** (rounded up to 5 min).
  - Missed routine items repeated once; missed exercises added to upcoming training day.
  - Daily caps: Max +60 min study penalty / day, max 3 penalty items / day, max 5 hours total Arc backlog ceiling. Excess marked `expired`, never silently dropped.
- **XP & Levels**:
  - Level $n$ cumulative XP: $T(n) = 50 \cdot n \cdot (n + 1)$
  - +1 XP per minute of focus study (session $\ge 5$ min, capped at 300 XP/day)
  - +10 full session bonus, +20 subject target met, +3 routine item, +25 all routine, +5 exercise, +40 full workout, +50 successful day, +30 backlog cleared.

---

## 3. Tech Stack

- **React 19 + TypeScript + Vite**
- **Tailwind CSS v4** with glassmorphism design tokens
- **React Router** (`HashRouter` for zero-configuration static hosting)
- **Dexie (IndexedDB)** for local-first single source of truth
- **Vite PWA Plugin** with service worker offline caching, manifest, and in-app install UI
- **Web Audio API** synthesizer for offline audio chimes
- **Vitest** for pure engine unit tests

---

## 4. Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run engine unit tests
npx vitest run

# Build for production
npm run build
```

---

## 5. Deployment

### Static Hosting (Vercel / Netlify / GitHub Pages)
FrostArc is built as a static Single Page Application with client-side IndexedDB persistence and `HashRouter`. Simply build with `npm run build` and publish the `dist/` directory.

### Enabling Supabase Cloud Sync (Optional)
1. Initialize a Supabase project.
2. Create matching tables with `user_id UUID REFERENCES auth.users(id)` and Row Level Security (`CREATE POLICY "user_data" ON table_name FOR ALL USING (auth.uid() = user_id)`).
3. Connect the `SyncAdapter` in `/src/lib/syncAdapter.ts`.
