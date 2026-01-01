import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  AlertTriangle, CheckCircle, Circle, Flame as Fire, Waves, Bike, Trash2
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
// DATA NORMALIZATION - Handles any format
// ============================================

const normalizeMeasurements = (raw) => {
  if (!raw) return { current: {}, starting: {}, history: [] };

  const normalize = (obj) => {
    if (!obj) return {};
    return {
      weight: obj.weight ?? obj.weight_kg ?? obj.bodyMass ?? null,
      bodyFat: obj.bodyFat ?? obj.fat_percent ?? obj.body_fat ?? obj.fatPercent ?? null,
      leanMass: obj.leanMass ?? obj.lean_mass ?? obj.leanBodyMass ?? null,
      neck: obj.neck ?? obj.neck_in ?? obj.neckIn ?? null,
      shoulders: obj.shoulders ?? obj.shoulder_in ?? obj.shoulderIn ?? null,
      chest: obj.chest ?? obj.chest_in ?? obj.chestIn ?? null,
      leftBicep: obj.leftBicep ?? obj.left_bicep_in ?? obj.left_bicep ?? null,
      rightBicep: obj.rightBicep ?? obj.right_bicep_in ?? obj.right_bicep ?? null,
      biceps: obj.biceps ?? obj.leftBicep ?? obj.rightBicep ?? obj.left_bicep_in ?? obj.right_bicep_in ?? obj.left_bicep ?? obj.right_bicep ?? null,
      leftForearm: obj.leftForearm ?? obj.left_forearm_in ?? obj.left_forearm ?? null,
      rightForearm: obj.rightForearm ?? obj.right_forearm_in ?? obj.right_forearm ?? null,
      abdomen: obj.abdomen ?? obj.abdomen_in ?? null,
      waist: obj.waist ?? obj.waist_in ?? obj.waistIn ?? null,
      hips: obj.hips ?? obj.hips_in ?? obj.hipsIn ?? null,
      leftThigh: obj.leftThigh ?? obj.left_thigh_in ?? obj.left_thigh ?? null,
      rightThigh: obj.rightThigh ?? obj.right_thigh_in ?? obj.right_thigh ?? null,
      thighs: obj.thighs ?? obj.leftThigh ?? obj.rightThigh ?? obj.left_thigh_in ?? obj.right_thigh_in ?? obj.left_thigh ?? obj.right_thigh ?? null,
      leftCalf: obj.leftCalf ?? obj.left_calf_in ?? obj.left_calf ?? null,
      rightCalf: obj.rightCalf ?? obj.right_calf_in ?? obj.right_calf ?? null,
      calves: obj.calves ?? null,
    };
  };

  return {
    current: normalize(raw.current),
    starting: normalize(raw.starting),
    history: raw.history || [],
    sources: raw.sources || {}
  };
};

const normalizeConditioningSession = (session) => {
  if (!session) return null;

  return {
    id: session.id ?? `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: session.type ?? session.workoutType ?? session.activityType ?? 'Other',
    category: session.category ?? 'other',
    date: session.date ?? session.startDate ?? session.start_time ?? null,
    source: session.source ?? 'Unknown',
    duration: session.duration ?? session.durationSeconds ?? (session.durationMinutes ? session.durationMinutes * 60 : 0),
    activeCalories: session.activeCalories ?? session.calories ?? session.totalCalories ?? session.energyBurned ?? session.active_calories ?? 0,
    avgHeartRate: session.avgHeartRate ?? session.averageHeartRate ?? session.hr_avg ?? session.heartRateAvg ?? session.avg_hr ?? 0,
    maxHeartRate: session.maxHeartRate ?? session.maximumHeartRate ?? session.hr_max ?? session.heartRateMax ?? session.max_hr ?? 0,
    distance: session.distance ?? session.totalDistance ?? session.distanceKm ?? 0,
    pace: session.pace ?? session.avgPace ?? null,
    hrZones: session.hrZones ?? { zone1: 20, zone2: 30, zone3: 30, zone4: 15, zone5: 5 }
  };
};

const normalizeConditioning = (raw) => {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map(normalizeConditioningSession).filter(s => s !== null);
};

const normalizeWorkout = (workout) => {
  if (!workout) return null;

  const appleHealth = workout.appleHealth ? {
    duration: workout.appleHealth.duration ?? workout.appleHealth.durationSeconds ?? 0,
    activeCalories: workout.appleHealth.activeCalories ?? workout.appleHealth.calories ?? workout.appleHealth.totalCalories ?? 0,
    avgHeartRate: workout.appleHealth.avgHeartRate ?? workout.appleHealth.averageHeartRate ?? workout.appleHealth.hr_avg ?? 0,
    maxHeartRate: workout.appleHealth.maxHeartRate ?? workout.appleHealth.maximumHeartRate ?? workout.appleHealth.hr_max ?? 0,
  } : null;

  return {
    ...workout,
    appleHealth
  };
};

const normalizeWorkouts = (raw) => {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map(normalizeWorkout).filter(w => w !== null);
};

const normalizeAppleHealth = (raw) => {
  if (!raw) return { restingHeartRate: null, avgSteps: null, avgActiveCalories: null, sleepAvg: null };
  return {
    restingHeartRate: raw.restingHeartRate ?? raw.resting_hr ?? raw.restingHR ?? null,
    avgSteps: raw.avgSteps ?? raw.steps ?? null,
    avgActiveCalories: raw.avgActiveCalories ?? raw.activeCalories ?? null,
    sleepAvg: raw.sleepAvg ?? raw.sleep ?? null,
  };
};

const normalizeApiData = (raw) => {
  if (!raw) return null;
  return {
    workouts: normalizeWorkouts(raw.workouts),
    conditioning: normalizeConditioning(raw.conditioning),
    measurements: normalizeMeasurements(raw.measurements),
    appleHealth: normalizeAppleHealth(raw.appleHealth),
    nutrition: raw.nutrition || { dailyCalorieIntake: {} },
    lastSync: raw.lastSync,
    lastWebhook: raw.lastWebhook,
  };
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Helper to clean up Apple Health workout type names
const cleanWorkoutType = (type) => {
  if (!type) return 'Other';
  // Remove "HKWorkoutActivityType" prefix
  return type
    .replace('HKWorkoutActivityType', '')
    .replace(/([A-Z])/g, ' $1')  // Add space before capitals
    .trim();
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
const formatSteps = (steps) => { if (!steps || steps === 0) return '0'; if (steps >= 1000) { const k = steps / 1000; return k % 1 === 0 ? `${Math.round(k)}K` : `${k.toFixed(1)}K`; } return Math.round(steps).toString(); };
const formatDistance = (meters) => { if (!meters || meters === 0) return null; const miles = meters / 1609.34; if (miles >= 10) return `${Math.round(miles)} mi`; if (miles >= 1) return `${miles.toFixed(1)} mi`; return `${miles.toFixed(2)} mi`; };
const estimateSteps = (distanceMeters) => distanceMeters > 0 ? Math.round((distanceMeters / 1000) * 1300) : 0; // ~1300 steps per km
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
    appleHealth: { restingHeartRate: null, avgSteps: null, avgActiveCalories: null, sleepAvg: null },
    nutrition: { dailyCalorieIntake: {} }
  };
};

// ============================================
// TOOLTIP COMPONENT - Mobile Modal Support
// ============================================
const Tooltip = ({ children, content, position = 'top' }) => {
  const [show, setShow] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);

  useEffect(() => {
    // Detect mobile
    setIsMobile(window.innerWidth < 640);
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleOpen = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (isMobile) {
        // Center on screen for mobile
        setCoords({
          top: viewportHeight / 2,
          left: viewportWidth / 2,
        });
      } else {
        // Position near element for desktop
        let top = rect.top - 10;
        let left = rect.left + rect.width / 2;

        // Keep within viewport
        const tooltipWidth = 250;
        if (left - tooltipWidth/2 < 10) left = tooltipWidth/2 + 10;
        if (left + tooltipWidth/2 > viewportWidth - 10) left = viewportWidth - tooltipWidth/2 - 10;
        if (top < 100) top = rect.bottom + 10;

        setCoords({ top, left });
      }
    }
    setShow(true);
  };

  const handleClose = () => setShow(false);

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-block cursor-help"
        onMouseEnter={!isMobile ? handleOpen : undefined}
        onMouseLeave={!isMobile ? handleClose : undefined}
        onClick={isMobile ? handleOpen : undefined}
      >
        {children}
      </span>

      {show && createPortal(
        <>
          {/* Backdrop for mobile */}
          {isMobile && (
            <div
              className="fixed inset-0 bg-black/50 z-[99998]"
              onClick={handleClose}
            />
          )}

          {/* Tooltip content */}
          <div
            className={`fixed z-[99999] bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-4 ${
              isMobile
                ? 'w-[90vw] max-w-[320px] -translate-x-1/2 -translate-y-1/2'
                : 'w-[250px] -translate-x-1/2 -translate-y-full'
            }`}
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
            }}
            onClick={isMobile ? handleClose : undefined}
          >
            {/* Close button for mobile */}
            {isMobile && (
              <button
                className="absolute top-2 right-2 text-slate-400 hover:text-white"
                onClick={handleClose}
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <div className="text-sm">{content}</div>

            {isMobile && (
              <div className="text-xs text-slate-500 mt-2 text-center">Tap to close</div>
            )}
          </div>
        </>,
        document.body
      )}
    </>
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

const MoreMenu = ({ onUploadHevy, onUploadHevyMeasurements, onUploadAppleHealth, onUploadAppleHealthCSV, onExportJson, onExportCsv, onReset }) => {
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
            <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer"><Upload size={16} className="text-cyan-400" /><span className="text-sm text-white">Hevy Workouts (JSON/CSV)</span><input type="file" accept=".json,.csv" onChange={(e) => { onUploadHevy(e); setIsOpen(false); }} className="hidden" /></label>
            <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer"><Upload size={16} className="text-blue-400" /><span className="text-sm text-white">Hevy Measurements (CSV)</span><input type="file" accept=".csv" onChange={(e) => { onUploadHevyMeasurements(e); setIsOpen(false); }} className="hidden" /></label>
            <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer"><Upload size={16} className="text-pink-400" /><span className="text-sm text-white">Apple Health (XML)</span><input type="file" accept=".xml,.zip" onChange={(e) => { onUploadAppleHealth(e); setIsOpen(false); }} className="hidden" /></label>
            <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer"><Upload size={16} className="text-rose-400" /><span className="text-sm text-white">Apple Health (CSV)</span><input type="file" accept=".csv" onChange={(e) => { onUploadAppleHealthCSV(e); setIsOpen(false); }} className="hidden" /></label>
          </div>
          <div className="p-2 border-b border-white/10">
            <p className="text-xs text-gray-500 px-2 py-1">Export</p>
            <button onClick={() => { onExportJson(); setIsOpen(false); }} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 w-full"><FileJson size={16} className="text-amber-400" /><span className="text-sm text-white">JSON</span></button>
            <button onClick={() => { onExportCsv(); setIsOpen(false); }} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 w-full"><FileText size={16} className="text-green-400" /><span className="text-sm text-white">CSV</span></button>
          </div>
          <div className="p-2">
            <p className="text-xs text-gray-500 px-2 py-1">Actions</p>
            <button onClick={() => { onReset(); setIsOpen(false); }} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-500/10 w-full"><Trash2 size={16} className="text-red-400" /><span className="text-sm text-red-400">Reset All Data</span></button>
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
      <div className="grid grid-cols-1 gap-3">
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
// Weight Trend Section Component
const WeightTrendSection = ({ weightData, trendChange }) => {
  const weights = weightData.map(d => d.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;

  // Determine if trend is good or bad (assuming cutting goal - weight loss is good)
  const isGoodTrend = trendChange < 0; // For cutting: losing weight is good
  const borderColor = isGoodTrend ? 'border-green-500/30' : 'border-red-500/30';
  const bgColor = isGoodTrend ? 'from-green-500/10 to-green-600/5' : 'from-red-500/10 to-red-600/5';
  const lineColor = isGoodTrend ? '#22c55e' : '#ef4444';

  const width = 280;
  const height = 50;
  const padding = 8;

  const points = weights.map((w, i) => {
    const x = padding + (i / (weights.length - 1)) * (width - padding * 2);
    const y = height - padding - ((w - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;

  return (
    <div className={`bg-gradient-to-br ${bgColor} rounded-xl p-4 border ${borderColor}`}>
      <div className="flex justify-between items-center mb-2">
        <div className="text-xs text-slate-400">Weight Trend (30d)</div>
        <div className={`text-sm font-medium ${isGoodTrend ? 'text-green-400' : 'text-red-400'}`}>
          {trendChange > 0 ? '+' : ''}{trendChange.toFixed(1)} kg
        </div>
      </div>
      <svg width={width} height={height} className="w-full">
        <line x1={padding} y1={height/2} x2={width-padding} y2={height/2} stroke="#334155" strokeWidth="1" strokeDasharray="4"/>
        <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx={parseFloat(points[points.length-1]?.split(',')[0]) || 0} cy={parseFloat(points[points.length-1]?.split(',')[1]) || 0} r="4" fill={lineColor}/>
      </svg>
      <div className="flex justify-between text-[10px] text-slate-500 mt-1">
        <span>{min.toFixed(1)} kg</span>
        <span>{max.toFixed(1)} kg</span>
      </div>
    </div>
  );
};

const MeasurementsCard = ({ measurements }) => {
  const current = measurements?.current || {};
  const starting = measurements?.starting || {};
  const history = measurements?.history || [];

  const weight = current.weight || 0;
  const bodyFat = current.bodyFat || 0;
  const waist = current.waist || 0;
  const chest = current.chest || 0;
  const shoulders = current.shoulders || 0;

  const height = 1.75; // meters - adjust as needed
  const bmi = weight > 0 ? (weight / (height * height)).toFixed(1) : null;

  const getBmiCategory = (bmi) => {
    if (!bmi) return { label: 'No data', color: 'text-slate-400' };
    if (bmi < 18.5) return { label: 'Underweight', color: 'text-blue-400' };
    if (bmi < 25) return { label: 'Normal', color: 'text-green-400' };
    if (bmi < 30) return { label: 'Overweight', color: 'text-yellow-400' };
    return { label: 'Obese', color: 'text-red-400' };
  };

  const bmiInfo = getBmiCategory(parseFloat(bmi));

  // Calculate percentage change
  const calcChange = (current, starting) => {
    if (!current || !starting || starting === 0) return null;
    return ((current - starting) / starting) * 100;
  };

  // For waist: decrease is good (green), increase is bad (red)
  // For chest/shoulders: increase is good (green), decrease is bad (red)
  const waistChange = calcChange(waist, starting.waist);
  const chestChange = calcChange(chest, starting.chest);
  const shouldersChange = calcChange(shoulders, starting.shoulders);
  const bodyFatChange = calcChange(bodyFat, starting.bodyFat);
  const weightChange = calcChange(weight, starting.weight);

  // Weight trend calculation
  const weightData = history.filter(h => h.weight && h.weight > 0).slice(0, 30).reverse();
  const hasWeightTrend = weightData.length >= 2;
  const weightTrendChange = hasWeightTrend ? weightData[weightData.length - 1].weight - weightData[0].weight : 0;

  return (
    <div className="card h-full">
      <div className="flex items-center gap-2 mb-4">
        <Scale className="text-blue-400" size={20} />
        <h3 className="text-lg font-semibold text-white">Body Composition</h3>
      </div>
      <div className="space-y-4">

        {/* Row 1: Weight + Measurements */}
        <div className="grid grid-cols-2 gap-3">
          {/* Weight Card - Blue */}
          <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl p-4 border border-blue-500/20">
            <div className="text-xs text-blue-300 mb-1">Weight</div>
            <div className="text-2xl font-bold">{weight}<span className="text-sm text-slate-400 ml-1">kg</span></div>
            {weightChange !== null && (
              <div className={`text-xs mt-1 ${weightChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)}%
              </div>
            )}
          </div>

          {/* Measurements Card - Slate */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="text-xs text-slate-400 mb-2">Measurements</div>
            <div className="space-y-1 text-sm">
              {waist > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Waist</span>
                  <span className="flex items-center gap-1">
                    {waist}"
                    {waistChange !== null && (
                      <span className={`text-xs ${waistChange < 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {waistChange > 0 ? '↑' : '↓'}{Math.abs(waistChange).toFixed(1)}%
                      </span>
                    )}
                  </span>
                </div>
              )}
              {chest > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Chest</span>
                  <span className="flex items-center gap-1">
                    {chest}"
                    {chestChange !== null && (
                      <span className={`text-xs ${chestChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {chestChange > 0 ? '↑' : '↓'}{Math.abs(chestChange).toFixed(1)}%
                      </span>
                    )}
                  </span>
                </div>
              )}
              {shoulders > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Shoulders</span>
                  <span className="flex items-center gap-1">
                    {shoulders}"
                    {shouldersChange !== null && (
                      <span className={`text-xs ${shouldersChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {shouldersChange > 0 ? '↑' : '↓'}{Math.abs(shouldersChange).toFixed(1)}%
                      </span>
                    )}
                  </span>
                </div>
              )}
              {!waist && !chest && !shoulders && (
                <span className="text-slate-500 text-xs">No data</span>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: BMI + Body Fat - Purple Card */}
        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-xl p-4 border border-purple-500/20">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs text-purple-300 mb-1">BMI</div>
              <div className="text-2xl font-bold">{bmi || '--'}</div>
              <div className={`text-xs ${bmiInfo.color}`}>{bmiInfo.label}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-purple-300 mb-1">Body Fat</div>
              <div className="text-2xl font-bold">{bodyFat || '--'}<span className="text-sm text-slate-400">%</span></div>
              {bodyFatChange !== null && (
                <div className={`text-xs ${bodyFatChange < 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {bodyFatChange > 0 ? '+' : ''}{bodyFatChange.toFixed(1)}%
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: Weight Trend - Color coded based on trend */}
        {hasWeightTrend && (
          <WeightTrendSection weightData={weightData} trendChange={weightTrendChange} />
        )}

      </div>
    </div>
  );
};

// ============================================
// CALORIE INSIGHT COMPONENT
// ============================================
const CalorieInsight = ({ nutrition, conditioning, workouts, dateRange }) => {
  // Calculate calories consumed (from nutrition.dailyCalorieIntake)
  const dailyIntake = nutrition?.dailyCalorieIntake || {};

  // Filter by date range
  const now = new Date();
  const daysBack = dateRange === '7D' ? 7 : dateRange === '30D' ? 30 : dateRange === '90D' ? 90 : 7;
  const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

  const consumedCalories = Object.entries(dailyIntake)
    .filter(([date]) => new Date(date) >= startDate)
    .reduce((sum, [_, cal]) => sum + (cal || 0), 0);

  // Calculate calories burned (from workouts + conditioning)
  const workoutCalories = (workouts || [])
    .filter(w => new Date(w.start_time) >= startDate)
    .reduce((sum, w) => sum + (w.appleHealth?.activeCalories || 0), 0);

  const conditioningCalories = (conditioning || [])
    .filter(c => new Date(c.date) >= startDate)
    .reduce((sum, c) => sum + (c.activeCalories || c.calories || 0), 0);

  const burnedCalories = workoutCalories + conditioningCalories;

  // Calculate balance
  const balance = consumedCalories - burnedCalories;
  const dailyAvgBalance = balance / daysBack;

  // Estimate weekly weight change (3500 cal = ~0.45kg)
  const weeklyWeightChange = (dailyAvgBalance * 7) / 7700; // 7700 cal = 1kg

  // Determine goal status
  const getGoalStatus = () => {
    if (dailyAvgBalance < -300) return { label: 'Cutting', color: 'text-red-400', icon: '🔥' };
    if (dailyAvgBalance > 300) return { label: 'Bulking', color: 'text-green-400', icon: '💪' };
    return { label: 'Maintaining', color: 'text-blue-400', icon: '⚖️' };
  };

  const goal = getGoalStatus();

  if (consumedCalories === 0 && burnedCalories === 0) {
    return null; // Don't show if no data
  }

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 mt-4">
      <div className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
        <Flame className="w-4 h-4 text-orange-400" />
        Calorie Balance ({daysBack}d)
      </div>

      <div className="space-y-2 text-sm">
        {consumedCalories > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-400">Consumed</span>
            <span className="text-green-400">{Math.round(consumedCalories).toLocaleString()} kcal</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-400">Burned (exercise)</span>
          <span className="text-red-400">{Math.round(burnedCalories).toLocaleString()} kcal</span>
        </div>

        {consumedCalories > 0 && (
          <>
            <div className="border-t border-slate-700 my-2"></div>
            <div className="flex justify-between font-medium">
              <span className="text-slate-300">Balance</span>
              <span className={balance < 0 ? 'text-red-400' : 'text-green-400'}>
                {balance > 0 ? '+' : ''}{Math.round(balance).toLocaleString()} kcal
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Est. weekly change</span>
              <span className={weeklyWeightChange < 0 ? 'text-red-400' : 'text-green-400'}>
                {weeklyWeightChange > 0 ? '+' : ''}{weeklyWeightChange.toFixed(2)} kg/week
              </span>
            </div>

            <div className="mt-3 flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-900/50">
              <span className="text-lg">{goal.icon}</span>
              <span className={`font-medium ${goal.color}`}>{goal.label}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ============================================
// BATTERY INDICATOR WITH FILL LEVEL
// ============================================
const BatteryIndicator = ({ percentage, color }) => {
  const fillHeight = Math.max(2, (percentage / 100) * 10); // 10px max height
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      {/* Battery outline */}
      <rect x="3" y="6" width="18" height="12" rx="2" ry="2" />
      {/* Battery terminal */}
      <line x1="23" y1="10" x2="23" y2="14" strokeLinecap="round" />
      {/* Fill level */}
      <rect
        x="5"
        y={18 - fillHeight}
        width="14"
        height={fillHeight}
        fill={color}
        opacity="0.8"
        rx="1"
      />
    </svg>
  );
};

// ============================================
// REST DAY & SLEEP CARD
// ============================================
const RestDaySleepCard = ({ restDays, sleepData, recovery, recColor, recStatus }) => {
  const avgSleep = sleepData?.avgHours || 0;
  const lastNightSleep = sleepData?.lastNight || 0;
  const sleepDebt = sleepData?.debt || 0;
  const sleepConsistency = sleepData?.consistency || 0;

  // Determine card style based on recovery status
  const getCardStyle = () => {
    switch (recStatus) {
      case 'ready':
        return {
          bg: 'from-green-500/20 to-green-600/10',
          border: 'border-green-500/30',
          accent: 'text-green-400',
          icon: '💪',
          message: 'Well rested - Ready for intense workout!',
        };
      case 'moderate':
        return {
          bg: 'from-amber-500/20 to-amber-600/10',
          border: 'border-amber-500/30',
          accent: 'text-amber-400',
          icon: '⚡',
          message: 'Moderate recovery - Light workout or cardio recommended',
        };
      case 'fatigued':
        return {
          bg: 'from-red-500/20 to-red-600/10',
          border: 'border-red-500/30',
          accent: 'text-red-400',
          icon: '😴',
          message: 'Fatigued - Consider rest or very light activity',
        };
      default:
        return {
          bg: 'from-slate-500/20 to-slate-600/10',
          border: 'border-slate-500/30',
          accent: 'text-slate-400',
          icon: '📊',
          message: 'Insufficient data',
        };
    }
  };

  const style = getCardStyle();

  // Sleep quality rating
  const getSleepQuality = (hours) => {
    if (hours >= 7 && hours <= 9) return { label: 'Optimal', color: 'text-green-400' };
    if (hours >= 6) return { label: 'Adequate', color: 'text-amber-400' };
    return { label: 'Poor', color: 'text-red-400' };
  };

  const sleepQuality = getSleepQuality(avgSleep);

  return (
    <div className={`bg-gradient-to-br ${style.bg} rounded-xl p-4 border ${style.border} col-span-2`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Moon className="w-5 h-5 text-indigo-400" />
          <span className="font-medium text-slate-200">Recovery & Sleep</span>
        </div>
        <div className="text-2xl">{style.icon}</div>
      </div>

      {/* Main Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Recovery Score */}
        <div className="text-center">
          <div className={`text-3xl font-bold ${style.accent}`}>{recovery}%</div>
          <div className="text-xs text-slate-400">Recovery Score</div>
        </div>

        {/* Rest Days */}
        <div className="text-center">
          <div className="text-3xl font-bold text-slate-200">{restDays}</div>
          <div className="text-xs text-slate-400">Rest Days</div>
        </div>

        {/* Avg Sleep */}
        <div className="text-center">
          <div className="text-3xl font-bold text-indigo-400">
            {avgSleep > 0 ? avgSleep.toFixed(1) : '--'}<span className="text-lg">h</span>
          </div>
          <div className="text-xs text-slate-400">Avg Sleep</div>
        </div>
      </div>

      {/* Sleep Details */}
      {avgSleep > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-slate-900/30 rounded-lg p-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Last Night</span>
              <span className="font-medium">{lastNightSleep.toFixed(1)}h</span>
            </div>
          </div>
          <div className="bg-slate-900/30 rounded-lg p-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Sleep Quality</span>
              <span className={`font-medium ${sleepQuality.color}`}>{sleepQuality.label}</span>
            </div>
          </div>
          {sleepDebt > 0.5 && (
            <div className="bg-slate-900/30 rounded-lg p-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Sleep Debt</span>
                <span className="font-medium text-red-400">-{sleepDebt.toFixed(1)}h</span>
              </div>
            </div>
          )}
          <div className="bg-slate-900/30 rounded-lg p-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Consistency</span>
              <span className="font-medium">{Math.round(sleepConsistency * 100)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Status Message */}
      <div className={`text-center text-sm ${style.accent} font-medium py-2 bg-slate-900/30 rounded-lg`}>
        {style.message}
      </div>
    </div>
  );
};

// ============================================
// SLEEP DATA CALCULATION
// ============================================
const calculateSleepData = (appleHealth) => {
  const sleepRecords = appleHealth?.sleepRecords || [];

  if (sleepRecords.length === 0) {
    return {
      avgHours: 0,
      lastNight: 0,
      debt: 0,
      consistency: 0,
    };
  }

  // Sort by date (newest first)
  const sorted = [...sleepRecords].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Last 7 days for average
  const last7Days = sorted.slice(0, 7);
  const avgHours = last7Days.reduce((sum, r) => sum + (r.hours || 0), 0) / last7Days.length;

  // Last night
  const lastNight = sorted[0]?.hours || 0;

  // Sleep debt (ideal is 7.5 hours)
  const idealSleep = 7.5;
  const debt = Math.max(0, (idealSleep * 7) - last7Days.reduce((sum, r) => sum + (r.hours || 0), 0)) / 7;

  // Consistency (standard deviation based)
  const mean = avgHours;
  const variance = last7Days.reduce((sum, r) => sum + Math.pow((r.hours || 0) - mean, 2), 0) / last7Days.length;
  const stdDev = Math.sqrt(variance);
  // Lower stdDev = more consistent. 0 stdDev = 100%, 2+ stdDev = ~50%
  const consistency = Math.max(0, Math.min(1, 1 - (stdDev / 2)));

  return {
    avgHours,
    lastNight,
    debt,
    consistency,
  };
};

// ============================================
// WEEKLY INSIGHTS CARD
// ============================================
const WeeklyInsightsCard = ({ workouts, conditioning, appleHealth, nutrition, dateRange }) => {
  const lastDate = workouts.length > 0 ? new Date(Math.max(...workouts.map(w => new Date(w.start_time)))) : null;
  const restDays = lastDate ? daysSince(lastDate) : 0;

  const stats = useMemo(() => {
    let rpeT = 0, rpeC = 0, warm = 0, work = 0, fail = 0;
    workouts.slice(0, 10).forEach(w => {
      w.exercises.forEach(e => e.sets.forEach(s => {
        if (s.rpe) { rpeT += s.rpe; rpeC++; }
        if (s.set_type === 'warmup') warm++; else if (s.set_type === 'failure') fail++; else work++;
      }));
    });
    return { avgRPE: rpeC > 0 ? (rpeT / rpeC).toFixed(1) : 0, warmupSets: warm, workingSets: work, failureSets: fail };
  }, [workouts]);

  // Calculate Avg Steps from conditioning data
  const avgSteps = useMemo(() => {
    const sessions = conditioning || [];
    const withSteps = sessions.filter(s => s.steps && s.steps > 0);
    if (withSteps.length === 0) return 0;
    return Math.round(withSteps.reduce((sum, s) => sum + s.steps, 0) / withSteps.length);
  }, [conditioning]);

  // Calculate sleep data
  const sleepData = useMemo(() => calculateSleepData(appleHealth), [appleHealth]);

  // Enhanced Recovery Score with Sleep Data
  // Components: Rest Days (40%), RPE (25%), Sleep (35%)
  const restScore = Math.min(100, restDays === 0 ? 20 : restDays === 1 ? 50 : restDays === 2 ? 75 : 100);
  const rpeScore = Math.max(0, 100 - (stats.avgRPE * 7)); // RPE 10 = 30%, RPE 0 = 100%

  // Sleep score
  const avgSleepHours = sleepData.avgHours;
  const sleepConsistency = sleepData.consistency;
  let sleepDurationScore;
  if (avgSleepHours >= 7 && avgSleepHours <= 9) {
    sleepDurationScore = 100;
  } else if (avgSleepHours >= 6 && avgSleepHours < 7) {
    sleepDurationScore = 70;
  } else if (avgSleepHours >= 5 && avgSleepHours < 6) {
    sleepDurationScore = 50;
  } else if (avgSleepHours > 9) {
    sleepDurationScore = 85;
  } else {
    sleepDurationScore = 30;
  }
  const sleepScore = (sleepDurationScore * 0.7) + (sleepConsistency * 100 * 0.3);

  // Weighted final recovery score
  const recovery = Math.round(
    (restScore * 0.40) +
    (rpeScore * 0.25) +
    (sleepScore * 0.35)
  );

  const recStatus = recovery >= 75 ? 'ready' : recovery >= 50 ? 'moderate' : 'fatigued';
  const recColor = recovery >= 75 ? '#10B981' : recovery >= 50 ? '#F59E0B' : '#EF4444';

  return (
    <div className="card h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="text-purple-400" size={20} />
          <h3 className="text-lg font-semibold text-white">Weekly Insights</h3>
        </div>
      </div>

      <div className="space-y-4">
        {/* Row 1: Rest & Sleep Card (full width) */}
        <RestDaySleepCard
          restDays={restDays}
          sleepData={sleepData}
          recovery={recovery}
          recColor={recColor}
          recStatus={recStatus}
        />

        {/* Row 2: Avg RPE + Avg Steps */}
        <div className="grid grid-cols-2 gap-3">
          <Tooltip content={<div><p className="font-medium">RPE Scale</p><p className="text-gray-400">7-8: Hard • 9: Very hard • 10: Failure</p></div>}>
            <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/20 cursor-help">
              <div className="flex items-center gap-1 text-yellow-300 text-xs mb-1">
                <Zap className="w-3 h-3" />
                Avg RPE
              </div>
              <div className="text-xl font-bold">{stats.avgRPE}</div>
            </div>
          </Tooltip>
          <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/20">
            <div className="flex items-center gap-1 text-green-300 text-xs mb-1">
              <Footprints className="w-3 h-3" />
              Avg Steps
            </div>
            <div className="text-xl font-bold">
              {avgSteps >= 1000 ? `${(avgSteps / 1000).toFixed(1)}K` : avgSteps || 0}
            </div>
          </div>
        </div>

        {/* Row 3: Set Breakdown */}
        <div className="flex justify-around py-2">
          <Tooltip content="Warmup: Prepare for heavy work">
            <div className="text-center cursor-help">
              <div className="text-2xl font-bold text-orange-400">{stats.warmupSets}</div>
              <div className="text-xs text-slate-500">Warmup</div>
            </div>
          </Tooltip>
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-200">{stats.workingSets}</div>
            <div className="text-xs text-slate-500">Working</div>
          </div>
          <Tooltip content="Failure: RPE 10 (HIT principle)">
            <div className="text-center cursor-help">
              <div className="text-2xl font-bold text-red-400">{stats.failureSets}</div>
              <div className="text-xs text-slate-500">Failure</div>
            </div>
          </Tooltip>
        </div>
      </div>

      {/* Calorie Insight */}
      <CalorieInsight
        nutrition={nutrition}
        conditioning={conditioning}
        workouts={workouts}
        dateRange={dateRange}
      />
    </div>
  );
};

// ============================================
// ACHIEVEMENT PANEL
// ============================================
const AchievementPanel = ({ workouts, conditioning, bodyweight }) => {
  const [isExpanded, setIsExpanded] = useState(true);

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
    conditioning.forEach(c => { cal += (c.calories || 0); if (c.category === 'swimming' && c.distance) swimD += c.distance; if (c.category === 'walking' && c.distance) walkD += c.distance; });

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
      <div
        className="flex items-center justify-between mb-4 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Award className="text-amber-400" size={20} />
          <h3 className="text-lg font-semibold text-white">Achievements</h3>
          {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-400">{ach.earned.length} Earned</span>
      </div>
      {isExpanded && (
        <>
          <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-purple-500/10 border border-amber-500/20">
            <p className="text-xs text-gray-400 mb-2">Key Lifts (1RM)</p>
            <div className="grid grid-cols-5 gap-2 text-center">
              {[{ n: 'Inc', v: ach.lifts.incline }, { n: 'OHP', v: ach.lifts.shoulder }, { n: 'Sqt', v: ach.lifts.squat }, { n: 'Lat', v: ach.lifts.lat }, { n: 'DL', v: ach.lifts.deadlift }].map(l => (
                <div key={l.n} className="min-w-[50px]">
                  <div className="text-sm sm:text-lg font-bold text-white whitespace-nowrap">
                    {l.v}
                    <span className="text-[10px] text-gray-400">kg</span>
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-gray-500 truncate">{l.n}</div>
                </div>
              ))}
            </div>
          </div>
          {ach.earned.length > 0 && <div className="mb-3"><p className="text-xs text-gray-500 mb-2">EARNED</p><div className="grid grid-cols-2 gap-2">{ach.earned.slice(0, 4).map((a, i) => <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10"><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${a.color}20` }}><a.icon size={14} style={{ color: a.color }} /></div><p className="text-[11px] font-medium text-white truncate">{a.title}</p></div>)}</div></div>}
          <div><p className="text-xs text-gray-500 mb-2">IN PROGRESS</p><div className="space-y-2">{ach.inProgress.slice(0, 3).map((a, i) => <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-white/5"><div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/10"><a.icon size={14} className="text-gray-400" /></div><div className="flex-1"><div className="flex items-center justify-between mb-1"><p className="text-[11px] font-medium text-white">{a.title}</p><p className="text-[10px] text-gray-400">{a.progress}{a.unit || ''}/{a.target}{a.unit || ''}</p></div><ProgressBar value={parseFloat(a.progress)} max={a.target} color={a.color} height={3} /></div></div>)}</div></div>
        </>
      )}
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
// CARDIO TAB COMPONENTS
// ============================================
const CardioHealthCard = ({ appleHealth, conditioning }) => {
  const restingHR = appleHealth?.restingHeartRate || 0;
  const sleepAvg = appleHealth?.sleepAvg || 0;

  // Calculate HR zones from conditioning
  const avgSessionHR = conditioning?.length > 0
    ? Math.round(conditioning.reduce((sum, c) => sum + (c.avgHeartRate || 0), 0) / conditioning.filter(c => c.avgHeartRate > 0).length)
    : 0;

  return (
    <div className="p-4 rounded-xl bg-white/5">
      <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
        <Heart className="w-4 h-4 text-red-400" />
        Health Metrics
      </h4>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
            <div className="text-xs text-red-300">Resting HR</div>
            <div className="text-xl font-bold">{restingHR} <span className="text-sm text-slate-400">bpm</span></div>
            <div className="text-xs text-slate-500">{restingHR < 60 ? 'Excellent' : restingHR < 70 ? 'Good' : 'Average'}</div>
          </div>
          <div className="bg-indigo-500/10 rounded-lg p-3 border border-indigo-500/20">
            <div className="text-xs text-indigo-300">Avg Sleep</div>
            <div className="text-xl font-bold">{sleepAvg.toFixed(1)} <span className="text-sm text-slate-400">hrs</span></div>
            <div className="text-xs text-slate-500">{sleepAvg >= 7 ? 'Optimal' : sleepAvg >= 6 ? 'Adequate' : 'Low'}</div>
          </div>
        </div>
        {avgSessionHR > 0 && (
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-xs text-slate-400">Avg Workout HR</div>
            <div className="text-lg font-bold">{avgSessionHR} bpm</div>
          </div>
        )}
      </div>
    </div>
  );
};

const CardioAchievementsCard = ({ conditioning }) => {
  // Calculate cardio achievements
  const totalDistanceMeters = conditioning?.reduce((sum, c) => sum + (c.distance || 0), 0) || 0;
  const totalDistanceMiles = totalDistanceMeters / 1609.34; // meters to miles
  const totalSessions = conditioning?.length || 0;
  const totalCalories = conditioning?.reduce((sum, c) => sum + (c.activeCalories || c.calories || 0), 0) || 0;
  const longestSession = Math.max(...(conditioning?.map(c => c.duration || 0) || [0])) / 60; // minutes

  // Progressive milestones - each achievement advances when completed
  const getProgressiveMilestone = (current, milestones) => {
    for (let i = 0; i < milestones.length; i++) {
      if (current < milestones[i]) return milestones[i];
    }
    return milestones[milestones.length - 1];
  };

  const distanceMilestones = [26.2, 50, 100, 200, 500]; // miles
  const sessionMilestones = [50, 100, 250, 500, 1000];
  const calorieMilestones = [10000, 25000, 50000, 100000, 250000];
  const durationMilestones = [30, 60, 90, 120, 180]; // minutes

  const achievements = [
    {
      name: 'Distance Runner',
      target: getProgressiveMilestone(totalDistanceMiles, distanceMilestones),
      current: totalDistanceMiles,
      unit: 'mi',
      icon: '🏃',
      milestones: distanceMilestones
    },
    {
      name: 'Session Streak',
      target: getProgressiveMilestone(totalSessions, sessionMilestones),
      current: totalSessions,
      unit: 'sessions',
      icon: '🎯',
      milestones: sessionMilestones
    },
    {
      name: 'Calorie Crusher',
      target: getProgressiveMilestone(totalCalories, calorieMilestones),
      current: totalCalories,
      unit: 'kcal',
      icon: '🔥',
      milestones: calorieMilestones
    },
    {
      name: 'Endurance Master',
      target: getProgressiveMilestone(longestSession, durationMilestones),
      current: longestSession,
      unit: 'min',
      icon: '⏱️',
      milestones: durationMilestones
    },
  ];

  return (
    <div className="p-4 rounded-xl bg-white/5">
      <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
        <Trophy className="w-4 h-4 text-amber-400" />
        Cardio Achievements
      </h4>
      <div className="space-y-3">
        {achievements.map((ach, idx) => {
          const progress = Math.min((ach.current / ach.target) * 100, 100);
          const isComplete = progress >= 100;
          return (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span>{ach.icon}</span>
                  <span className={isComplete ? 'text-amber-400' : 'text-slate-300'}>{ach.name}</span>
                </span>
                <span className="text-slate-400 text-xs">
                  {ach.current.toFixed(1)}/{ach.target} {ach.unit}
                </span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isComplete ? 'bg-amber-400' : 'bg-blue-500'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CardioPRsCard = ({ conditioning }) => {
  // Calculate PRs from conditioning data
  const prs = {
    longestRun: conditioning?.filter(c => c.category === 'running').sort((a, b) => (b.distance || 0) - (a.distance || 0))[0],
    fastestPace: conditioning?.filter(c => c.pace && c.pace > 0).sort((a, b) => a.pace - b.pace)[0],
    mostCalories: conditioning?.sort((a, b) => (b.activeCalories || b.calories || 0) - (a.activeCalories || a.calories || 0))[0],
    longestSwim: conditioning?.filter(c => c.category === 'swimming').sort((a, b) => (b.distance || 0) - (a.distance || 0))[0],
  };

  const hasPRs = prs.longestRun || prs.fastestPace || prs.mostCalories || prs.longestSwim;

  return (
    <div className="p-4 rounded-xl bg-white/5">
      <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
        <Medal className="w-4 h-4 text-yellow-400" />
        Personal Records
      </h4>
      <div className="space-y-2">
        {hasPRs ? (
          <>
            {prs.longestRun && (
              <div className="flex justify-between text-sm py-1 border-b border-slate-700/50">
                <span className="text-slate-400">🏃 Longest Run</span>
                <span className="font-medium">{formatDistance(prs.longestRun.distance)}</span>
              </div>
            )}
            {prs.fastestPace && prs.fastestPace.pace && (
              <div className="flex justify-between text-sm py-1 border-b border-slate-700/50">
                <span className="text-slate-400">⚡ Fastest Pace</span>
                <span className="font-medium">{formatPace(prs.fastestPace.pace)} /km</span>
              </div>
            )}
            {prs.mostCalories && (
              <div className="flex justify-between text-sm py-1 border-b border-slate-700/50">
                <span className="text-slate-400">🔥 Most Calories</span>
                <span className="font-medium">{prs.mostCalories.activeCalories || prs.mostCalories.calories} kcal</span>
              </div>
            )}
            {prs.longestSwim && (
              <div className="flex justify-between text-sm py-1">
                <span className="text-slate-400">🏊 Longest Swim</span>
                <span className="font-medium">{((prs.longestSwim.distance || 0)).toFixed(0)} m</span>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-4">
            <div className="text-slate-500 text-sm">No PRs recorded yet</div>
            <div className="text-slate-600 text-xs mt-1">Keep pushing to set new records!</div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// STRENGTH ACHIEVEMENTS COMPONENT
// ============================================
const StrengthAchievementsCard = ({ category, workouts, bodyweight = 84 }) => {
  // Progressive milestone helper
  const getProgressiveMilestone = (current, milestones) => {
    for (let i = 0; i < milestones.length; i++) {
      if (current < milestones[i]) return milestones[i];
    }
    return milestones[milestones.length - 1];
  };

  // Progressive milestones for different types
  const workoutMilestones = [10, 25, 50, 100, 250, 500, 1000];
  const setMilestones = [50, 100, 250, 500, 1000, 2500, 5000];
  const repMilestones = [100, 250, 500, 1000, 2500, 5000, 10000];
  const volumeMilestones = [100, 250, 500, 1000, 2500, 5000, 10000]; // kg

  // Define achievements per category with progressive targets
  const achievementsByCategory = {
    push: [
      { name: 'Incline Press Strength', targetMultiplier: 1.0, lift: 'Incline Bench Press', icon: '🏋️', multiplierMilestones: [0.75, 1.0, 1.25, 1.5, 1.75, 2.0] },
      { name: 'OHP Strength', targetMultiplier: 0.75, lift: 'Shoulder Press', icon: '💪', multiplierMilestones: [0.5, 0.75, 1.0, 1.25, 1.5] },
      { name: 'Push Workouts', type: 'workouts', icon: '📈', milestones: workoutMilestones },
      { name: 'Working Sets', type: 'sets', icon: '🎯', milestones: setMilestones },
    ],
    pull: [
      { name: 'Deadlift Strength', targetMultiplier: 1.5, lift: 'Deadlift', icon: '🏋️', multiplierMilestones: [1.0, 1.5, 2.0, 2.5, 3.0] },
      { name: 'Pulldown Strength', targetMultiplier: 1.0, lift: 'Lat Pulldown', icon: '💪', multiplierMilestones: [0.75, 1.0, 1.25, 1.5, 1.75] },
      { name: 'Pull Workouts', type: 'workouts', icon: '📈', milestones: workoutMilestones },
      { name: 'Total Reps', type: 'reps', icon: '🎯', milestones: repMilestones },
    ],
    legs: [
      { name: 'Squat Strength', targetMultiplier: 2.0, lift: 'Squat', icon: '🏋️', multiplierMilestones: [1.0, 1.5, 2.0, 2.5, 3.0] },
      { name: 'Leg Press Volume', targetMultiplier: 2.5, lift: 'Leg Press', icon: '💪', multiplierMilestones: [2.0, 2.5, 3.0, 3.5, 4.0] },
      { name: 'Leg Workouts', type: 'workouts', icon: '📈', milestones: workoutMilestones },
      { name: 'Total Volume', type: 'total', icon: '🎯', milestones: volumeMilestones },
    ],
  };

  const achievements = achievementsByCategory[category] || [];

  // Calculate progress for each achievement
  const calculateProgress = (ach) => {
    if (ach.type === 'workouts') {
      const count = workouts?.filter(w => w.exercises?.some(e => categorizeExercise(e.title).category === category)).length || 0;
      const target = getProgressiveMilestone(count, ach.milestones);
      return { current: count, target };
    }
    if (ach.type === 'sets') {
      let sets = 0;
      workouts?.forEach(w => {
        w.exercises?.forEach(e => {
          if (categorizeExercise(e.title).category === category) {
            sets += e.sets?.filter(s => s.set_type !== 'warmup').length || 0;
          }
        });
      });
      const target = getProgressiveMilestone(sets, ach.milestones);
      return { current: sets, target };
    }
    if (ach.type === 'reps') {
      let reps = 0;
      workouts?.forEach(w => {
        w.exercises?.forEach(e => {
          if (categorizeExercise(e.title).category === category) {
            reps += e.sets?.reduce((sum, s) => sum + (s.set_type !== 'warmup' ? s.reps : 0), 0) || 0;
          }
        });
      });
      const target = getProgressiveMilestone(reps, ach.milestones);
      return { current: reps, target };
    }
    if (ach.type === 'total') {
      let total = 0;
      workouts?.forEach(w => {
        w.exercises?.forEach(e => {
          if (categorizeExercise(e.title).category === category) {
            e.sets?.forEach(s => {
              if (s.set_type !== 'warmup') {
                total += s.weight_kg * s.reps;
              }
            });
          }
        });
      });
      const target = getProgressiveMilestone(total, ach.milestones);
      return { current: total, target };
    }
    if (ach.targetMultiplier && ach.lift && ach.multiplierMilestones) {
      let max1RM = 0;
      workouts?.forEach(w => {
        w.exercises?.forEach(e => {
          if (matchKeyLift(e.title) === ach.lift) {
            e.sets?.forEach(s => {
              if (s.set_type !== 'warmup') {
                const rm = calculate1RM(s.weight_kg, s.reps);
                max1RM = Math.max(max1RM, rm);
              }
            });
          }
        });
      });
      // Find next bodyweight multiplier milestone
      const currentMultiplier = bodyweight > 0 ? max1RM / bodyweight : 0;
      const targetMultiplier = getProgressiveMilestone(currentMultiplier, ach.multiplierMilestones);
      const target1RM = bodyweight * targetMultiplier;
      return { current: max1RM, target: target1RM };
    }
    return { current: 0, target: 100 };
  };

  return (
    <div className="p-4 rounded-xl bg-white/5">
      <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
        <Trophy className="w-4 h-4 text-amber-400" />
        {category.charAt(0).toUpperCase() + category.slice(1)} Achievements
      </h4>
      <div className="space-y-3">
        {achievements.map((ach, idx) => {
          const { current, target } = calculateProgress(ach);
          const progress = Math.min((current / target) * 100, 100);
          const isComplete = progress >= 100;
          return (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span>{ach.icon}</span>
                  <span className={isComplete ? 'text-amber-400' : 'text-slate-300'}>{ach.name}</span>
                  {isComplete && <span className="text-green-400">✓</span>}
                </span>
                <span className="text-slate-400 text-xs">
                  {current.toFixed(0)}/{target.toFixed(0)}
                </span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isComplete ? 'bg-amber-400' : category === 'push' ? 'bg-orange-500' : category === 'pull' ? 'bg-blue-500' : 'bg-purple-500'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================
// STRENGTH PERSONAL RECORDS COMPONENT
// ============================================
const StrengthPRsCard = ({ category, workouts, bodyweight = 84 }) => {
  // Calculate PRs from workout data
  const prs = useMemo(() => {
    if (!workouts || workouts.length === 0) return null;

    const categoryWorkouts = workouts.filter(w =>
      w.exercises?.some(e => categorizeExercise(e.title).category === category)
    );

    // Find max 1RM for each key lift in this category
    const liftPRs = {};
    categoryWorkouts.forEach(w => {
      w.exercises?.forEach(e => {
        const keyLift = matchKeyLift(e.title);
        if (keyLift && categorizeExercise(e.title).category === category) {
          e.sets?.forEach(s => {
            if (s.set_type !== 'warmup') {
              const rm = calculate1RM(s.weight_kg, s.reps);
              if (!liftPRs[keyLift] || rm > liftPRs[keyLift].oneRM) {
                liftPRs[keyLift] = {
                  oneRM: rm,
                  weight: s.weight_kg,
                  reps: s.reps,
                  date: w.start_time
                };
              }
            }
          });
        }
      });
    });

    // Total stats
    const totalWorkouts = categoryWorkouts.length;
    let totalVolume = 0;
    let totalSets = 0;
    let maxSingleWorkout = 0;

    categoryWorkouts.forEach(w => {
      let workoutVolume = 0;
      w.exercises?.forEach(e => {
        if (categorizeExercise(e.title).category === category) {
          e.sets?.forEach(s => {
            if (s.set_type !== 'warmup') {
              const vol = s.weight_kg * s.reps;
              totalVolume += vol;
              workoutVolume += vol;
              totalSets++;
            }
          });
        }
      });
      maxSingleWorkout = Math.max(maxSingleWorkout, workoutVolume);
    });

    return {
      liftPRs,
      totalWorkouts,
      totalVolume,
      totalSets,
      maxSingleWorkout
    };
  }, [workouts, category, bodyweight]);

  if (!prs || Object.keys(prs.liftPRs).length === 0) {
    return (
      <div className="p-4 rounded-xl bg-white/5">
        <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
          <Medal className="w-4 h-4 text-yellow-400" />
          Personal Records
        </h4>
        <div className="text-center py-4">
          <div className="text-slate-500 text-sm">No PRs recorded yet</div>
          <div className="text-slate-600 text-xs mt-1">Keep training to set new records!</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-white/5">
      <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
        <Medal className="w-4 h-4 text-yellow-400" />
        Personal Records
      </h4>
      <div className="space-y-2">
        {/* Lift PRs */}
        {Object.entries(prs.liftPRs).slice(0, 4).map(([lift, data]) => (
          <div key={lift} className="flex justify-between text-sm py-1 border-b border-slate-700/50">
            <span className="text-slate-400">🏋️ {lift}</span>
            <span className="font-medium">{data.oneRM.toFixed(0)}kg (1RM)</span>
          </div>
        ))}

        {/* Additional Stats */}
        <div className="flex justify-between text-sm py-1 border-b border-slate-700/50">
          <span className="text-slate-400">📈 Total Workouts</span>
          <span className="font-medium">{prs.totalWorkouts}</span>
        </div>
        <div className="flex justify-between text-sm py-1 border-b border-slate-700/50">
          <span className="text-slate-400">🎯 Total Sets</span>
          <span className="font-medium">{prs.totalSets}</span>
        </div>
        <div className="flex justify-between text-sm py-1 border-b border-slate-700/50">
          <span className="text-slate-400">💪 Total Volume</span>
          <span className="font-medium">{(prs.totalVolume / 1000).toFixed(1)}t</span>
        </div>
        <div className="flex justify-between text-sm py-1">
          <span className="text-slate-400">🔥 Best Workout</span>
          <span className="font-medium">{(prs.maxSingleWorkout / 1000).toFixed(1)}t</span>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN WORKOUT & ANALYTICS SECTION
// ============================================
const WorkoutAnalyticsSection = ({ workouts, conditioning, dateRange, setDateRange, appleHealth, measurements }) => {
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
      // Filter workouts that have at least one exercise matching the active tab category
      const filter = (l) => l.filter(w => w.exercises.some(e => categorizeExercise(e.title).category === activeTab));
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
        const totalSteps = s.reduce((a, c) => a + estimateSteps(c.distance || 0), 0);
        const avgSteps = s.length > 0 ? Math.round(totalSteps / s.length) : 0;
        const trend = s.slice(0, 12).reverse().map(x => ({ date: formatDateShort(x.date), value: x.avgHeartRate }));
        const byType = {};
        s.forEach(x => { if (!byType[x.category]) byType[x.category] = { count: 0, dur: 0, cal: 0, dist: 0 }; byType[x.category].count++; byType[x.category].dur += x.duration; byType[x.category].cal += x.activeCalories; byType[x.category].dist += x.distance || 0; });
        return { type: 'conditioning', sessions: s.length, totalDuration: Math.round(dur / 60), avgHR: Math.round(avgHR), maxHR, totalCalories: cal, totalDistance: dist.toFixed(1), avgSteps, trendData: trend, byType };
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
                  { l: 'Distance', v: formatDistance(cur.totalDistance) || '0 mi', p: prev.totalDistance ? prev.totalDistance / 1609.34 : 0 },
                  { l: 'Avg Steps', v: formatSteps(cur.avgSteps), p: prev.avgSteps },
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
              <CardioHealthCard appleHealth={appleHealth} conditioning={filteredConditioning} />
            ) : (
              <div className="p-4 rounded-xl bg-white/5">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Strength Forecasts (1RM)</h4>
                <div className="space-y-3">
                  {cur.forecasts?.map(f => (
                    <div key={f.name} className="p-2 rounded-lg bg-black/20">
                      <p className="text-xs text-white font-medium mb-1 truncate">{f.name}</p>
                      <div className="grid grid-cols-4 gap-1 text-center">
                        <div><p className="text-[10px] text-gray-500">Now</p><p className="text-sm font-bold text-white">{f.current}kg</p></div>
                        <div><p className="text-[10px] text-gray-500">4w</p><p className="text-sm font-bold" style={{ color: color.text }}>{f.week4}kg</p></div>
                        <div><p className="text-[10px] text-gray-500">8w</p><p className="text-sm font-bold" style={{ color: color.text }}>{f.week8}kg</p></div>
                        <div><p className="text-[10px] text-gray-500">12w</p><p className="text-sm font-bold" style={{ color: color.text }}>{f.week12}kg</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Achievements & PRs for all tabs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeTab === 'conditioning' ? (
              <>
                <CardioAchievementsCard conditioning={filteredConditioning} />
                <CardioPRsCard conditioning={filteredConditioning} />
              </>
            ) : (
              <>
                <StrengthAchievementsCard
                  category={activeTab}
                  workouts={filteredWorkouts}
                  bodyweight={measurements?.current?.weight || 84}
                />
                <StrengthPRsCard
                  category={activeTab}
                  workouts={filteredWorkouts}
                  bodyweight={measurements?.current?.weight || 84}
                />
              </>
            )}
          </div>

          {/* OLD Exercise Breakdown - REMOVED */}
          {false && activeTab !== 'conditioning' && cur.exercises?.length > 0 && (
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
                      <p className="text-white font-medium">{cleanWorkoutType(s.type)}</p>
                      <p className="text-xs text-gray-400">{formatDate(s.date)} • <span className="text-pink-400">Apple Health</span></p>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-center gap-4 text-center">
                    <div><p className="text-xs text-gray-500">Duration</p><p className="text-sm font-bold text-white">{formatDuration(s.duration)}</p></div>
                    {s.avgHeartRate > 0 && <div><p className="text-xs text-gray-500">Avg HR</p><p className="text-sm font-bold text-white">{s.avgHeartRate}</p></div>}
                    {s.activeCalories > 0 && <div><p className="text-xs text-gray-500">Calories</p><p className="text-sm font-bold text-white">{s.activeCalories}</p></div>}
                    {s.distance > 0 && <div><p className="text-xs text-gray-500">Distance</p><p className="text-sm font-bold text-white">{formatDistance(s.distance)}</p></div>}
                    {(s.category === 'walking' || s.category === 'running') && s.distance > 0 && <div><p className="text-xs text-gray-500">Steps</p><p className="text-sm font-bold text-white">{formatSteps(estimateSteps(s.distance))}</p></div>}
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
          // NORMALIZE the data before using it
          const normalizedData = normalizeApiData(apiData);
          if (normalizedData && (normalizedData.workouts.length > 0 || normalizedData.conditioning.length > 0)) {
            setData(normalizedData);
            console.log('✅ Loaded and normalized API data:', normalizedData);
            setLastUpdated(new Date(normalizedData.lastSync || Date.now()));
            setLoading(false);
            return;
          }
        }
      } catch (error) {
        console.log('API not available, using mock data:', error);
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
        const normalizedData = normalizeApiData(newData);
        if (normalizedData && (normalizedData.workouts.length > 0 || normalizedData.conditioning.length > 0)) {
          setData(normalizedData);
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

  const handleUploadAppleHealthCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE_URL}/apple-health/csv/upload`, { method: 'POST', body: formData });
      if (res.ok) {
        const result = await res.json();
        alert(`Apple Health CSV uploaded! Weight: ${result.current.weight}kg, Body Fat: ${result.current.bodyFat}%`);
        handleRefresh();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to upload Apple Health CSV');
      }
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

  const handleReset = async () => {
    if (!confirm('Are you sure? This will delete ALL workout and measurement data!')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/reset`, { method: 'POST' });
      if (res.ok) {
        alert('All data cleared! Refresh the page.');
        window.location.reload();
      } else {
        alert('Failed to reset data');
      }
    } catch (error) {
      console.error('Reset error:', error);
      alert('Failed to reset data');
    }
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
                <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Fahim's Tracker Pro</h1>
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
              <MoreMenu onUploadHevy={handleUploadHevy} onUploadHevyMeasurements={handleUploadHevyMeasurements} onUploadAppleHealth={handleUploadAppleHealth} onUploadAppleHealthCSV={handleUploadAppleHealthCSV} onExportJson={handleExportJson} onExportCsv={handleExportCsv} onReset={handleReset} />
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
          <WeeklyInsightsCard workouts={data.workouts} conditioning={data.conditioning} appleHealth={data.appleHealth} nutrition={data.nutrition} dateRange={dateRange} />
        </section>

        {/* Analytics + Logs */}
        <section>
          <WorkoutAnalyticsSection workouts={data.workouts} conditioning={data.conditioning} dateRange={dateRange} setDateRange={setDateRange} appleHealth={data.appleHealth} measurements={data.measurements} />
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
