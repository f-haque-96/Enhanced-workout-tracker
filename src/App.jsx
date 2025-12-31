import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  TrendingUp, TrendingDown, Dumbbell, Heart, Footprints, 
  Flame, Clock, Calendar, ChevronDown, ChevronRight,
  Activity, Target, Zap, Award, BarChart3, PieChart,
  Scale, Ruler, RefreshCw, AlertCircle, CheckCircle2,
  Timer, ArrowUpRight, Minus, Plus, Filter, Search,
  Sun, Moon, Trophy, Sparkles, Brain, Battery, LineChart,
  Gauge, MapPin, Upload, Download, MoreVertical,
  FileJson, FileText, X, ChevronLeft, CalendarDays,
  Layers, Play, Pause, Wind, Info, Star, Crown, Medal,
  Zap as Lightning, Target as TargetIcon, TrendingUp as TrendUp,
  AlertTriangle, CheckCircle, Circle, Flame as Fire, Waves, Bike
} from 'lucide-react';

// ============================================
// CONFIGURATION & CONSTANTS
// ============================================
// In production (Docker), nginx proxies /api to the backend
// In development, use localhost:3001
const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api';

const COLORS = {
  push: { primary: '#F59E0B', secondary: '#FCD34D', bg: 'rgba(245, 158, 11, 0.15)', text: '#FBBF24', gradient: 'from-amber-500 to-orange-600', glow: 'shadow-amber-500/25' },
  pull: { primary: '#EF4444', secondary: '#FCA5A5', bg: 'rgba(239, 68, 68, 0.15)', text: '#F87171', gradient: 'from-red-500 to-rose-600', glow: 'shadow-red-500/25' },
  legs: { primary: '#3B82F6', secondary: '#93C5FD', bg: 'rgba(59, 130, 246, 0.15)', text: '#60A5FA', gradient: 'from-blue-500 to-indigo-600', glow: 'shadow-blue-500/25' },
  conditioning: { primary: '#10B981', secondary: '#6EE7B7', bg: 'rgba(16, 185, 129, 0.15)', text: '#34D399', gradient: 'from-emerald-500 to-teal-600', glow: 'shadow-emerald-500/25' },
};

// ============================================
// YOUR 5 KEY LIFTS - Hevy Name Mappings
// ============================================
const KEY_LIFTS_CONFIG = {
  'Incline Bench Press': {
    hevyNames: [
      'Incline Bench Press (Barbell)', 'Incline Bench Press (Dumbbell)',
      'Incline Barbell Bench Press', 'Incline Dumbbell Bench Press',
      'Incline Press (Barbell)', 'Incline Press (Dumbbell)'
    ],
    category: 'push',
    muscle: 'chest',
    standards: { beginner: 0.4, intermediate: 0.8, advanced: 1.2, elite: 1.6, average: 0.8 },
    description: 'Upper chest emphasis - typically 10-15% less than flat bench'
  },
  'Shoulder Press': {
    hevyNames: [
      'Shoulder Press (Dumbbell)', 'Shoulder Press (Barbell)', 'Shoulder Press (Machine)',
      'Overhead Press (Dumbbell)', 'Overhead Press (Barbell)',
      'Seated Shoulder Press (Dumbbell)', 'Seated Shoulder Press (Barbell)',
      'Military Press (Barbell)', 'Dumbbell Shoulder Press', 'Arnold Press (Dumbbell)'
    ],
    category: 'push',
    muscle: 'shoulders',
    standards: { beginner: 0.3, intermediate: 0.55, advanced: 0.85, elite: 1.15, average: 0.55 },
    description: 'Vertical push - standing or seated overhead press'
  },
  'Squat': {
    hevyNames: [
      'Squat (Barbell)', 'Squat (Smith Machine)', 'Back Squat (Barbell)',
      'Barbell Squat', 'Barbell Back Squat', 'High Bar Squat', 'Low Bar Squat'
    ],
    category: 'legs',
    muscle: 'quads',
    standards: { beginner: 0.75, intermediate: 1.25, advanced: 1.75, elite: 2.5, average: 1.25 },
    description: 'Back squat to parallel or below'
  },
  'Lat Pulldown': {
    hevyNames: [
      'Lat Pulldown (Cable)', 'Lat Pulldown (Machine)', 'Wide Grip Lat Pulldown',
      'Close Grip Lat Pulldown', 'Lat Pulldown - Wide Grip', 'Cable Lat Pulldown'
    ],
    category: 'pull',
    muscle: 'back',
    standards: { beginner: 0.5, intermediate: 0.85, advanced: 1.2, elite: 1.5, average: 0.85 },
    description: 'Vertical pull - lats, biceps'
  },
  'Deadlift': {
    hevyNames: [
      'Deadlift (Barbell)', 'Conventional Deadlift (Barbell)', 'Barbell Deadlift',
      'Deadlift - Conventional', 'Conventional Deadlift', 'Deadlift (Trap Bar)'
    ],
    category: 'pull',
    muscle: 'back',
    standards: { beginner: 1.0, intermediate: 1.5, advanced: 2.0, elite: 2.75, average: 1.5 },
    description: 'Conventional deadlift - full posterior chain'
  }
};

// Full Hevy exercise categories
const HEVY_CATEGORIES = {
  push: {
    chest: ['Bench Press', 'Incline Bench Press', 'Decline Bench Press', 'Chest Fly', 'Cable Fly', 'Dumbbell Press', 'Push Up', 'Push-Up', 'Pushup', 'Dip', 'Pec Deck', 'Machine Chest Press'],
    shoulders: ['Overhead Press', 'Shoulder Press', 'Lateral Raise', 'Front Raise', 'Arnold Press', 'Military Press', 'Upright Row'],
    triceps: ['Tricep Extension', 'Triceps Extension', 'Tricep Pushdown', 'Triceps Pushdown', 'Skull Crusher', 'Close Grip Bench', 'Overhead Extension', 'Overhead Tricep', 'Overhead Triceps', 'Kickback', 'Rope Pushdown'],
    neck: ['Neck Curl', 'Neck Extension', 'Neck Flexion']
  },
  pull: {
    back: ['Deadlift', 'Barbell Row', 'Dumbbell Row', 'Lat Pulldown', 'Pull Up', 'Chin Up', 'Cable Row', 'T-Bar Row', 'Seated Row', 'Pendlay Row', 'Machine Row', 'Iso-Lateral Row', 'Lever Row', 'Row'],
    biceps: ['Bicep Curl', 'Hammer Curl', 'Preacher Curl', 'Concentration Curl', 'Cable Curl', 'EZ Bar Curl', 'Incline Curl'],
    rear_delts: ['Reverse Fly', 'Face Pull', 'Rear Delt Row', 'Band Pull Apart']
  },
  legs: {
    quads: ['Squat', 'Leg Press', 'Leg Extension', 'Lunges', 'Front Squat', 'Hack Squat', 'Bulgarian Split Squat', 'Step Up', 'Goblet Squat'],
    hamstrings: ['Romanian Deadlift', 'Leg Curl', 'Stiff Leg Deadlift', 'Good Morning', 'Nordic Curl', 'Lying Leg Curl'],
    glutes: ['Hip Thrust', 'Glute Bridge', 'Cable Kickback', 'Sumo Deadlift', 'Kettlebell Swing', 'KB Swing'],
    calves: ['Calf Raise', 'Seated Calf Raise', 'Standing Calf Raise', 'Donkey Calf Raise'],
    abs: ['Leg Raise', 'Hanging Leg Raise', 'Parallel Bar', 'Plank', 'Ab Wheel', 'Crunch']
  }
};

// Apple Health workout types
const APPLE_CONDITIONING_TYPES = {
  swimming: ['Swimming', 'Pool Swim', 'Open Water Swim'],
  walking: ['Walking', 'Outdoor Walk', 'Indoor Walk'],
  running: ['Running', 'Outdoor Run', 'Indoor Run'],
  cycling: ['Cycling', 'Outdoor Cycle', 'Indoor Cycle'],
  hiit: ['HIIT', 'High Intensity Interval Training'],
};

const DATE_PRESETS = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: '1Y', days: 365 },
  { label: 'All', days: null }
];

// Achievements for YOUR key lifts
const ACHIEVEMENTS = {
  inclineBW: { icon: Trophy, color: '#F59E0B', title: '1x BW Incline', description: 'Incline bench your bodyweight' },
  shoulderPress0_7: { icon: Trophy, color: '#F59E0B', title: '0.7x BW OHP', description: 'Shoulder press 70% bodyweight' },
  squat1_5x: { icon: Trophy, color: '#3B82F6', title: '1.5x BW Squat', description: 'Squat 1.5x your bodyweight' },
  squat2x: { icon: Crown, color: '#A855F7', title: '2x BW Squat', description: 'Squat 2x your bodyweight' },
  latPulldownBW: { icon: Trophy, color: '#EF4444', title: '1x BW Pulldown', description: 'Lat pulldown your bodyweight' },
  deadlift1_5x: { icon: Trophy, color: '#EF4444', title: '1.5x BW Deadlift', description: 'Deadlift 1.5x your bodyweight' },
  deadlift2x: { icon: Crown, color: '#A855F7', title: '2x BW Deadlift', description: 'Deadlift 2x your bodyweight' },
  workouts10: { icon: Medal, color: '#10B981', title: 'Getting Started', description: 'Complete 10 workouts' },
  workouts50: { icon: Medal, color: '#3B82F6', title: 'Committed', description: 'Complete 50 workouts' },
  workouts100: { icon: Crown, color: '#A855F7', title: 'Century', description: 'Complete 100 workouts' },
  failureKing: { icon: Lightning, color: '#EF4444', title: 'Failure King', description: 'Hit failure on 50 sets' },
  volumeMonster: { icon: Dumbbell, color: '#3B82F6', title: 'Volume Monster', description: 'Move 100 tons total' },
  swimmerMile: { icon: Waves, color: '#06B6D4', title: 'Mile Swimmer', description: 'Swim 1.6km total' },
  walkMarathon: { icon: Footprints, color: '#10B981', title: 'Marathon Walker', description: 'Walk 42km total' },
  caloriesBurner: { icon: Fire, color: '#F97316', title: 'Calorie Burner', description: 'Burn 10,000 active calories' },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================
const calculate1RM = (weight, reps) => {
  if (reps === 1) return weight;
  return Math.round(weight * (36 / (37 - reps)) * 10) / 10;
};

const getStrengthLevel = (liftName, oneRM, bodyweight) => {
  const config = KEY_LIFTS_CONFIG[liftName];
  if (!config || !bodyweight) return null;
  const standards = config.standards;
  const ratio = oneRM / bodyweight;
  
  let level, color, percent, nextLevel, nextRatio;
  if (ratio >= standards.elite) { level = 'Elite'; color = '#A855F7'; percent = 100; }
  else if (ratio >= standards.advanced) { level = 'Advanced'; color = '#3B82F6'; percent = 75; nextLevel = 'Elite'; nextRatio = standards.elite; }
  else if (ratio >= standards.intermediate) { level = 'Intermediate'; color = '#10B981'; percent = 50; nextLevel = 'Advanced'; nextRatio = standards.advanced; }
  else { level = 'Beginner'; color = '#F59E0B'; percent = 25; nextLevel = 'Intermediate'; nextRatio = standards.intermediate; }
  
  const vsAverage = ((ratio / standards.average) * 100 - 100).toFixed(0);
  return { level, color, percent, ratio: ratio.toFixed(2), nextLevel, nextRatio, vsAverage, standards };
};

const matchKeyLift = (exerciseName) => {
  const nameLower = exerciseName.toLowerCase();
  for (const [liftName, config] of Object.entries(KEY_LIFTS_CONFIG)) {
    for (const hevyName of config.hevyNames) {
      if (nameLower.includes(hevyName.toLowerCase()) || hevyName.toLowerCase().includes(nameLower.split(' (')[0])) {
        return liftName;
      }
    }
  }
  return null;
};

const categorizeExercise = (exerciseName) => {
  const nameLower = exerciseName.toLowerCase();
  for (const [category, muscles] of Object.entries(HEVY_CATEGORIES)) {
    for (const [muscle, exercises] of Object.entries(muscles)) {
      if (exercises.some(e => nameLower.includes(e.toLowerCase()))) {
        return { category, muscle };
      }
    }
  }
  return { category: 'other', muscle: 'other' };
};

const getConditioningType = (workoutType) => {
  for (const [type, names] of Object.entries(APPLE_CONDITIONING_TYPES)) {
    if (names.some(n => workoutType.toLowerCase().includes(n.toLowerCase()))) return type;
  }
  return 'other';
};

const formatDate = (date) => new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const formatDateShort = (date) => new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const formatDuration = (seconds) => { const hrs = Math.floor(seconds / 3600); const mins = Math.floor((seconds % 3600) / 60); return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`; };
const formatPace = (seconds) => { if (!seconds) return '--:--'; const mins = Math.floor(seconds / 60); const secs = Math.round(seconds % 60); return `${mins}:${secs.toString().padStart(2, '0')}`; };
const daysSince = (date) => Math.floor((new Date() - new Date(date)) / (1000 * 60 * 60 * 24));
const kgToLbs = (kg) => Math.round(kg * 2.20462);

// ============================================
// MOCK DATA - Simulating Hevy + Apple Health
// ============================================
const generateMockData = () => {
  const generateWorkouts = () => {
    const workouts = [];
    const baseDate = new Date();
    
    // Push workouts
    for (let i = 0; i < 16; i++) {
      const date = new Date(baseDate); date.setDate(date.getDate() - (i * 7));
      const prog = 1 + (16 - i) * 0.012;
      workouts.push({
        id: `push-${i}`, title: 'Push Day', category: 'push',
        start_time: date.toISOString(),
        end_time: new Date(date.getTime() + 70 * 60 * 1000).toISOString(),
        appleHealth: { duration: 70 * 60, activeCalories: 280 + Math.round(Math.random() * 60), avgHeartRate: 115 + Math.round(Math.random() * 20), maxHeartRate: 145 + Math.round(Math.random() * 15) },
        exercises: [
          { title: 'Incline Bench Press (Barbell)', muscle_group: 'chest', sets: [
            { set_type: 'warmup', weight_kg: 40, reps: 12, rpe: null },
            { set_type: 'warmup', weight_kg: 55, reps: 8, rpe: null },
            { set_type: 'working', weight_kg: Math.round(72 / prog), reps: 8, rpe: 7 },
            { set_type: 'working', weight_kg: Math.round(77 / prog), reps: 6, rpe: 8 },
            { set_type: 'failure', weight_kg: Math.round(77 / prog), reps: 5 + Math.floor(Math.random() * 2), rpe: 10 }
          ]},
          { title: 'Chest Fly (Cable)', muscle_group: 'chest', sets: [
            { set_type: 'working', weight_kg: Math.round(18 / prog), reps: 12, rpe: 8 },
            { set_type: 'failure', weight_kg: Math.round(18 / prog), reps: 10, rpe: 10 }
          ]},
          { title: 'Shoulder Press (Dumbbell)', muscle_group: 'shoulders', sets: [
            { set_type: 'warmup', weight_kg: 12, reps: 12, rpe: null },
            { set_type: 'working', weight_kg: Math.round(24 / prog), reps: 10, rpe: 7 },
            { set_type: 'working', weight_kg: Math.round(26 / prog), reps: 8, rpe: 8 },
            { set_type: 'failure', weight_kg: Math.round(26 / prog), reps: 6 + Math.floor(Math.random() * 2), rpe: 10 }
          ]},
          { title: 'Lateral Raise (Dumbbell)', muscle_group: 'shoulders', sets: [
            { set_type: 'working', weight_kg: 10, reps: 15, rpe: 8 },
            { set_type: 'failure', weight_kg: 10, reps: 12, rpe: 10 }
          ]},
          { title: 'Tricep Pushdown (Cable)', muscle_group: 'triceps', sets: [
            { set_type: 'working', weight_kg: Math.round(28 / prog), reps: 12, rpe: 8 },
            { set_type: 'failure', weight_kg: Math.round(28 / prog), reps: 10, rpe: 10 }
          ]}
        ]
      });
    }
    
    // Pull workouts
    for (let i = 0; i < 16; i++) {
      const date = new Date(baseDate); date.setDate(date.getDate() - (i * 7) - 2);
      const prog = 1 + (16 - i) * 0.012;
      workouts.push({
        id: `pull-${i}`, title: 'Pull Day', category: 'pull',
        start_time: date.toISOString(),
        end_time: new Date(date.getTime() + 65 * 60 * 1000).toISOString(),
        appleHealth: { duration: 65 * 60, activeCalories: 260 + Math.round(Math.random() * 50), avgHeartRate: 110 + Math.round(Math.random() * 20), maxHeartRate: 140 + Math.round(Math.random() * 15) },
        exercises: [
          { title: 'Deadlift (Barbell)', muscle_group: 'back', sets: [
            { set_type: 'warmup', weight_kg: 60, reps: 10, rpe: null },
            { set_type: 'warmup', weight_kg: 100, reps: 5, rpe: null },
            { set_type: 'working', weight_kg: Math.round(125 / prog), reps: 5, rpe: 7 },
            { set_type: 'working', weight_kg: Math.round(135 / prog), reps: 3, rpe: 8 },
            { set_type: 'failure', weight_kg: Math.round(140 / prog), reps: 2 + Math.floor(Math.random() * 2), rpe: 10 }
          ]},
          { title: 'Lat Pulldown (Cable)', muscle_group: 'back', sets: [
            { set_type: 'warmup', weight_kg: 40, reps: 12, rpe: null },
            { set_type: 'working', weight_kg: Math.round(65 / prog), reps: 10, rpe: 7 },
            { set_type: 'working', weight_kg: Math.round(70 / prog), reps: 8, rpe: 8 },
            { set_type: 'failure', weight_kg: Math.round(70 / prog), reps: 7 + Math.floor(Math.random() * 2), rpe: 10 }
          ]},
          { title: 'Seated Cable Row', muscle_group: 'back', sets: [
            { set_type: 'working', weight_kg: Math.round(60 / prog), reps: 10, rpe: 8 },
            { set_type: 'failure', weight_kg: Math.round(60 / prog), reps: 8, rpe: 10 }
          ]},
          { title: 'Face Pull (Cable)', muscle_group: 'rear_delts', sets: [
            { set_type: 'working', weight_kg: 20, reps: 15, rpe: 7 },
            { set_type: 'failure', weight_kg: 20, reps: 12, rpe: 9 }
          ]},
          { title: 'Bicep Curl (Barbell)', muscle_group: 'biceps', sets: [
            { set_type: 'working', weight_kg: Math.round(28 / prog), reps: 12, rpe: 8 },
            { set_type: 'failure', weight_kg: Math.round(28 / prog), reps: 10, rpe: 10 }
          ]}
        ]
      });
    }
    
    // Legs workouts
    for (let i = 0; i < 16; i++) {
      const date = new Date(baseDate); date.setDate(date.getDate() - (i * 7) - 4);
      const prog = 1 + (16 - i) * 0.012;
      workouts.push({
        id: `legs-${i}`, title: 'Leg Day', category: 'legs',
        start_time: date.toISOString(),
        end_time: new Date(date.getTime() + 75 * 60 * 1000).toISOString(),
        appleHealth: { duration: 75 * 60, activeCalories: 320 + Math.round(Math.random() * 70), avgHeartRate: 125 + Math.round(Math.random() * 20), maxHeartRate: 155 + Math.round(Math.random() * 15) },
        exercises: [
          { title: 'Squat (Barbell)', muscle_group: 'quads', sets: [
            { set_type: 'warmup', weight_kg: 40, reps: 12, rpe: null },
            { set_type: 'warmup', weight_kg: 70, reps: 8, rpe: null },
            { set_type: 'warmup', weight_kg: 90, reps: 5, rpe: null },
            { set_type: 'working', weight_kg: Math.round(105 / prog), reps: 6, rpe: 7 },
            { set_type: 'working', weight_kg: Math.round(115 / prog), reps: 4, rpe: 8 },
            { set_type: 'failure', weight_kg: Math.round(115 / prog), reps: 3 + Math.floor(Math.random() * 2), rpe: 10 }
          ]},
          { title: 'Romanian Deadlift (Barbell)', muscle_group: 'hamstrings', sets: [
            { set_type: 'warmup', weight_kg: 40, reps: 10, rpe: null },
            { set_type: 'working', weight_kg: Math.round(75 / prog), reps: 10, rpe: 8 },
            { set_type: 'failure', weight_kg: Math.round(75 / prog), reps: 8, rpe: 10 }
          ]},
          { title: 'Leg Press (Machine)', muscle_group: 'quads', sets: [
            { set_type: 'working', weight_kg: Math.round(180 / prog), reps: 12, rpe: 8 },
            { set_type: 'failure', weight_kg: Math.round(180 / prog), reps: 10, rpe: 10 }
          ]},
          { title: 'Leg Curl (Machine)', muscle_group: 'hamstrings', sets: [
            { set_type: 'working', weight_kg: Math.round(45 / prog), reps: 12, rpe: 8 },
            { set_type: 'failure', weight_kg: Math.round(45 / prog), reps: 10, rpe: 10 }
          ]},
          { title: 'Calf Raise (Machine)', muscle_group: 'calves', sets: [
            { set_type: 'working', weight_kg: Math.round(90 / prog), reps: 15, rpe: 8 },
            { set_type: 'failure', weight_kg: Math.round(90 / prog), reps: 12, rpe: 10 }
          ]}
        ]
      });
    }
    return workouts.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
  };
  
  // Conditioning - Apple Health ONLY
  const generateConditioning = () => {
    const sessions = [];
    const baseDate = new Date();
    const types = [
      { type: 'Outdoor Walk', category: 'walking', avgHR: 95, distance: 3.5, calories: 180 },
      { type: 'Swimming', category: 'swimming', avgHR: 135, distance: 1.2, calories: 350 },
      { type: 'Outdoor Run', category: 'running', avgHR: 155, distance: 5.2, calories: 420, hasPace: true },
      { type: 'Cycling', category: 'cycling', avgHR: 140, distance: 12, calories: 320 },
      { type: 'HIIT', category: 'hiit', avgHR: 165, distance: null, calories: 380 },
    ];
    for (let i = 0; i < 30; i++) {
      const date = new Date(baseDate); date.setDate(date.getDate() - Math.floor(i * 2.5));
      const t = types[i % types.length];
      const v = 0.85 + Math.random() * 0.3;
      sessions.push({
        id: `cond-${i}`, type: t.type, category: t.category, date: date.toISOString(), source: 'Apple Health',
        duration: Math.round((25 + Math.random() * 40) * 60),
        activeCalories: Math.round(t.calories * v),
        avgHeartRate: Math.round(t.avgHR * v),
        maxHeartRate: Math.round((t.avgHR + 25) * v),
        distance: t.distance ? +(t.distance * v).toFixed(2) : null,
        pace: t.hasPace ? Math.round(330 * (1 - i * 0.003) * v) : null,
        laps: t.category === 'swimming' ? Math.round(24 * v) : null,
        hrZones: { zone1: Math.round(15 * v), zone2: Math.round(35 * v), zone3: Math.round(30 * v), zone4: Math.round(15 * v), zone5: Math.round(5 * v) }
      });
    }
    return sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
  };
  
  return {
    workouts: generateWorkouts(),
    conditioning: generateConditioning(),
    measurements: { current: { weight: null, bodyFat: null, chest: null, waist: null, biceps: null, thighs: null }, starting: { weight: null, bodyFat: null, chest: null, waist: null, biceps: null, thighs: null }, height: null },
    appleHealth: { restingHeartRate: null, avgSteps: null, avgActiveCalories: null, sleepAvg: null }
  };
};

// ============================================
// TOOLTIP COMPONENT
// ============================================
const Tooltip = ({ children, content, position = 'top' }) => {
  const [show, setShow] = useState(false);
  const pos = { top: 'bottom-full left-1/2 -translate-x-1/2 mb-2', bottom: 'top-full left-1/2 -translate-x-1/2 mt-2', left: 'right-full top-1/2 -translate-y-1/2 mr-2', right: 'left-full top-1/2 -translate-y-1/2 ml-2' };
  return (
    <span className="relative inline-block" style={{ zIndex: 1 }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && <span className={`absolute ${pos[position]} px-3 py-2 text-xs rounded-lg bg-slate-800 border border-white/20 shadow-xl max-w-xs pointer-events-none whitespace-normal`} style={{ zIndex: 999999 }}>{content}</span>}
    </span>
  );
};

// ============================================
// UI COMPONENTS
// ============================================
const MiniLineChart = ({ data, color, height = 60, comparisonData = null }) => {
  if (!data || data.length === 0) return <div className="h-full flex items-center justify-center text-gray-500 text-xs">No data</div>;
  if (data.length === 1) return <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs"><div className="mb-2">Only 1 workout</div><div className="text-[10px] text-gray-600">Need 2+ workouts to show trend</div></div>;
  const allVals = comparisonData ? [...data.map(d => d.value), ...comparisonData.map(d => d.value)] : data.map(d => d.value);
  const max = Math.max(...allVals), min = Math.min(...allVals), range = max - min || 1, pad = 10, w = 100;
  const pts = data.map((d, i) => ({ x: pad + (i / Math.max(data.length - 1, 1)) * (w - pad * 2), y: height - pad - ((d.value - min) / range) * (height - pad * 2) }));
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${pts[pts.length - 1].x} ${height - pad} L ${pad} ${height - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }}>
      <path d={areaD} fill={`${color}20`} />
      {comparisonData && comparisonData.length > 0 && <path d={comparisonData.map((d, i) => { const x = pad + (i / Math.max(comparisonData.length - 1, 1)) * (w - pad * 2); const y = height - pad - ((d.value - min) / range) * (height - pad * 2); return `${i === 0 ? 'M' : 'L'} ${x} ${y}`; }).join(' ')} fill="none" stroke="#6B7280" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.5" />}
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />)}
    </svg>
  );
};

const ProgressBar = ({ value, max, color, height = 8 }) => (
  <div className="w-full"><div className="relative" style={{ height }}><div className="absolute inset-0 rounded-full bg-white/10" /><div className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (value / max) * 100)}%`, backgroundColor: color }} /></div></div>
);

const DateRangeSelector = ({ selectedDays, onSelect }) => (
  <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
    {DATE_PRESETS.map(p => <button key={p.label} onClick={() => onSelect(p.days)} className={`px-3 py-1.5 text-xs rounded-md transition-all ${selectedDays === p.days ? 'bg-cyan-500 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>{p.label}</button>)}
  </div>
);

const SetTypeBadge = ({ type }) => {
  const cfg = { warmup: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'W' }, working: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'S' }, failure: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'F' }, normal: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'S' } };
  const c = cfg[type] || cfg.working;
  return <span className={`${c.bg} ${c.text} text-xs px-1.5 py-0.5 rounded font-medium`}>{c.label}</span>;
};

const ConditioningIcon = ({ type, size = 16, className = '' }) => {
  const icons = { walking: Footprints, swimming: Waves, running: Wind, cycling: Bike, hiit: Zap, other: Activity };
  const Icon = icons[type] || icons.other;
  return <Icon size={size} className={className} />;
};

const MoreMenu = ({ onUploadHevy, onUploadHevyMeasurements, onUploadAppleHealth, onExportJson, onExportCsv }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  return (
    <div className="relative z-[9999]" ref={ref}>
      <button onClick={() => setIsOpen(!isOpen)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10"><MoreVertical size={18} className="text-gray-400" /></button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-slate-900 border border-white/10 shadow-xl z-[9999]">
          <div className="p-2 border-b border-white/10">
            <p className="text-xs text-gray-500 px-2 py-1">Upload</p>
            <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer"><Upload size={16} className="text-cyan-400" /><span className="text-sm text-white">Hevy Workouts (JSON)</span><input type="file" accept=".json" onChange={(e) => { onUploadHevy(e); setIsOpen(false); }} className="hidden" /></label>
            <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer"><Upload size={16} className="text-blue-400" /><span className="text-sm text-white">Hevy Measurements (CSV)</span><input type="file" accept=".csv" onChange={(e) => { onUploadHevyMeasurements(e); setIsOpen(false); }} className="hidden" /></label>
            <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer"><Upload size={16} className="text-pink-400" /><span className="text-sm text-white">Apple Health (XML)</span><input type="file" accept=".xml,.zip" onChange={(e) => { onUploadAppleHealth(e); setIsOpen(false); }} className="hidden" /></label>
          </div>
          <div className="p-2">
            <p className="text-xs text-gray-500 px-2 py-1">Export</p>
            <button onClick={() => { onExportJson(); setIsOpen(false); }} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 w-full"><FileJson size={16} className="text-amber-400" /><span className="text-sm text-white">JSON</span></button>
            <button onClick={() => { onExportCsv(); setIsOpen(false); }} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 w-full"><FileText size={16} className="text-green-400" /><span className="text-sm text-white">CSV</span></button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// KEY LIFTS CARD (Your 5 lifts)
// ============================================
const KeyLiftsCard = ({ workouts, bodyweight }) => {
  const keyLifts = useMemo(() => {
    const lifts = {};
    workouts.forEach(w => {
      w.exercises.forEach(ex => {
        const matched = matchKeyLift(ex.title);
        if (matched) {
          const working = ex.sets.filter(s => s.set_type !== 'warmup');
          const best = working.reduce((b, s) => { const rm = calculate1RM(s.weight_kg, s.reps); return rm > (b?.oneRM || 0) ? { ...s, oneRM: rm } : b; }, null);
          if (best && (!lifts[matched] || best.oneRM > lifts[matched].oneRM)) {
            lifts[matched] = { weight: best.weight_kg, reps: best.reps, oneRM: best.oneRM, strength: getStrengthLevel(matched, best.oneRM, bodyweight), hevyName: ex.title };
          }
        }
      });
    });
    return lifts;
  }, [workouts, bodyweight]);

  const order = ['Incline Bench Press', 'Shoulder Press', 'Squat', 'Lat Pulldown', 'Deadlift'];
  return (
    <div className="card h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2"><Trophy className="text-amber-400" size={20} /><h3 className="text-lg font-semibold text-white">Key Lifts</h3></div>
        <Tooltip content={<div className="text-left"><p className="font-medium">Your 5 Key Lifts</p><p className="text-gray-400 text-[10px]">Hover each lift for standards & targets</p></div>}><Info size={14} className="text-gray-500 cursor-help" /></Tooltip>
      </div>
      <div className="space-y-2">
        {order.map(name => {
          const d = keyLifts[name];
          if (!d) return null;
          const std = KEY_LIFTS_CONFIG[name].standards;
          return (
            <Tooltip key={name} position="right" content={
              <div className="text-left min-w-[200px]">
                <p className="font-medium text-white mb-1">{name}</p>
                <p className="text-gray-500 text-[10px] mb-2">{KEY_LIFTS_CONFIG[name].description}</p>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between"><span className="text-gray-400">Your Ratio:</span><span className="text-white font-medium">{d.strength?.ratio}x BW</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">vs Average:</span><span className={parseFloat(d.strength?.vsAverage) >= 0 ? 'text-green-400' : 'text-red-400'}>{parseFloat(d.strength?.vsAverage) >= 0 ? '+' : ''}{d.strength?.vsAverage}%</span></div>
                  <hr className="border-white/10 my-2" />
                  <p className="text-gray-500">Standards (× BW):</p>
                  <div className="grid grid-cols-2 gap-1">
                    <span className="text-amber-400">Beginner: {std.beginner}x</span>
                    <span className="text-green-400">Inter: {std.intermediate}x</span>
                    <span className="text-blue-400">Adv: {std.advanced}x</span>
                    <span className="text-purple-400">Elite: {std.elite}x</span>
                  </div>
                  {d.strength?.nextLevel && <p className="text-cyan-400 mt-2">→ {Math.round(d.strength.nextRatio * bodyweight)}kg for {d.strength.nextLevel}</p>}
                </div>
              </div>
            }>
              <div className="p-2 rounded-xl bg-gradient-to-r from-white/5 to-transparent border border-white/5 cursor-help hover:border-white/20 transition-all">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-white">{name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] ${parseFloat(d.strength?.vsAverage) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{parseFloat(d.strength?.vsAverage) >= 0 ? '↑' : '↓'}{Math.abs(parseFloat(d.strength?.vsAverage))}%</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${d.strength?.color}20`, color: d.strength?.color }}>{d.strength?.level}</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-white">{d.weight}</span>
                  <span className="text-xs text-gray-400">kg × {d.reps}</span>
                  <span className="text-[10px] text-gray-500 ml-auto">1RM: {d.oneRM}kg</span>
                </div>
                <div className="mt-1 h-1 bg-white/10 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${d.strength?.percent}%`, backgroundColor: d.strength?.color }} /></div>
              </div>
            </Tooltip>
          );
        })}
      </div>
      <div className="mt-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <p className="text-xs text-amber-400 flex items-center gap-2"><Sparkles size={12} /><span>BW: {bodyweight}kg • Total 1RM: {Object.values(keyLifts).reduce((s, l) => s + (l?.oneRM || 0), 0).toFixed(1)}kg</span></p>
      </div>
    </div>
  );
};

// ============================================
// MEASUREMENTS CARD
// ============================================
const MeasurementsCard = ({ measurements }) => {
  const { current, starting, height } = measurements;

  // Calculate BMI if we have weight and height
  const bmi = (current.weight && height) ? (current.weight / Math.pow(height / 100, 2)).toFixed(1) : null;
  const bmiCategory = bmi ? (bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese') : null;
  const bmiColor = bmi ? (bmi < 18.5 ? 'yellow' : bmi < 25 ? 'green' : bmi < 30 ? 'orange' : 'red') : 'gray';

  // Calculate changes
  const weightChange = (current.weight && starting.weight) ? ((current.weight - starting.weight) / starting.weight * 100).toFixed(1) : null;
  const bodyFatChange = (current.bodyFat && starting.bodyFat) ? (starting.bodyFat - current.bodyFat).toFixed(1) : null;

  const hasData = current.weight || current.bodyFat || current.chest || current.biceps;

  return (
    <div className="card h-full">
      <div className="flex items-center gap-2 mb-4"><Scale className="text-blue-400" size={20} /><h3 className="text-lg font-semibold text-white">Body Composition</h3></div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Upload className="text-gray-600 mb-3" size={32} />
          <p className="text-gray-400 text-sm mb-1">No measurement data</p>
          <p className="text-gray-500 text-xs">Upload Hevy Measurements (CSV) or Apple Health (XML) to see your body composition</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Tooltip content={current.weight && starting.weight ? <div><p className="font-medium">Weight</p><p className="text-gray-400">Started: {starting.weight}kg → Now: {current.weight}kg</p></div> : 'No weight data'}>
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/20 cursor-help">
                <p className="text-xs text-gray-400 mb-1">Weight</p>
                {current.weight ? (
                  <>
                    <div className="flex items-baseline gap-1"><span className="text-2xl font-bold text-white">{current.weight}</span><span className="text-sm text-gray-400">kg</span></div>
                    {weightChange && <p className="text-xs mt-1"><span className={weightChange >= 0 ? 'text-green-400' : 'text-red-400'}>{weightChange > 0 ? '+' : ''}{weightChange}%</span></p>}
                  </>
                ) : (
                  <p className="text-sm text-gray-500">No data</p>
                )}
              </div>
            </Tooltip>
            <Tooltip content={current.bodyFat && starting.bodyFat ? <div><p className="font-medium">Body Fat</p><p className="text-gray-400">Started: {starting.bodyFat}% → Now: {current.bodyFat}%</p></div> : 'No body fat data'}>
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/20 cursor-help">
                <p className="text-xs text-gray-400 mb-1">Body Fat</p>
                {current.bodyFat ? (
                  <>
                    <div className="flex items-baseline gap-1"><span className="text-2xl font-bold text-white">{current.bodyFat}</span><span className="text-sm text-gray-400">%</span></div>
                    {bodyFatChange && <p className="text-xs mt-1"><span className="text-green-400">-{bodyFatChange}%</span></p>}
                  </>
                ) : (
                  <p className="text-sm text-gray-500">No data</p>
                )}
              </div>
            </Tooltip>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">BMI</span>
              {bmiCategory && <span className={`text-xs px-2 py-0.5 rounded-full bg-${bmiColor}-500/20 text-${bmiColor}-400`}>{bmiCategory}</span>}
            </div>
            {bmi ? (
              <span className="text-2xl font-bold text-white">{bmi}</span>
            ) : (
              <p className="text-sm text-gray-500">No data</p>
            )}
          </div>
          <div className="mt-3 space-y-1.5">
            {[{ label: 'Chest', cur: current.chest, start: starting.chest }, { label: 'Biceps', cur: current.biceps, start: starting.biceps }].map(m => {
              if (!m.cur) return null;
              const curInches = (m.cur / 2.54).toFixed(1);
              const startInches = m.start ? (m.start / 2.54).toFixed(1) : null;
              const diffInches = startInches ? (curInches - startInches).toFixed(1) : null;
              return (
                <div key={m.label} className="flex items-center justify-between py-1 text-sm">
                  <span className="text-gray-400">{m.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white">{curInches}"</span>
                    {diffInches && <span className={`text-xs ${m.cur >= m.start ? 'text-green-400' : 'text-red-400'}`}>{diffInches > 0 ? '+' : ''}{diffInches}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

// ============================================
// WEEKLY INSIGHTS CARD
// ============================================
const WeeklyInsightsCard = ({ workouts, conditioning, appleHealth }) => {
  const lastDate = workouts.length > 0 ? new Date(Math.max(...workouts.map(w => new Date(w.start_time)))) : null;
  const restDays = lastDate ? daysSince(lastDate) : 0;
  
  const stats = useMemo(() => {
    let rpeT = 0, rpeC = 0, warm = 0, work = 0, fail = 0, cal = 0;
    workouts.slice(0, 10).forEach(w => {
      w.exercises.forEach(e => e.sets.forEach(s => {
        if (s.rpe) { rpeT += s.rpe; rpeC++; }
        if (s.set_type === 'warmup') warm++; else if (s.set_type === 'failure') fail++; else work++;
      }));
      if (w.appleHealth) cal += w.appleHealth.activeCalories;
    });
    conditioning.slice(0, 10).forEach(c => cal += c.activeCalories);
    return { avgRPE: rpeC > 0 ? (rpeT / rpeC).toFixed(1) : 0, warmupSets: warm, workingSets: work, failureSets: fail, weeklyCalories: cal };
  }, [workouts, conditioning]);

  const recovery = Math.max(0, Math.min(100, 100 - (restDays * 15) - (stats.avgRPE * 5)));
  const recColor = recovery >= 70 ? '#10B981' : recovery >= 40 ? '#F59E0B' : '#EF4444';

  return (
    <div className="card h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2"><Brain className="text-purple-400" size={20} /><h3 className="text-lg font-semibold text-white">Weekly Insights</h3></div>
        <Tooltip content={<div><p className="font-medium">Recovery Score</p><p className="text-gray-400">Based on rest & intensity</p></div>}>
          <div className="flex items-center gap-1 cursor-help"><Battery size={16} style={{ color: recColor }} /><span className="text-sm font-medium" style={{ color: recColor }}>{recovery}%</span></div>
        </Tooltip>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/5 border border-orange-500/20">
          <div className="flex items-center gap-2 mb-1"><Clock size={14} className="text-orange-400" /><span className="text-xs text-gray-400">Rest Days</span></div>
          <span className="text-2xl font-bold text-white">{restDays}</span>
        </div>
        <Tooltip content={<div><p className="font-medium">RPE Scale</p><p className="text-gray-400">7-8: Hard • 9: Very hard • 10: Failure</p></div>}>
          <div className="p-3 rounded-xl bg-gradient-to-br from-red-500/20 to-red-500/5 border border-red-500/20 cursor-help">
            <div className="flex items-center gap-2 mb-1"><Zap size={14} className="text-red-400" /><span className="text-xs text-gray-400">Avg RPE</span></div>
            <span className="text-2xl font-bold text-white">{stats.avgRPE}</span>
          </div>
        </Tooltip>
        <div className="p-3 rounded-xl bg-gradient-to-br from-pink-500/20 to-pink-500/5 border border-pink-500/20">
          <div className="flex items-center gap-2 mb-1"><Heart size={14} className="text-pink-400" /><span className="text-xs text-gray-400">Resting HR</span></div>
          <span className="text-2xl font-bold text-white">{appleHealth.restingHeartRate}</span>
        </div>
        <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/20">
          <div className="flex items-center gap-2 mb-1"><Flame size={14} className="text-green-400" /><span className="text-xs text-gray-400">Calories</span></div>
          <span className="text-2xl font-bold text-white">{stats.weeklyCalories}</span>
        </div>
      </div>
      <div className="mt-3 p-2 rounded-lg bg-white/5 flex items-center justify-around text-center">
        <Tooltip content="Warmup: Prepare for heavy work"><div className="cursor-help"><p className="text-lg font-bold text-yellow-400">{stats.warmupSets}</p><p className="text-[10px] text-gray-500">Warmup</p></div></Tooltip>
        <div className="w-px h-8 bg-white/10" />
        <Tooltip content="Working: Main training volume"><div className="cursor-help"><p className="text-lg font-bold text-blue-400">{stats.workingSets}</p><p className="text-[10px] text-gray-500">Working</p></div></Tooltip>
        <div className="w-px h-8 bg-white/10" />
        <Tooltip content="Failure: RPE 10 (HIT principle)"><div className="cursor-help"><p className="text-lg font-bold text-red-400">{stats.failureSets}</p><p className="text-[10px] text-gray-500">Failure</p></div></Tooltip>
      </div>
      <div className="mt-3 p-2 rounded-lg" style={{ backgroundColor: `${recColor}15` }}>
        <p className="text-xs flex items-center gap-2" style={{ color: recColor }}><Activity size={12} /><span>{recovery >= 70 ? 'Ready to train!' : recovery >= 40 ? 'Light session recommended' : 'Rest day advised'}</span></p>
      </div>
    </div>
  );
};

// ============================================
// ACHIEVEMENT PANEL
// ============================================
const AchievementPanel = ({ workouts, conditioning, bodyweight }) => {
  const ach = useMemo(() => {
    const earned = [], inProgress = [];
    let vol = 0, fail = 0;
    const lifts = { incline: 0, shoulder: 0, squat: 0, lat: 0, deadlift: 0 };
    
    workouts.forEach(w => w.exercises.forEach(ex => {
      const m = matchKeyLift(ex.title);
      ex.sets.forEach(s => {
        if (s.set_type === 'failure') fail++;
        if (s.set_type !== 'warmup') vol += s.weight_kg * s.reps;
        if (m) {
          const rm = calculate1RM(s.weight_kg, s.reps);
          if (m === 'Incline Bench Press') lifts.incline = Math.max(lifts.incline, rm);
          if (m === 'Shoulder Press') lifts.shoulder = Math.max(lifts.shoulder, rm);
          if (m === 'Squat') lifts.squat = Math.max(lifts.squat, rm);
          if (m === 'Lat Pulldown') lifts.lat = Math.max(lifts.lat, rm);
          if (m === 'Deadlift') lifts.deadlift = Math.max(lifts.deadlift, rm);
        }
      });
    }));
    
    let swimD = 0, walkD = 0, cal = 0;
    conditioning.forEach(c => { cal += c.activeCalories; if (c.category === 'swimming' && c.distance) swimD += c.distance; if (c.category === 'walking' && c.distance) walkD += c.distance; });
    
    if (lifts.incline >= bodyweight) earned.push({ ...ACHIEVEMENTS.inclineBW }); else inProgress.push({ ...ACHIEVEMENTS.inclineBW, progress: Math.round(lifts.incline / bodyweight * 100), target: 100 });
    if (lifts.shoulder >= bodyweight * 0.7) earned.push({ ...ACHIEVEMENTS.shoulderPress0_7 }); else inProgress.push({ ...ACHIEVEMENTS.shoulderPress0_7, progress: Math.round(lifts.shoulder / (bodyweight * 0.7) * 100), target: 100 });
    if (lifts.squat >= bodyweight * 2) earned.push({ ...ACHIEVEMENTS.squat2x }); else if (lifts.squat >= bodyweight * 1.5) { earned.push({ ...ACHIEVEMENTS.squat1_5x }); inProgress.push({ ...ACHIEVEMENTS.squat2x, progress: Math.round(lifts.squat / (bodyweight * 2) * 100), target: 100 }); } else inProgress.push({ ...ACHIEVEMENTS.squat1_5x, progress: Math.round(lifts.squat / (bodyweight * 1.5) * 100), target: 100 });
    if (lifts.lat >= bodyweight) earned.push({ ...ACHIEVEMENTS.latPulldownBW }); else inProgress.push({ ...ACHIEVEMENTS.latPulldownBW, progress: Math.round(lifts.lat / bodyweight * 100), target: 100 });
    if (lifts.deadlift >= bodyweight * 2) earned.push({ ...ACHIEVEMENTS.deadlift2x }); else if (lifts.deadlift >= bodyweight * 1.5) { earned.push({ ...ACHIEVEMENTS.deadlift1_5x }); inProgress.push({ ...ACHIEVEMENTS.deadlift2x, progress: Math.round(lifts.deadlift / (bodyweight * 2) * 100), target: 100 }); } else inProgress.push({ ...ACHIEVEMENTS.deadlift1_5x, progress: Math.round(lifts.deadlift / (bodyweight * 1.5) * 100), target: 100 });
    
    const wc = workouts.length;
    if (wc >= 100) earned.push({ ...ACHIEVEMENTS.workouts100 }); else if (wc >= 50) { earned.push({ ...ACHIEVEMENTS.workouts50 }); inProgress.push({ ...ACHIEVEMENTS.workouts100, progress: wc, target: 100 }); } else if (wc >= 10) { earned.push({ ...ACHIEVEMENTS.workouts10 }); inProgress.push({ ...ACHIEVEMENTS.workouts50, progress: wc, target: 50 }); } else inProgress.push({ ...ACHIEVEMENTS.workouts10, progress: wc, target: 10 });
    
    if (fail >= 50) earned.push({ ...ACHIEVEMENTS.failureKing }); else inProgress.push({ ...ACHIEVEMENTS.failureKing, progress: fail, target: 50 });
    if (vol >= 100000) earned.push({ ...ACHIEVEMENTS.volumeMonster }); else inProgress.push({ ...ACHIEVEMENTS.volumeMonster, progress: (vol / 1000).toFixed(1), target: 100, unit: 't' });
    if (cal >= 10000) earned.push({ ...ACHIEVEMENTS.caloriesBurner }); else inProgress.push({ ...ACHIEVEMENTS.caloriesBurner, progress: Math.round(cal), target: 10000 });
    if (swimD >= 1.6) earned.push({ ...ACHIEVEMENTS.swimmerMile }); else if (swimD > 0) inProgress.push({ ...ACHIEVEMENTS.swimmerMile, progress: swimD.toFixed(2), target: 1.6, unit: 'km' });
    if (walkD >= 42) earned.push({ ...ACHIEVEMENTS.walkMarathon }); else inProgress.push({ ...ACHIEVEMENTS.walkMarathon, progress: walkD.toFixed(1), target: 42, unit: 'km' });
    
    return { earned, inProgress, lifts };
  }, [workouts, conditioning, bodyweight]);
  
  return (
    <div className="card h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2"><Award className="text-amber-400" size={20} /><h3 className="text-lg font-semibold text-white">Achievements</h3></div>
        <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-400">{ach.earned.length} Earned</span>
      </div>
      <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-purple-500/10 border border-amber-500/20">
        <p className="text-xs text-gray-400 mb-2">Key Lifts (1RM)</p>
        <div className="grid grid-cols-5 gap-1 text-center">
          {[{ n: 'Inc', v: ach.lifts.incline }, { n: 'OHP', v: ach.lifts.shoulder }, { n: 'Sqt', v: ach.lifts.squat }, { n: 'Lat', v: ach.lifts.lat }, { n: 'DL', v: ach.lifts.deadlift }].map(l => <div key={l.n}><p className="text-lg font-bold text-white">{l.v}</p><p className="text-[10px] text-gray-500">{l.n}</p></div>)}
        </div>
      </div>
      {ach.earned.length > 0 && <div className="mb-3"><p className="text-xs text-gray-500 mb-2">EARNED</p><div className="grid grid-cols-2 gap-2">{ach.earned.slice(0, 4).map((a, i) => <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10"><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${a.color}20` }}><a.icon size={14} style={{ color: a.color }} /></div><p className="text-[11px] font-medium text-white truncate">{a.title}</p></div>)}</div></div>}
      <div><p className="text-xs text-gray-500 mb-2">IN PROGRESS</p><div className="space-y-2">{ach.inProgress.slice(0, 3).map((a, i) => <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-white/5"><div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/10"><a.icon size={14} className="text-gray-400" /></div><div className="flex-1"><div className="flex items-center justify-between mb-1"><p className="text-[11px] font-medium text-white">{a.title}</p><p className="text-[10px] text-gray-400">{a.progress}{a.unit || ''}/{a.target}{a.unit || ''}</p></div><ProgressBar value={parseFloat(a.progress)} max={a.target} color={a.color} height={3} /></div></div>)}</div></div>
    </div>
  );
};

// ============================================
// PR TIMELINE
// ============================================
const PRTimeline = ({ workouts }) => {
  const prs = useMemo(() => {
    const bests = {}, list = [];
    [...workouts].sort((a, b) => new Date(a.start_time) - new Date(b.start_time)).forEach(w => {
      w.exercises.forEach(ex => {
        ex.sets.forEach(s => {
          if (s.set_type === 'warmup') return;
          const rm = calculate1RM(s.weight_kg, s.reps);
          if (!bests[ex.title] || rm > bests[ex.title]) {
            if (bests[ex.title]) list.push({ exercise: ex.title, date: w.start_time, weight: s.weight_kg, reps: s.reps, oneRM: rm, improvement: rm - bests[ex.title] });
            bests[ex.title] = rm;
          }
        });
      });
    });
    return list.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  }, [workouts]);
  
  if (prs.length === 0) return null;
  return (
    <div className="p-4 rounded-xl bg-white/5">
      <div className="flex items-center gap-2 mb-3"><TrendUp className="text-green-400" size={16} /><h4 className="text-sm font-medium text-white">Recent PRs</h4></div>
      <div className="space-y-2">{prs.map((p, i) => <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-black/20"><Trophy size={14} className="text-green-400" /><div className="flex-1 min-w-0"><p className="text-xs text-white truncate">{p.exercise}</p><p className="text-[10px] text-gray-500">{formatDateShort(p.date)}</p></div><div className="text-right"><p className="text-xs font-bold text-white">{p.weight}kg × {p.reps}</p><p className="text-[10px] text-green-400">+{p.improvement.toFixed(1)}kg</p></div></div>)}</div>
    </div>
  );
};

// ============================================
// MAIN WORKOUT & ANALYTICS SECTION
// ============================================
const WorkoutAnalyticsSection = ({ workouts, conditioning, dateRange, setDateRange }) => {
  const [activeTab, setActiveTab] = useState('push');
  const [expandedWorkouts, setExpandedWorkouts] = useState({});
  const [expandedExercises, setExpandedExercises] = useState({});
  const [showComparison, setShowComparison] = useState(false);
  
  const tabs = [
    { id: 'push', label: 'Push', icon: Dumbbell, color: COLORS.push },
    { id: 'pull', label: 'Pull', icon: ArrowUpRight, color: COLORS.pull },
    { id: 'legs', label: 'Legs', icon: Activity, color: COLORS.legs },
    { id: 'conditioning', label: 'Cardio', icon: Heart, color: COLORS.conditioning },
  ];
  
  const { filteredWorkouts, previousWorkouts, filteredConditioning, previousConditioning } = useMemo(() => {
    let fw = workouts, pw = [], fc = conditioning, pc = [];
    if (dateRange) {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - dateRange);
      fw = workouts.filter(w => new Date(w.start_time) >= cutoff);
      fc = conditioning.filter(c => new Date(c.date) >= cutoff);
      const prevCutoff = new Date(cutoff); prevCutoff.setDate(prevCutoff.getDate() - dateRange);
      pw = workouts.filter(w => { const d = new Date(w.start_time); return d >= prevCutoff && d < cutoff; });
      pc = conditioning.filter(c => { const d = new Date(c.date); return d >= prevCutoff && d < cutoff; });
    }
    if (activeTab !== 'conditioning') {
      const filter = (l) => l.filter(w => w.exercises.some(e => categorizeExercise(e.title).category === activeTab) || w.category === activeTab);
      fw = filter(fw); pw = filter(pw);
    }
    return { filteredWorkouts: fw, previousWorkouts: pw, filteredConditioning: fc, previousConditioning: pc };
  }, [workouts, conditioning, dateRange, activeTab]);
  
  const analytics = useMemo(() => {
    const calc = (wk, cd) => {
      if (activeTab === 'conditioning') {
        const s = cd;
        const dur = s.reduce((a, c) => a + c.duration, 0);
        const avgHR = s.length > 0 ? s.reduce((a, c) => a + c.avgHeartRate, 0) / s.length : 0;
        const maxHR = s.length > 0 ? Math.max(...s.map(c => c.maxHeartRate)) : 0;
        const cal = s.reduce((a, c) => a + c.activeCalories, 0);
        const dist = s.reduce((a, c) => a + (c.distance || 0), 0);
        const runs = s.filter(x => x.category === 'running' && x.pace);
        const avgPace = runs.length > 0 ? runs.reduce((a, r) => a + r.pace, 0) / runs.length : 0;
        const trend = s.slice(0, 12).reverse().map(x => ({ date: formatDateShort(x.date), value: x.avgHeartRate }));
        const byType = {};
        s.forEach(x => { if (!byType[x.category]) byType[x.category] = { count: 0, dur: 0, cal: 0, dist: 0 }; byType[x.category].count++; byType[x.category].dur += x.duration; byType[x.category].cal += x.activeCalories; byType[x.category].dist += x.distance || 0; });
        return { type: 'conditioning', sessions: s.length, totalDuration: Math.round(dur / 60), avgHR: Math.round(avgHR), maxHR, totalCalories: cal, totalDistance: dist.toFixed(1), avgPace, trendData: trend, byType };
      }
      
      const exercises = {};
      const volData = [];
      let sets = 0, reps = 0, vol = 0, warm = 0, work = 0, fail = 0, cal = 0, dur = 0, hrSum = 0, hrC = 0;
      
      wk.forEach(w => {
        let wVol = 0;
        let hasExercisesInCategory = false;
        if (w.appleHealth) { cal += w.appleHealth.activeCalories; dur += w.appleHealth.duration; hrSum += w.appleHealth.avgHeartRate; hrC++; }
        w.exercises.forEach(ex => {
          const { category, muscle } = categorizeExercise(ex.title);
          if (category !== activeTab) return;
          hasExercisesInCategory = true;
          if (!exercises[ex.title]) exercises[ex.title] = { sets: 0, reps: 0, vol: 0, max: 0, warm: 0, work: 0, fail: 0, hist: [] };
          ex.sets.forEach(s => {
            if (s.set_type === 'warmup') { warm++; exercises[ex.title].warm++; return; }
            if (s.set_type === 'failure') { fail++; exercises[ex.title].fail++; } else { work++; exercises[ex.title].work++; }
            exercises[ex.title].sets++;
            exercises[ex.title].reps += s.reps;
            exercises[ex.title].vol += s.weight_kg * s.reps;
            exercises[ex.title].max = Math.max(exercises[ex.title].max, s.weight_kg);
            sets++; reps += s.reps; vol += s.weight_kg * s.reps; wVol += s.weight_kg * s.reps;
          });
          const best = ex.sets.filter(s => s.set_type !== 'warmup').reduce((b, s) => { const rm = calculate1RM(s.weight_kg, s.reps); return rm > (b?.oneRM || 0) ? { ...s, oneRM: rm } : b; }, null);
          if (best) exercises[ex.title].hist.push({ date: w.start_time, weight: best.weight_kg, reps: best.reps, oneRM: best.oneRM });
        });
        // Add to volume data if workout has exercises in this category (even if volume is 0 due to warmup-only or bodyweight)
        if (hasExercisesInCategory) {
          volData.push({ date: formatDateShort(w.start_time), value: wVol });
        }
      });
      
      const sorted = Object.entries(exercises).sort((a, b) => b[1].vol - a[1].vol).slice(0, 8);
      const forecasts = sorted.slice(0, 3).map(([n, d]) => {
        const h = d.hist.sort((a, b) => new Date(a.date) - new Date(b.date));
        const cur = h.length > 0 ? h[h.length - 1].oneRM : 0;
        return { name: n, current: cur, week4: Math.round(cur * 1.06), week8: Math.round(cur * 1.12), week12: Math.round(cur * 1.19) };
      });
      const muscleVol = {};
      wk.forEach(w => w.exercises.forEach(ex => {
        const { category, muscle } = categorizeExercise(ex.title);
        if (category !== activeTab) return;
        if (!muscleVol[muscle]) muscleVol[muscle] = 0;
        ex.sets.forEach(s => { if (s.set_type !== 'warmup') muscleVol[muscle] += s.weight_kg * s.reps; });
      }));
      
      return { type: 'strength', workouts: wk.length, totalSets: sets, totalReps: reps, totalVolume: vol, warmupSets: warm, workingSets: work, failureSets: fail, totalCalories: cal, totalDuration: Math.round(dur / 60), avgWorkoutHR: hrC > 0 ? Math.round(hrSum / hrC) : 0, exercises: sorted, volumeData: volData.reverse().slice(0, 12), forecasts, muscleVolume: muscleVol };
    };
    return { current: calc(filteredWorkouts, filteredConditioning), previous: calc(previousWorkouts, previousConditioning) };
  }, [filteredWorkouts, filteredConditioning, previousWorkouts, previousConditioning, activeTab]);
  
  const toggleWorkout = (id) => setExpandedWorkouts(p => ({ ...p, [id]: !p[id] }));
  const toggleExercise = (id) => setExpandedExercises(p => ({ ...p, [id]: !p[id] }));
  const color = COLORS[activeTab];
  const cur = analytics.current, prev = analytics.previous;
  const cmp = (c, p) => (!p || p === 0) ? null : ((c - p) / p * 100).toFixed(0);
  
  return (
    <div className="card">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === t.id ? `bg-gradient-to-r ${t.color.gradient} text-white shadow-lg ${t.color.glow}` : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
              <t.icon size={16} />{t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowComparison(!showComparison)} className={`px-3 py-1.5 text-xs rounded-md transition-all flex items-center gap-1 ${showComparison ? 'bg-purple-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}><BarChart3 size={14} />Compare</button>
          <DateRangeSelector selectedDays={dateRange} onSelect={setDateRange} />
        </div>
      </div>
      
      {/* Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Stats Column */}
        <div className="lg:col-span-1 space-y-4">
          <div className="p-4 rounded-xl" style={{ backgroundColor: color.bg }}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-400">Overview</h4>
              {showComparison && dateRange && <span className="text-[10px] text-gray-500">vs prev {dateRange}d</span>}
            </div>
            {activeTab === 'conditioning' ? (
              <div className="space-y-3">
                {[
                  { l: 'Sessions', v: cur.sessions, p: prev.sessions },
                  { l: 'Total Time', v: `${cur.totalDuration}m`, p: prev.totalDuration },
                  { l: 'Avg HR', v: `${cur.avgHR} bpm`, p: prev.avgHR },
                  { l: 'Max HR', v: `${cur.maxHR} bpm`, p: prev.maxHR, hl: true },
                  { l: 'Calories', v: cur.totalCalories, p: prev.totalCalories },
                  { l: 'Distance', v: `${cur.totalDistance} km`, p: parseFloat(prev.totalDistance || 0) },
                  { l: 'Avg Pace', v: formatPace(cur.avgPace), p: prev.avgPace, isPace: true },
                ].map((s, i) => {
                  const n = typeof s.v === 'string' ? parseFloat(s.v) : s.v;
                  const c = showComparison && s.p ? cmp(n, s.p) : null;
                  return (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">{s.l}</span>
                      <div className="flex items-center gap-2">
                        {showComparison && c !== null && <span className={`text-xs ${s.isPace ? (parseFloat(c) < 0 ? 'text-green-400' : 'text-red-400') : (parseFloat(c) >= 0 ? 'text-green-400' : 'text-red-400')}`}>{parseFloat(c) >= 0 ? '+' : ''}{c}%</span>}
                        <span className={`text-xl font-bold ${s.hl ? '' : 'text-white'}`} style={s.hl ? { color: color.text } : {}}>{s.v}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { l: 'Workouts', v: cur.workouts, p: prev.workouts },
                  { l: 'Working Sets', v: cur.workingSets, p: prev.workingSets },
                  { l: 'Failure Sets', v: cur.failureSets, p: prev.failureSets, hl: true },
                  { l: 'Total Reps', v: cur.totalReps, p: prev.totalReps },
                  { l: 'Volume', v: `${(cur.totalVolume / 1000).toFixed(1)}t`, p: prev.totalVolume / 1000 },
                  { l: 'Calories', v: cur.totalCalories, p: prev.totalCalories },
                  { l: 'Avg HR', v: `${cur.avgWorkoutHR} bpm`, p: prev.avgWorkoutHR },
                ].map((s, i) => {
                  const n = typeof s.v === 'string' ? parseFloat(s.v) : s.v;
                  const c = showComparison && s.p ? cmp(n, s.p) : null;
                  return (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">{s.l}</span>
                      <div className="flex items-center gap-2">
                        {showComparison && c !== null && <span className={`text-xs ${parseFloat(c) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{parseFloat(c) >= 0 ? '+' : ''}{c}%</span>}
                        <span className={`text-xl font-bold ${s.hl ? '' : 'text-white'}`} style={s.hl ? { color: color.text } : {}}>{s.v}</span>
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2 border-t border-white/10">
                  <p className="text-xs text-gray-500 mb-2">Set Breakdown</p>
                  <div className="flex gap-2">
                    <Tooltip content="Warmup: Prepare muscles for heavy loads"><div className="flex-1 p-2 rounded bg-yellow-500/10 text-center cursor-help"><p className="text-lg font-bold text-yellow-400">{cur.warmupSets}</p><p className="text-[10px] text-gray-500">Warmup</p></div></Tooltip>
                    <Tooltip content="Working: Main training volume"><div className="flex-1 p-2 rounded bg-blue-500/10 text-center cursor-help"><p className="text-lg font-bold text-blue-400">{cur.workingSets}</p><p className="text-[10px] text-gray-500">Working</p></div></Tooltip>
                    <Tooltip content="Failure: RPE 10 (HIT principle)"><div className="flex-1 p-2 rounded bg-red-500/10 text-center cursor-help"><p className="text-lg font-bold text-red-400">{cur.failureSets}</p><p className="text-[10px] text-gray-500">Failure</p></div></Tooltip>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Distribution */}
          {activeTab === 'conditioning' ? (
            <div className="p-4 rounded-xl bg-white/5">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Activity Breakdown</h4>
              <div className="space-y-2">
                {Object.entries(cur.byType || {}).map(([type, data]) => {
                  const total = Object.values(cur.byType || {}).reduce((s, d) => s + d.count, 0) || 1;
                  const colors = { swimming: '#06B6D4', walking: '#10B981', running: '#F59E0B', cycling: '#3B82F6', hiit: '#EF4444' };
                  return (
                    <div key={type}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400 capitalize flex items-center gap-1"><ConditioningIcon type={type} size={12} />{type}</span>
                        <span className="text-white">{data.count} ({Math.round(data.count / total * 100)}%)</span>
                      </div>
                      <ProgressBar value={data.count} max={total} color={colors[type] || '#6B7280'} height={6} />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-white/5">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Muscle Distribution</h4>
              <div className="space-y-2">
                {Object.entries(cur.muscleVolume || {}).map(([muscle, vol]) => {
                  const total = Object.values(cur.muscleVolume || {}).reduce((s, v) => s + v, 0) || 1;
                  return (
                    <div key={muscle}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400 capitalize">{muscle.replace('_', ' ')}</span>
                        <span className="text-white">{Math.round(vol / total * 100)}%</span>
                      </div>
                      <ProgressBar value={vol} max={total} color={color.primary} height={6} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {activeTab !== 'conditioning' && <PRTimeline workouts={filteredWorkouts} />}
        </div>
        
        {/* Charts Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white/5">
              <h4 className="text-sm font-medium text-gray-400 mb-4">{activeTab === 'conditioning' ? 'Heart Rate Trend' : 'Volume Trend'}</h4>
              <div className="h-32">
                <MiniLineChart data={activeTab === 'conditioning' ? cur.trendData : cur.volumeData} color={color.primary} height={120} comparisonData={showComparison ? (activeTab === 'conditioning' ? prev.trendData : prev.volumeData) : null} />
              </div>
              {showComparison && <div className="flex items-center gap-4 mt-2 text-xs"><div className="flex items-center gap-1"><div className="w-3 h-0.5 rounded" style={{ backgroundColor: color.primary }} /><span className="text-gray-400">Current</span></div><div className="flex items-center gap-1"><div className="w-3 h-0.5 rounded bg-gray-500" /><span className="text-gray-500">Previous</span></div></div>}
            </div>
            
            {activeTab === 'conditioning' ? (
              <div className="p-4 rounded-xl bg-white/5">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Recent Sessions</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                  {filteredConditioning.slice(0, 5).map(s => (
                    <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-black/20">
                      <div className="flex items-center gap-2">
                        <ConditioningIcon type={s.category} size={14} style={{ color: color.text }} />
                        <div><p className="text-xs text-white">{s.type}</p><p className="text-[10px] text-gray-500">{formatDateShort(s.date)}</p></div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-white">{formatDuration(s.duration)}</p>
                        <p className="text-[10px] text-gray-500">{s.avgHeartRate}bpm{s.pace && ` • ${formatPace(s.pace)}/km`}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-white/5">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Strength Forecasts (1RM)</h4>
                <div className="space-y-3">
                  {cur.forecasts?.map(f => (
                    <div key={f.name} className="p-2 rounded-lg bg-black/20">
                      <p className="text-xs text-white font-medium mb-1 truncate">{f.name}</p>
                      <div className="grid grid-cols-4 gap-1 text-center">
                        <div><p className="text-[10px] text-gray-500">Now</p><p className="text-sm font-bold text-white">{f.current}</p></div>
                        <div><p className="text-[10px] text-gray-500">4w</p><p className="text-sm font-bold" style={{ color: color.text }}>{f.week4}</p></div>
                        <div><p className="text-[10px] text-gray-500">8w</p><p className="text-sm font-bold" style={{ color: color.text }}>{f.week8}</p></div>
                        <div><p className="text-[10px] text-gray-500">12w</p><p className="text-sm font-bold" style={{ color: color.text }}>{f.week12}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Exercise Breakdown */}
          {activeTab !== 'conditioning' && cur.exercises?.length > 0 && (
            <div className="p-4 rounded-xl bg-white/5">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Exercise Breakdown</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {cur.exercises.map(([name, data]) => (
                  <Tooltip key={name} content={<div><p className="font-medium">{name}</p><p className="text-gray-400">Warmup: {data.warm} • Working: {data.work} • Failure: {data.fail}</p><p className="text-gray-400">Volume: {(data.vol / 1000).toFixed(1)}t</p></div>}>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-black/20 cursor-help hover:bg-black/30 transition-colors">
                      <span className="text-xs text-gray-300 truncate flex-1">{name}</span>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-xs text-gray-500">{data.sets}s</span>
                        {data.fail > 0 && <span className="text-xs text-red-400">{data.fail}F</span>}
                        <span className="text-xs font-medium" style={{ color: color.text }}>{data.max}kg</span>
                      </div>
                    </div>
                  </Tooltip>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Workout Logs */}
      <div className="border-t border-white/10 pt-6">
        <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <CalendarDays size={18} className="text-gray-400" />Workout Log
          <span className="text-sm font-normal text-gray-500 ml-2">({activeTab === 'conditioning' ? filteredConditioning.length : filteredWorkouts.length} entries)</span>
        </h4>
        
        {activeTab === 'conditioning' ? (
          <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
            {filteredConditioning.map(s => (
              <div key={s.id} className="p-4 rounded-xl border transition-all" style={{ backgroundColor: color.bg, borderColor: `${color.primary}30` }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${color.primary}40, ${color.primary}20)` }}>
                      <ConditioningIcon type={s.category} size={20} style={{ color: color.text }} />
                    </div>
                    <div>
                      <p className="text-white font-medium">{s.type}</p>
                      <p className="text-xs text-gray-400">{formatDate(s.date)} • <span className="text-pink-400">Apple Health</span></p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div><p className="text-xs text-gray-500">Duration</p><p className="text-sm font-bold text-white">{formatDuration(s.duration)}</p></div>
                    <div><p className="text-xs text-gray-500">Avg HR</p><p className="text-sm font-bold text-white">{s.avgHeartRate}</p></div>
                    <div><p className="text-xs text-gray-500">Calories</p><p className="text-sm font-bold text-white">{s.activeCalories}</p></div>
                    {s.distance && <div><p className="text-xs text-gray-500">Distance</p><p className="text-sm font-bold text-white">{s.distance}km</p></div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
            {filteredWorkouts.map(w => {
              const expanded = expandedWorkouts[w.id];
              const dur = (new Date(w.end_time) - new Date(w.start_time)) / 1000;
              // Filter exercises by category only
              const catEx = w.exercises.filter(e => {
                const { category } = categorizeExercise(e.title);
                return category === activeTab;
              });

              const stats = catEx.reduce((a, e) => { e.sets.forEach(s => { if (s.set_type === 'warmup') a.warm++; else if (s.set_type === 'failure') a.fail++; else a.work++; }); return a; }, { warm: 0, work: 0, fail: 0 });
              const byMuscle = catEx.reduce((a, e) => { const { muscle } = categorizeExercise(e.title); if (!a[muscle]) a[muscle] = []; a[muscle].push(e); return a; }, {});

              return (
                <div key={w.id} className="rounded-xl border overflow-hidden transition-all" style={{ backgroundColor: color.bg, borderColor: expanded ? color.primary : `${color.primary}30` }}>
                  <div className="p-4 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => toggleWorkout(w.id)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {expanded ? <ChevronDown size={20} style={{ color: color.text }} /> : <ChevronRight size={20} style={{ color: color.text }} />}
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${color.primary}40, ${color.primary}20)` }}>
                          <Dumbbell size={20} style={{ color: color.text }} />
                        </div>
                        <div>
                          <p className="text-white font-medium">{w.title}</p>
                          <p className="text-xs text-gray-400">{formatDate(w.start_time)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2 text-xs">
                          <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400">{stats.warm}W</span>
                          <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">{stats.work}S</span>
                          <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400">{stats.fail}F</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-white">{stats.work + stats.fail} sets</p>
                          <p className="text-xs text-gray-500">{formatDuration(dur)}</p>
                        </div>
                      </div>
                    </div>
                    {/* Apple Health metrics for this workout */}
                    {w.appleHealth && (
                      <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-4 text-xs">
                        <span className="text-pink-400 flex items-center gap-1"><Heart size={12} />Apple Health</span>
                        <span className="text-gray-400">HR: {w.appleHealth.avgHeartRate} avg / {w.appleHealth.maxHeartRate} max</span>
                        <span className="text-gray-400">Calories: {w.appleHealth.activeCalories}</span>
                      </div>
                    )}
                  </div>
                  
                  {expanded && (
                    <div className="border-t border-white/10 p-4 space-y-4">
                      {Object.entries(byMuscle).map(([muscle, exercises]) => (
                        <div key={muscle}>
                          <h5 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color.primary }} />{muscle.replace('_', ' ')}
                          </h5>
                          <div className="space-y-2">
                            {exercises.map((ex, idx) => {
                              const exId = `${w.id}-${muscle}-${idx}`;
                              const exExp = expandedExercises[exId];
                              const warmups = ex.sets.filter(s => s.set_type === 'warmup');
                              const working = ex.sets.filter(s => s.set_type === 'working' || s.set_type === 'normal');
                              const failures = ex.sets.filter(s => s.set_type === 'failure');
                              
                              return (
                                <div key={exId} className="rounded-lg bg-black/20 overflow-hidden">
                                  <div className="p-3 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => toggleExercise(exId)}>
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        {warmups.length > 0 && (exExp ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />)}
                                        <span className="text-sm text-white font-medium">{ex.title}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        {warmups.length > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">{warmups.length}W</span>}
                                        {working.length > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">{working.length}S</span>}
                                        {failures.length > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">{failures.length}F</span>}
                                      </div>
                                    </div>
                                    
                                    {/* Working & Failure Sets */}
                                    <div className="mt-2">
                                      <div className="grid grid-cols-6 gap-2 text-xs text-gray-400 mb-1">
                                        <div>Type</div><div>Set</div><div>Target</div><div>Actual</div><div>Weight</div><div>RPE</div>
                                      </div>
                                      {[...working, ...failures].map((set, si) => (
                                        <div key={si} className="grid grid-cols-6 gap-2 text-xs py-1 border-t border-white/5">
                                          <div><SetTypeBadge type={set.set_type} /></div>
                                          <div className="text-white font-medium">{si + 1}</div>
                                          <div className="text-gray-300">{set.reps + 2}</div>
                                          <div className={`font-medium ${set.set_type === 'failure' ? 'text-red-400' : 'text-white'}`}>{set.reps}</div>
                                          <div className="text-white">{set.weight_kg}kg</div>
                                          <div className={`font-medium ${set.rpe >= 9 ? 'text-red-400' : set.rpe >= 7 ? 'text-yellow-400' : 'text-green-400'}`}>{set.rpe || '-'}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  
                                  {/* Warmup Sets (Collapsible) */}
                                  {exExp && warmups.length > 0 && (
                                    <div className="border-t border-white/5 p-3 bg-yellow-500/5">
                                      <p className="text-xs text-yellow-400 mb-2 flex items-center gap-1"><Sun size={12} />Warmup Sets</p>
                                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-xs">
                                        {warmups.map((s, i) => <div key={i} className="px-2 py-1 rounded bg-yellow-500/10 text-yellow-300">{s.weight_kg}kg × {s.reps}</div>)}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            
            {filteredWorkouts.length === 0 && (
              <div className="text-center py-8">
                <Dumbbell size={48} className="mx-auto mb-3 text-gray-600" />
                <p className="text-gray-400">No workouts found for this period</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// MAIN APP COMPONENT
// ============================================
const App = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [dateRange, setDateRange] = useState(90);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      try {
        // Try to fetch from API (real Hevy data)
        const res = await fetch(`${API_BASE_URL}/data`);
        if (res.ok) {
          const apiData = await res.json();
          if (apiData.workouts && apiData.workouts.length > 0) {
            setData(apiData);
            console.log('✅ Loaded real data from API');
            setLastUpdated(new Date(apiData.lastSync || Date.now()));
            setLoading(false);
            return;
          }
        }
      } catch (error) {
        console.log('API not available, using mock data');
      }
      
      // Fall back to mock data
      await new Promise(r => setTimeout(r, 500));
      setData(generateMockData());
      console.log('📊 Using mock data (API not connected)');
      setLastUpdated(new Date());
      setLoading(false);
    };
    
    loadData();
    
    // Refresh data every 5 minutes to catch auto-syncs
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      // Trigger manual Hevy sync
      const syncRes = await fetch(`${API_BASE_URL}/sync/now`, { method: 'POST' });
      if (syncRes.ok) {
        const syncData = await syncRes.json();
        console.log('Hevy sync complete:', syncData);
      }
      
      // Fetch updated data
      const dataRes = await fetch(`${API_BASE_URL}/data`);
      if (dataRes.ok) {
        const newData = await dataRes.json();
        if (newData.workouts && newData.workouts.length > 0) {
          setData(newData);
        }
      }
    } catch (error) {
      console.log('Using mock data (API not available)');
    }
    setLastUpdated(new Date());
    setLoading(false);
  };

  const handleUploadHevy = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE_URL}/hevy/upload`, { method: 'POST', body: formData });
      if (res.ok) {
        alert('Hevy workouts uploaded! (Sets, reps, weights)');
        handleRefresh();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to upload Hevy data');
      }
    } catch { alert('Server error - ensure backend is running'); }
  };

  const handleUploadHevyMeasurements = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE_URL}/hevy/measurements/upload`, { method: 'POST', body: formData });
      if (res.ok) {
        const result = await res.json();
        alert(`Hevy measurements uploaded! ${result.measurementsCount} entries processed.`);
        handleRefresh();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to upload measurements');
      }
    } catch { alert('Server error - ensure backend is running'); }
  };

  const handleUploadAppleHealth = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE_URL}/apple-health/upload`, { method: 'POST', body: formData });
      if (res.ok) { alert('Apple Health data uploaded! (HR, calories, duration for all workouts)'); handleRefresh(); }
      else alert('Failed to upload Apple Health');
    } catch { alert('Server error - ensure backend is running'); }
  };

  const handleExportJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `hit-tracker-${new Date().toISOString().split('T')[0]}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    if (!data) return;
    const rows = [['Date', 'Workout', 'Exercise', 'SetType', 'Reps', 'Weight', 'RPE']];
    data.workouts.forEach(w => w.exercises.forEach(e => e.sets.forEach(s => rows.push([formatDate(w.start_time), w.title, e.title, s.set_type, s.reps, s.weight_kg, s.rpe || '']))));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `hit-tracker-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-cyan-500 animate-spin" />
            <Dumbbell className="absolute inset-0 m-auto text-cyan-400" size={32} />
          </div>
          <p className="text-gray-400 animate-pulse">Loading your fitness data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl" />
      </div>
      
      {/* Header */}
      <header className="relative z-[1000] border-b border-white/10 backdrop-blur-xl bg-slate-950/80 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25">
                <Dumbbell size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">HIT Tracker Pro</h1>
                <p className="text-xs text-gray-500">Hevy + Apple Health Integration</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs text-gray-500">Last synced</p>
                <p className="text-sm text-gray-300">{lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <button onClick={handleRefresh} disabled={loading} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50">
                <RefreshCw size={18} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <MoreMenu onUploadHevy={handleUploadHevy} onUploadHevyMeasurements={handleUploadHevyMeasurements} onUploadAppleHealth={handleUploadAppleHealth} onExportJson={handleExportJson} onExportCsv={handleExportCsv} />
            </div>
          </div>
        </div>
      </header>
      
      {/* Main */}
      <main className="relative z-0 max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Data Source Info */}
        <div className="p-3 rounded-xl bg-gradient-to-r from-cyan-500/10 to-pink-500/10 border border-cyan-500/20">
          <p className="text-xs text-gray-300 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1"><Dumbbell size={12} className="text-cyan-400" />Hevy: Sets, Reps, Weight, RPE</span>
            <span className="flex items-center gap-1"><Heart size={12} className="text-pink-400" />Apple Health: HR, Calories, Duration</span>
            <span className="flex items-center gap-1"><Activity size={12} className="text-green-400" />Conditioning: Apple Health Only</span>
          </p>
        </div>
        
        {/* Achievement Panel - Full Width Row */}
        <section>
          <AchievementPanel workouts={data.workouts} conditioning={data.conditioning} bodyweight={data.measurements.current.weight} />
        </section>

        {/* Main Stats Row - 3 Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          <KeyLiftsCard workouts={data.workouts} bodyweight={data.measurements.current.weight} />
          <MeasurementsCard measurements={data.measurements} />
          <WeeklyInsightsCard workouts={data.workouts} conditioning={data.conditioning} appleHealth={data.appleHealth} />
        </section>
        
        {/* Analytics + Logs */}
        <section>
          <WorkoutAnalyticsSection workouts={data.workouts} conditioning={data.conditioning} dateRange={dateRange} setDateRange={setDateRange} />
        </section>
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-500">Built with ❤️ following Mike Mentzer's HIT methodology</p>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />Hevy Connected</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />Apple Health Synced</span>
            </div>
          </div>
        </div>
      </footer>
      
      {/* Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
        .card {
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(15, 23, 42, 0.7) 100%);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1rem;
          padding: 1.25rem;
          transition: all 0.3s ease;
        }
        .card:hover { border-color: rgba(255, 255, 255, 0.15); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); border-radius: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }
      `}</style>
    </div>
  );
};

export default App;
