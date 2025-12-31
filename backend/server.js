const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const crypto = require('crypto');
const { parseAppleHealthExport } = require('./apple-health-parser');

const app = express();
const PORT = process.env.PORT || 3001;

// Your Hevy API Key
const HEVY_API_KEY = process.env.HEVY_API_KEY || '63d8a8e8-e4b5-408b-bf03-aa06ea80a5f1';
const HEVY_API_BASE = 'https://api.hevyapp.com/v1';

// Webhook secret for verification (you'll set this in Hevy)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'hit-tracker-webhook-secret-2024';

// Middleware
app.use(cors());
app.use(express.json({ limit: '250mb' }));
app.use(express.urlencoded({ extended: true, limit: '250mb' }));

// File upload config
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 250 * 1024 * 1024 } // 250MB limit for large Apple Health exports
});

// Data storage (in production, use a database)
const DATA_FILE = path.join(__dirname, 'data', 'fitness-data.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// Initialize data file if not exists
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({
    workouts: [],
    conditioning: [],
    measurements: {
      current: { weight: null, bodyFat: null, chest: null, waist: null, biceps: null, thighs: null },
      starting: { weight: null, bodyFat: null, chest: null, waist: null, biceps: null, thighs: null },
      height: null // Height in cm for BMI calculation
    },
    appleHealth: {
      restingHeartRate: null,
      avgSteps: null,
      avgActiveCalories: null,
      sleepAvg: null
    },
    lastSync: null,
    lastWebhook: null
  }, null, 2));
}

// Helper: Read data
const readData = () => {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.error('Error reading data:', e);
    return null;
  }
};

// Helper: Write data
const writeData = (data) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error('Error writing data:', e);
    return false;
  }
};

// Helper: Fetch from Hevy API
const fetchHevy = async (endpoint, options = {}) => {
  const url = `${HEVY_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'api-key': HEVY_API_KEY,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  
  if (!response.ok) {
    throw new Error(`Hevy API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
};

// Helper: Transform Hevy workout to our format
const transformWorkout = (workout) => {
  // Use Hevy's title if provided, otherwise use a generic "Workout" title
  // Let frontend handle categorization based on individual exercises
  const title = workout.title || 'Workout';

  return {
    id: workout.id,
    title: title,
    category: 'strength', // Generic category - frontend will filter by exercise categories
    start_time: workout.start_time,
    end_time: workout.end_time,
    appleHealth: null,
    exercises: (workout.exercises || []).map(exercise => ({
      title: exercise.title,
      muscle_group: exercise.muscle_group || 'other',
      sets: (exercise.sets || []).map(set => {
        // Map Hevy's 'type' field to our 'set_type'
        // Hevy uses: "warmup", "normal", "failure"
        let setType = 'working'; // default
        if (set.type === 'warmup') {
          setType = 'warmup';
        } else if (set.type === 'failure' || set.rpe >= 10) {
          setType = 'failure';
        } else if (set.type === 'normal') {
          setType = 'working';
        }

        return {
          set_type: setType,
          weight_kg: set.weight_kg,
          reps: set.reps,
          rpe: set.rpe,
          distance_meters: set.distance_meters,
          duration_seconds: set.duration_seconds
        };
      })
    }))
  };
};

// ============================================
// API ROUTES
// ============================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get all data
app.get('/api/data', (req, res) => {
  const data = readData();
  if (!data) {
    return res.status(500).json({ error: 'Failed to read data' });
  }
  res.json(data);
});

// Update measurements
app.post('/api/measurements', (req, res) => {
  const data = readData();
  if (!data) {
    return res.status(500).json({ error: 'Failed to read data' });
  }
  
  data.measurements = { ...data.measurements, ...req.body };
  
  if (writeData(data)) {
    res.json({ success: true, measurements: data.measurements });
  } else {
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// ============================================
// HEVY WEBHOOK - INSTANT NOTIFICATIONS! 🚀
// ============================================

// Hevy will POST to this endpoint when you complete a workout
app.post('/api/hevy/webhook', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] 🔔 Webhook received from Hevy!`);
    
    // Verify the webhook (optional but recommended)
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
      console.log('⚠️ Webhook auth mismatch, but processing anyway');
    }
    
    const { id, payload } = req.body;
    const workoutId = payload?.workoutId;
    
    if (!workoutId) {
      console.log('❌ No workoutId in webhook payload');
      return res.status(400).json({ error: 'Missing workoutId' });
    }
    
    console.log(`📥 Fetching workout ${workoutId} from Hevy...`);
    
    // Fetch the full workout details from Hevy
    const workout = await fetchHevy(`/workouts/${workoutId}`);
    
    if (!workout) {
      return res.status(404).json({ error: 'Workout not found' });
    }
    
    // Transform to our format
    const transformedWorkout = transformWorkout(workout);
    
    // Update our data
    const data = readData();
    
    // Check if workout already exists (update) or is new (add)
    const existingIndex = data.workouts.findIndex(w => w.id === workoutId);
    if (existingIndex >= 0) {
      data.workouts[existingIndex] = transformedWorkout;
      console.log(`🔄 Updated existing workout: ${transformedWorkout.title}`);
    } else {
      data.workouts.unshift(transformedWorkout); // Add to beginning (newest first)
      console.log(`✅ Added new workout: ${transformedWorkout.title}`);
    }
    
    data.lastWebhook = new Date().toISOString();
    data.lastSync = new Date().toISOString();
    
    writeData(data);
    
    // Respond to Hevy (must be 200 within 5 seconds)
    res.status(200).json({ success: true, workoutId });
    
    console.log(`🎉 Workout "${transformedWorkout.title}" synced instantly!`);
    
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook status/test endpoint
app.get('/api/hevy/webhook/status', (req, res) => {
  const data = readData();
  res.json({
    webhookEnabled: true,
    webhookUrl: '/api/hevy/webhook',
    lastWebhook: data?.lastWebhook || null,
    instructions: 'Set your webhook URL in Hevy to: https://[YOUR-TAILSCALE-IP]:8080/api/hevy/webhook'
  });
});

// ============================================
// HEVY API ROUTES
// ============================================

// Sync workouts from Hevy (manual/scheduled)
app.get('/api/hevy/sync', async (req, res) => {
  try {
    console.log('Starting Hevy sync...');
    
    let allWorkouts = [];
    let page = 1;
    let hasMore = true;

    // Fetch all workouts (no page limit)
    while (hasMore && page <= 100) { // Safety limit of 100 pages (1000 workouts)
      const response = await fetchHevy(`/workouts?page=${page}&pageSize=10`);

      if (response.workouts && response.workouts.length > 0) {
        allWorkouts = [...allWorkouts, ...response.workouts];
        page++;
        hasMore = response.workouts.length === 10;
      } else {
        hasMore = false;
      }
    }
    
    console.log(`Fetched ${allWorkouts.length} workouts from Hevy`);
    
    const transformedWorkouts = allWorkouts.map(transformWorkout);
    
    const data = readData();
    data.workouts = transformedWorkouts;
    data.lastSync = new Date().toISOString();
    
    if (writeData(data)) {
      res.json({ 
        success: true, 
        workoutsCount: transformedWorkouts.length,
        lastSync: data.lastSync
      });
    } else {
      res.status(500).json({ error: 'Failed to save synced data' });
    }
    
  } catch (error) {
    console.error('Hevy sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Hevy workout by ID
app.get('/api/hevy/workouts/:id', async (req, res) => {
  try {
    const workout = await fetchHevy(`/workouts/${req.params.id}`);
    res.json(workout);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to parse CSV line with quoted fields
// ============================================
// APPLE HEALTH DATA PROCESSOR
// ============================================
function processAppleHealthData(parsedData) {
  const strengthWorkoutData = {};
  const conditioningSessions = [];
  
  // Process workouts
  parsedData.workouts.forEach(workout => {
    const dateKey = workout.startDate.split('T')[0]; // YYYY-MM-DD
    
    if (workout.category === 'strength') {
      // Group strength workouts by date
      if (!strengthWorkoutData[dateKey]) {
        strengthWorkoutData[dateKey] = {
          sessions: [],
          totalCalories: 0,
          totalDuration: 0
        };
      }
      
      strengthWorkoutData[dateKey].sessions.push({
        type: workout.type,
        duration: workout.duration,
        calories: workout.calories
      });
      strengthWorkoutData[dateKey].totalCalories += workout.calories || 0;
      strengthWorkoutData[dateKey].totalDuration += workout.duration || 0;
    } else {
      // Add to conditioning sessions
      conditioningSessions.push({
        date: workout.startDate,
        type: workout.type,
        category: workout.category,
        duration: workout.duration,
        calories: workout.calories,
        distance: workout.distance
      });
    }
  });
  
  // Sort conditioning sessions by date (newest first)
  conditioningSessions.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // Calculate average resting heart rate
  let avgRestingHR = null;
  if (parsedData.restingHRRecords && parsedData.restingHRRecords.length > 0) {
    const sum = parsedData.restingHRRecords.reduce((acc, record) => acc + record.value, 0);
    avgRestingHR = Math.round(sum / parsedData.restingHRRecords.length);
  }
  
  return {
    strengthWorkoutData,
    conditioningSessions,
    avgRestingHR
  };
}


function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// Upload Hevy export (JSON or CSV)
app.post('/api/hevy/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    const fileName = req.file.originalname || '';
    const isCSV = fileName.toLowerCase().endsWith('.csv') || fileContent.trim().startsWith('title,') || fileContent.includes(',start_time,');

    let workouts = [];

    if (isCSV) {
      console.log('Parsing Hevy workout CSV...');
      const lines = fileContent.trim().split('\n');
      if (lines.length < 2) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'CSV file is empty' });
      }

      const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
      console.log('CSV headers:', headers);

      // Group by workout (title + start_time)
      const workoutMap = new Map();

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row = {};
        headers.forEach((h, idx) => row[h] = values[idx]?.trim());

        const workoutKey = `${row.title || 'Workout'}-${row.start_time}`;

        if (!workoutMap.has(workoutKey)) {
          workoutMap.set(workoutKey, {
            id: `hevy-csv-${Date.now()}-${i}`,
            title: row.title || 'Workout',
            start_time: row.start_time,
            end_time: row.end_time || row.start_time,
            exercises: new Map()
          });
        }

        const workout = workoutMap.get(workoutKey);
        const exerciseTitle = row.exercise_title || row.exercise || 'Unknown Exercise';

        if (!workout.exercises.has(exerciseTitle)) {
          workout.exercises.set(exerciseTitle, {
            title: exerciseTitle,
            sets: []
          });
        }

        // Map Hevy CSV set types to our format
        let setType = 'working';
        if (row.set_type) {
          const typeNorm = row.set_type.toLowerCase();
          if (typeNorm === 'warmup' || typeNorm === 'w') {
            setType = 'warmup';
          } else if (typeNorm === 'failure' || typeNorm === 'f') {
            setType = 'failure';
          } else if (typeNorm === 'normal' || typeNorm === 'working') {
            setType = 'working';
          }
        }

        workout.exercises.get(exerciseTitle).sets.push({
          type: setType,
          weight_kg: parseFloat(row.weight_kg) || 0,
          reps: parseInt(row.reps) || 0,
          rpe: parseFloat(row.rpe) || null,
          distance_meters: (parseFloat(row.distance_km) || 0) * 1000,
          duration_seconds: parseInt(row.duration_seconds) || 0
        });
      }

      // Convert to array format
      workouts = Array.from(workoutMap.values()).map(w => ({
        ...w,
        exercises: Array.from(w.exercises.values())
      }));

      console.log(`Parsed ${workouts.length} workouts from CSV`);

    } else {
      // Parse JSON format
      console.log('Parsing Hevy workout JSON...');
      const hevyData = JSON.parse(fileContent);
      workouts = hevyData.workouts || [];
    }

    // Transform workouts using existing transformWorkout function
    const transformedWorkouts = workouts.map(transformWorkout);

    const data = readData();
    data.workouts = transformedWorkouts;
    data.lastSync = new Date().toISOString();

    fs.unlinkSync(req.file.path);

    if (writeData(data)) {
      res.json({ success: true, workoutsCount: transformedWorkouts.length });
    } else {
      res.status(500).json({ error: 'Failed to save data' });
    }

  } catch (error) {
    console.error('Hevy upload error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

// Upload Hevy measurements CSV
app.post('/api/hevy/measurements/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    const lines = fileContent.trim().split('\n');

    if (lines.length < 2) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'CSV file is empty or invalid' });
    }

    console.log('Processing Hevy measurements CSV...');

    // Detect delimiter (comma or semicolon)
    const delimiter = lines[0].includes(';') ? ';' : ',';

    // Parse header row - normalize column names
    const headers = lines[0].split(delimiter).map(h =>
      h.trim().replace(/^"|"$/g, '').toLowerCase()
        .replace(/[()]/g, '')           // Remove parentheses
        .replace(/\s+/g, '_')           // Replace spaces with underscore
        .replace(/%/g, 'pct')           // Replace % with pct
    );

    console.log('CSV headers:', headers);

    // Column mapping for Hevy export format
    // IMPORTANT: Hevy uses INCHES (_in) not centimeters (_cm)
    const columnMap = {
      // Date variations
      'date': 'date',
      'recorded': 'date',
      'recorded_at': 'date',

      // Weight variations
      'weight_kg': 'weight',
      'weight': 'weight',
      'body_weight': 'weight',
      'bodyweight': 'weight',

      // Body fat variations - Hevy uses "fat_percent"!
      'fat_percent': 'bodyFat',
      'body_fat_pct': 'bodyFat',
      'body_fat': 'bodyFat',
      'bodyfat': 'bodyFat',
      'fat_pct': 'bodyFat',

      // Measurements in CENTIMETERS
      'neck_cm': 'neck',
      'shoulders_cm': 'shoulders',
      'shoulder_cm': 'shoulders',
      'chest_cm': 'chest',
      'left_bicep_cm': 'leftBicep',
      'right_bicep_cm': 'rightBicep',
      'bicep_cm': 'biceps',
      'left_forearm_cm': 'leftForearm',
      'right_forearm_cm': 'rightForearm',
      'abdomen_cm': 'abdomen',
      'waist_cm': 'waist',
      'hips_cm': 'hips',
      'left_thigh_cm': 'leftThigh',
      'right_thigh_cm': 'rightThigh',
      'thigh_cm': 'thighs',
      'left_calf_cm': 'leftCalf',
      'right_calf_cm': 'rightCalf',

      // Measurements in INCHES (Hevy's actual format)
      'neck_in': 'neck_in',
      'shoulder_in': 'shoulders_in',
      'chest_in': 'chest_in',
      'left_bicep_in': 'leftBicep_in',
      'right_bicep_in': 'rightBicep_in',
      'bicep_in': 'biceps_in',
      'left_forearm_in': 'leftForearm_in',
      'right_forearm_in': 'rightForearm_in',
      'abdomen_in': 'abdomen_in',
      'waist_in': 'waist_in',
      'hips_in': 'hips_in',
      'left_thigh_in': 'leftThigh_in',
      'right_thigh_in': 'rightThigh_in',
      'thigh_in': 'thighs_in',
      'left_calf_in': 'leftCalf_in',
      'right_calf_in': 'rightCalf_in',
    };

    const measurements = [];

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map(v => v.trim().replace(/^"|"$/g, '')); // Remove quotes
      if (values.length < 2) continue;

      const row = {};
      headers.forEach((header, idx) => {
        const mappedKey = columnMap[header];
        if (mappedKey && values[idx] && values[idx] !== '') {
          if (mappedKey === 'date') {
            row[mappedKey] = values[idx];
          } else {
            const val = parseFloat(values[idx]);
            if (!isNaN(val)) {
              // Convert inches to centimeters (1 inch = 2.54 cm)
              if (mappedKey.endsWith('_in')) {
                const baseKey = mappedKey.replace('_in', '');
                row[baseKey] = val * 2.54;
              } else {
                row[mappedKey] = val;
              }
            }
          }
        }
      });

      if (Object.keys(row).length > 1) {
        measurements.push(row);
      }
    }

    if (measurements.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: 'No valid measurement data found in CSV',
        suggestion: 'Make sure the CSV has headers: Date, Weight (kg), Body Fat (%), etc.'
      });
    }

    // Sort by date (newest first)
    measurements.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    const data = readData();
    const latest = measurements[0];
    const oldest = measurements[measurements.length - 1];

    // Helper to get average of left/right measurements
    const avg = (left, right) => {
      if (left && right) return (left + right) / 2;
      return left || right || null;
    };

    // Update current measurements (preserve existing data if not in CSV)
    data.measurements.current = {
      ...data.measurements.current,
      weight: latest.weight || data.measurements.current?.weight || null,
      bodyFat: latest.bodyFat || data.measurements.current?.bodyFat || null,
      neck: latest.neck || data.measurements.current?.neck || null,
      shoulders: latest.shoulders || data.measurements.current?.shoulders || null,
      chest: latest.chest || data.measurements.current?.chest || null,
      biceps: avg(latest.leftBicep, latest.rightBicep) || data.measurements.current?.biceps || null,
      abdomen: latest.abdomen || data.measurements.current?.abdomen || null,
      waist: latest.waist || data.measurements.current?.waist || null,
      hips: latest.hips || data.measurements.current?.hips || null,
      thighs: avg(latest.leftThigh, latest.rightThigh) || data.measurements.current?.thighs || null,
      calves: avg(latest.leftCalf, latest.rightCalf) || data.measurements.current?.calves || null,
    };

    // Update starting measurements
    data.measurements.starting = {
      ...data.measurements.starting,
      weight: oldest.weight || data.measurements.starting?.weight || null,
      bodyFat: oldest.bodyFat || data.measurements.starting?.bodyFat || null,
      neck: oldest.neck || data.measurements.starting?.neck || null,
      shoulders: oldest.shoulders || data.measurements.starting?.shoulders || null,
      chest: oldest.chest || data.measurements.starting?.chest || null,
      biceps: avg(oldest.leftBicep, oldest.rightBicep) || data.measurements.starting?.biceps || null,
      abdomen: oldest.abdomen || data.measurements.starting?.abdomen || null,
      waist: oldest.waist || data.measurements.starting?.waist || null,
      hips: oldest.hips || data.measurements.starting?.hips || null,
      thighs: avg(oldest.leftThigh, oldest.rightThigh) || data.measurements.starting?.thighs || null,
      calves: avg(oldest.leftCalf, oldest.rightCalf) || data.measurements.starting?.calves || null,
    };

    data.lastSync = new Date().toISOString();

    fs.unlinkSync(req.file.path);

    if (writeData(data)) {
      res.json({
        success: true,
        measurementsCount: measurements.length,
        latest: data.measurements.current
      });
    } else {
      res.status(500).json({ error: 'Failed to save measurements' });
    }

  } catch (error) {
    console.error('Hevy measurements upload error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// APPLE HEALTH ROUTES
// ============================================

// Upload Apple Health export
// ============================================
// APPLE HEALTH UPLOAD - STREAMING PARSER
// Uses line-by-line parsing for 150MB+ files
// ============================================
app.post('/api/apple-health/upload', upload.single('file'), async (req, res) => {
  const startTime = Date.now();

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileSizeMB = (req.file.size / 1024 / 1024).toFixed(2);
    console.log(`Processing Apple Health export using streaming parser... (${fileSizeMB}MB)`);

    // Use streaming parser - handles 150MB+ files without memory issues
    const parsedData = await parseAppleHealthExport(req.file.path, (linesProcessed) => {
      if (linesProcessed % 50000 === 0) {
        console.log(`Processed ${linesProcessed.toLocaleString()} lines...`);
      }
    });

    console.log(`Parsing complete. Stats:`, parsedData.stats);

    // Process parsed data into dashboard format
    const processed = processAppleHealthData(parsedData);

    // Read existing data
    const data = readData();

    // Merge strength workout data with existing Hevy workouts
    data.workouts = data.workouts.map(workout => {
      const dateKey = workout.start_time.split('T')[0];
      if (processed.strengthWorkoutData[dateKey]) {
        return { ...workout, appleHealth: processed.strengthWorkoutData[dateKey] };
      }
      return workout;
    });

    // Set conditioning sessions (sorted newest first)
    data.conditioning = processed.conditioningSessions;

    // Update resting heart rate if available
    if (processed.avgRestingHR) {
      data.appleHealth.restingHeartRate = processed.avgRestingHR;
    }

    // IMPORTANT: PRESERVE existing measurements, only update what Apple Health provides
    // Update weight - get oldest and newest from parsed data
    if (parsedData.weightRecords.length > 0) {
      const sorted = parsedData.weightRecords.sort((a, b) => new Date(a.date) - new Date(b.date));
      const startingWeight = sorted[0].value;
      const currentWeight = sorted[sorted.length - 1].value;

      // Preserve all existing body measurements (chest, waist, biceps, thighs, etc.)
      if (startingWeight) {
        data.measurements.starting = {
          ...data.measurements.starting,
          weight: Math.round(startingWeight * 10) / 10
        };
      }
      if (currentWeight) {
        data.measurements.current = {
          ...data.measurements.current,
          weight: Math.round(currentWeight * 10) / 10
        };
      }
    }

    // Update body fat - get oldest and newest from parsed data
    if (parsedData.bodyFatRecords.length > 0) {
      const sorted = parsedData.bodyFatRecords.sort((a, b) => new Date(a.date) - new Date(b.date));
      const startingBodyFat = sorted[0].value;
      const currentBodyFat = sorted[sorted.length - 1].value;

      // Preserve all existing measurements
      if (startingBodyFat) {
        data.measurements.starting = {
          ...data.measurements.starting,
          bodyFat: Math.round(startingBodyFat * 10) / 10
        };
      }
      if (currentBodyFat) {
        data.measurements.current = {
          ...data.measurements.current,
          bodyFat: Math.round(currentBodyFat * 10) / 10
        };
      }
    }

    data.lastSync = new Date().toISOString();

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    // Save data
    if (writeData(data)) {
      const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`Apple Health import complete in ${processingTime}s`);

      res.json({
        success: true,
        stats: {
          processingTimeSeconds: parseFloat(processingTime),
          fileSizeMB: parseFloat(fileSizeMB),
          linesProcessed: parsedData.stats.linesProcessed,
          workoutsFound: parsedData.stats.workoutsFound,
          conditioningSessions: processed.conditioningSessions.length,
          strengthWorkoutsEnriched: Object.keys(processed.strengthWorkoutData).length,
          weightRecords: parsedData.stats.weightRecordsFound,
          bodyFatRecords: parsedData.stats.bodyFatRecordsFound,
          restingHRRecords: parsedData.stats.restingHRRecordsFound
        }
      });
    } else {
      res.status(500).json({ error: 'Failed to save data' });
    }

  } catch (error) {
    console.error('Apple Health upload error:', error);

    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: 'Failed to process Apple Health export',
      details: error.message
    });
  }
});

// ============================================
// AUTOMATIC HEVY SYNC (Backup - Every 15 minutes)
// ============================================
const SYNC_INTERVAL = 15 * 60 * 1000;

const autoSyncHevy = async () => {
  try {
    console.log(`[${new Date().toISOString()}] 🔄 Auto-syncing with Hevy...`);
    
    let allWorkouts = [];
    let page = 1;
    let hasMore = true;
    
    // Fetch all workouts (no page limit)
    while (hasMore && page <= 100) { // Safety limit of 100 pages (1000 workouts)
      const response = await fetchHevy(`/workouts?page=${page}&pageSize=10`);
      if (response.workouts && response.workouts.length > 0) {
        allWorkouts = [...allWorkouts, ...response.workouts];
        page++;
        hasMore = response.workouts.length === 10;
      } else {
        hasMore = false;
      }
    }
    
    const transformedWorkouts = allWorkouts.map(transformWorkout);
    
    const data = readData();
    if (data) {
      const existingAppleHealth = {};
      data.workouts.forEach(w => {
        if (w.appleHealth) {
          const dateKey = w.start_time.split('T')[0];
          existingAppleHealth[dateKey] = w.appleHealth;
        }
      });
      
      data.workouts = transformedWorkouts.map(w => {
        const dateKey = w.start_time.split('T')[0];
        return existingAppleHealth[dateKey] ? { ...w, appleHealth: existingAppleHealth[dateKey] } : w;
      });
      
      data.lastSync = new Date().toISOString();
      writeData(data);
      
      console.log(`[${new Date().toISOString()}] ✅ Synced ${transformedWorkouts.length} workouts from Hevy`);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Auto-sync failed:`, error.message);
  }
};

// Get sync status
app.get('/api/sync/status', (req, res) => {
  const data = readData();
  res.json({
    lastSync: data?.lastSync || null,
    lastWebhook: data?.lastWebhook || null,
    nextSync: new Date(Date.now() + SYNC_INTERVAL).toISOString(),
    syncInterval: '15 minutes',
    webhookEnabled: true,
    autoSyncEnabled: true
  });
});

// Manual sync trigger
app.post('/api/sync/now', async (req, res) => {
  try {
    await autoSyncHevy();
    const data = readData();
    res.json({ success: true, lastSync: data?.lastSync, workoutsCount: data?.workouts?.length || 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║         HIT Tracker Pro Backend - Running! 💪              ║
╠═══════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                               ║
║  Hevy API: Connected                                       ║
║  Hevy Webhook: /api/hevy/webhook (INSTANT SYNC!)          ║
║  Apple Health: Ready for uploads                           ║
║  Auto-Sync: Every 15 minutes (backup)                      ║
╚═══════════════════════════════════════════════════════════╝
  `);
  
  // Initial sync on startup
  console.log('🚀 Running initial Hevy sync...');
  autoSyncHevy();
  
  // Schedule automatic syncs (backup for webhook)
  setInterval(autoSyncHevy, SYNC_INTERVAL);
  console.log(`⏰ Auto-sync scheduled every ${SYNC_INTERVAL / 60000} minutes`);
});
