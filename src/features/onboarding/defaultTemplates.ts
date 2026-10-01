export interface StarterSubject {
  name: string;
  color: string;
  defaultMinutes: number;
}

export const STARTER_SUBJECT_PRESETS: Record<string, StarterSubject[]> = {
  science_pcm: [
    { name: 'Physics', color: '#38BDF8', defaultMinutes: 75 },
    { name: 'Chemistry', color: '#34D399', defaultMinutes: 60 },
    { name: 'Mathematics', color: '#818CF8', defaultMinutes: 75 },
    { name: 'Computer Science', color: '#FBBF24', defaultMinutes: 45 },
    { name: 'English / General', color: '#C084FC', defaultMinutes: 30 },
  ],
  science_pcb: [
    { name: 'Physics', color: '#38BDF8', defaultMinutes: 75 },
    { name: 'Chemistry', color: '#34D399', defaultMinutes: 60 },
    { name: 'Biology', color: '#10B981', defaultMinutes: 90 },
    { name: 'English', color: '#C084FC', defaultMinutes: 30 },
    { name: 'Revision / Notes', color: '#F472B6', defaultMinutes: 45 },
  ],
  commerce: [
    { name: 'Accountancy', color: '#38BDF8', defaultMinutes: 75 },
    { name: 'Economics', color: '#34D399', defaultMinutes: 60 },
    { name: 'Business Studies', color: '#FBBF24', defaultMinutes: 60 },
    { name: 'Applied Math', color: '#818CF8', defaultMinutes: 60 },
    { name: 'English', color: '#C084FC', defaultMinutes: 30 },
  ],
  general: [
    { name: 'Core Subject 1', color: '#38BDF8', defaultMinutes: 60 },
    { name: 'Core Subject 2', color: '#34D399', defaultMinutes: 60 },
    { name: 'Core Subject 3', color: '#818CF8', defaultMinutes: 60 },
    { name: 'Elective / Prep', color: '#FBBF24', defaultMinutes: 45 },
    { name: 'Language / Writing', color: '#C084FC', defaultMinutes: 30 },
  ],
};

export const STARTER_ROUTINE = [
  { title: 'Morning Cold Splash & Water', startTime: '06:00', durationMin: 15, category: 'morning' as const, order: 1 },
  { title: 'Prime Formula / Flashcard Review', startTime: '06:20', durationMin: 40, category: 'study' as const, order: 2 },
  { title: 'Daily Deep Study Block 1', startTime: '16:30', durationMin: 75, category: 'study' as const, order: 3 },
  { title: 'Arc Physical Training / Workout', startTime: '18:00', durationMin: 45, category: 'health' as const, order: 4 },
  { title: 'Practice Problems & Backlog Clear', startTime: '19:30', durationMin: 75, category: 'study' as const, order: 5 },
  { title: 'Daily Arc Audit & Recovery Check', startTime: '21:30', durationMin: 20, category: 'night' as const, order: 6 },
  { title: 'Screen Shutdown & Sleep Preparation', startTime: '22:15', durationMin: 15, category: 'night' as const, order: 7 },
];

export const STARTER_WORKOUT_SPLIT = [
  // 0 = Sun: Rest
  {
    weekday: 0,
    isRest: true,
    name: 'Sunday Rest & Mobility',
    exercises: [],
  },
  // 1 = Mon: Upper Push
  {
    weekday: 1,
    isRest: false,
    name: 'Upper Body Push',
    exercises: [
      { name: 'Standard Push-ups', sets: 4, reps: 15, restSec: 60, order: 1 },
      { name: 'Pike Push-ups (Shoulders)', sets: 3, reps: 10, restSec: 60, order: 2 },
      { name: 'Chair / Bench Tricep Dips', sets: 3, reps: 12, restSec: 45, order: 3 },
      { name: 'Hollow Body Plank Hold', sets: 3, reps: 45, durationSec: 45, restSec: 45, order: 4 },
    ],
  },
  // 2 = Tue: Upper Pull
  {
    weekday: 2,
    isRest: false,
    name: 'Upper Body Pull & Core',
    exercises: [
      { name: 'Pull-ups or Doorway Rows', sets: 4, reps: 8, restSec: 75, order: 1 },
      { name: 'Inverted Table / Towel Rows', sets: 3, reps: 12, restSec: 60, order: 2 },
      { name: 'Dead Hang (Grip & Decompression)', sets: 3, reps: 40, durationSec: 40, restSec: 45, order: 3 },
      { name: 'Leg Raises / Knee Tucks', sets: 3, reps: 15, restSec: 45, order: 4 },
    ],
  },
  // 3 = Wed: Legs & Calves
  {
    weekday: 3,
    isRest: false,
    name: 'Legs & Power',
    exercises: [
      { name: 'Bodyweight Deep Squats', sets: 4, reps: 20, restSec: 60, order: 1 },
      { name: 'Walking Lunges', sets: 3, reps: 12, restSec: 60, order: 2 },
      { name: 'Bulgarian Split Squats', sets: 3, reps: 10, restSec: 60, order: 3 },
      { name: 'Standing Calf Raises', sets: 4, reps: 25, restSec: 30, order: 4 },
    ],
  },
  // 4 = Thu: Rest
  {
    weekday: 4,
    isRest: true,
    name: 'Midweek Rest 🧊',
    exercises: [],
  },
  // 5 = Fri: Full Body Compound
  {
    weekday: 5,
    isRest: false,
    name: 'Full Body Conditioning',
    exercises: [
      { name: 'Diamond / Wide Push-ups', sets: 3, reps: 12, restSec: 60, order: 1 },
      { name: 'Pull-ups / Back Extensions', sets: 3, reps: 8, restSec: 60, order: 2 },
      { name: 'Jump Squats', sets: 3, reps: 15, restSec: 60, order: 3 },
      { name: 'Mountain Climbers', sets: 3, reps: 30, durationSec: 30, restSec: 45, order: 4 },
    ],
  },
  // 6 = Sat: Core & Endurance
  {
    weekday: 6,
    isRest: false,
    name: 'Core & Mobility',
    exercises: [
      { name: 'Bicycle Crunches', sets: 3, reps: 20, restSec: 45, order: 1 },
      { name: 'Side Plank Holds', sets: 3, reps: 30, durationSec: 30, restSec: 30, order: 2 },
      { name: 'Supermans (Lower Back)', sets: 3, reps: 15, restSec: 45, order: 3 },
      { name: 'Deep Hip & Hamstring Stretch', sets: 2, reps: 60, durationSec: 60, restSec: 30, order: 4 },
    ],
  },
];
