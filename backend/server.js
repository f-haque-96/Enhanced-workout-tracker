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

// Reset all data
app.post('/api/reset', (req, res) => {
  const freshData = {
    workouts: [],
    conditioning: [],
    measurements: { current: {}, starting: {}, history: [] },
    appleHealth: {},
    lastSync: null,
    lastWebhook: null
  };

  if (writeData(freshData)) {
    console.log('✨ All data reset!');
    res.json({ success: true, message: 'All data cleared' });
  } else {
    res.status(500).json({ error: 'Failed to reset data' });
  }
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
      // Store strength workout data for merging with Hevy workouts by date
      // If multiple strength workouts on same day, aggregate them
      if (!strengthWorkoutData[dateKey]) {
        strengthWorkoutData[dateKey] = {
          duration: workout.duration || 0,
          activeCalories: Math.round(workout.calories || 0),
          avgHeartRate: workout.avgHeartRate || null,
          maxHeartRate: workout.maxHeartRate || null,
          source: 'Apple Health',
          sessionCount: 1
        };
      } else {
        // Aggregate multiple sessions on same day
        strengthWorkoutData[dateKey].duration += workout.duration || 0;
        strengthWorkoutData[dateKey].activeCalories += Math.round(workout.calories || 0);
        // Average the heart rates
        if (workout.avgHeartRate) {
          const prevAvg = strengthWorkoutData[dateKey].avgHeartRate || 0;
          const count = strengthWorkoutData[dateKey].sessionCount;
          strengthWorkoutData[dateKey].avgHeartRate = Math.round((prevAvg * count + workout.avgHeartRate) / (count + 1));
        }
        if (workout.maxHeartRate) {
          strengthWorkoutData[dateKey].maxHeartRate = Math.max(
            strengthWorkoutData[dateKey].maxHeartRate || 0,
            workout.maxHeartRate
          );
        }
        strengthWorkoutData[dateKey].sessionCount += 1;
      }
    } else {
      // Add to conditioning sessions
      const session = {
        id: `apple-conditioning-${workout.startDate}`,
        date: workout.startDate,
        type: workout.type,
        category: workout.category,
        source: 'Apple Health',
        duration: workout.duration,
        activeCalories: Math.round(workout.calories || 0),
        avgHeartRate: workout.avgHeartRate || 0,
        maxHeartRate: workout.maxHeartRate || 0,
        distance: workout.distance || 0,
        pace: null,
        hrZones: { zone1: 20, zone2: 30, zone3: 30, zone4: 15, zone5: 5 }
      };

      conditioningSessions.push(session);
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

  // Process dietary calorie intake (aggregate by day)
  const dailyCalorieIntake = {};
  if (parsedData.dietaryCalorieRecords && parsedData.dietaryCalorieRecords.length > 0) {
    parsedData.dietaryCalorieRecords.forEach(record => {
      const dateKey = record.date.split('T')[0].split(' ')[0];
      if (!dailyCalorieIntake[dateKey]) {
        dailyCalorieIntake[dateKey] = 0;
      }
      dailyCalorieIntake[dateKey] += record.value;
    });
  }

  // Process weight history (last 90 days for trend graph)
  const weightHistory = [];
  if (parsedData.weightRecords && parsedData.weightRecords.length > 0) {
    const last90Days = parsedData.weightRecords.slice(0, 90);
    weightHistory.push(...last90Days.map(record => ({
      date: record.date.split('T')[0].split(' ')[0],
      weight: record.value,
      bodyFat: null // Will be filled if bodyFat exists for same date
    })));
  }

  // Add body fat to weight history where available
  if (parsedData.bodyFatRecords && parsedData.bodyFatRecords.length > 0) {
    parsedData.bodyFatRecords.forEach(bfRecord => {
      const dateKey = bfRecord.date.split('T')[0].split(' ')[0];
      const weightEntry = weightHistory.find(w => w.date === dateKey);
      if (weightEntry) {
        weightEntry.bodyFat = bfRecord.value;
      }
    });
  }

  return {
    strengthWorkoutData,
    conditioningSessions,
    avgRestingHR,
    dailyCalorieIntake,
    weightHistory
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
// Parse Hevy date format: "14 Jan 2025, 00:00"
function parseHevyDate(dateStr) {
  if (!dateStr) return null;
  const clean = dateStr.replace(/"/g, '').trim();
  
  // Try parsing directly first
  const date = new Date(clean);
  if (!isNaN(date.getTime())) return date.toISOString();
  
  // Manual parsing for "14 Jan 2025, 00:00" format
  const match = clean.match(/(d{1,2})s+(w+)s+(d{4})/);
  if (match) {
    const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    const parsed = new Date(parseInt(match[3]), months[match[2]], parseInt(match[1]));
    return parsed.toISOString();
  }
  
  return null;
}


app.post('/api/hevy/measurements/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('Processing Hevy measurements CSV...');
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    const lines = fileContent.trim().split('\n');

    if (lines.length < 2) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'CSV file is empty' });
    }

    // Parse headers - remove quotes and normalize
    const rawHeaders = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
    console.log('CSV Headers:', rawHeaders);

    // Find column indices
    const colIdx = {
      date: rawHeaders.findIndex(h => h === 'date'),
      weight: rawHeaders.findIndex(h => h.includes('weight')),
      bodyFat: rawHeaders.findIndex(h => h.includes('fat')),
      neck: rawHeaders.findIndex(h => h.includes('neck')),
      shoulders: rawHeaders.findIndex(h => h.includes('shoulder')),
      chest: rawHeaders.findIndex(h => h.includes('chest')),
      leftBicep: rawHeaders.findIndex(h => h.includes('left') && h.includes('bicep')),
      rightBicep: rawHeaders.findIndex(h => h.includes('right') && h.includes('bicep')),
      leftForearm: rawHeaders.findIndex(h => h.includes('left') && h.includes('forearm')),
      rightForearm: rawHeaders.findIndex(h => h.includes('right') && h.includes('forearm')),
      abdomen: rawHeaders.findIndex(h => h.includes('abdomen')),
      waist: rawHeaders.findIndex(h => h.includes('waist')),
      hips: rawHeaders.findIndex(h => h.includes('hips')),
      leftThigh: rawHeaders.findIndex(h => h.includes('left') && h.includes('thigh')),
      rightThigh: rawHeaders.findIndex(h => h.includes('right') && h.includes('thigh')),
      leftCalf: rawHeaders.findIndex(h => h.includes('left') && h.includes('calf')),
      rightCalf: rawHeaders.findIndex(h => h.includes('right') && h.includes('calf')),
    };

    console.log('Column indices:', colIdx);

    // Parse all rows
    const measurements = [];

    for (let i = 1; i < lines.length; i++) {
      // Handle CSV with quoted values
      const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());

      // DEBUG: Log first data row to check parsing
      if (i === 1) {
        console.log('First data row split into', values.length, 'values');
        console.log('Sample values:', {
          0: values[0],
          1: values[1],
          2: values[2],
          3: values[3],
          4: values[4],
          5: values[5],
          6: values[6],
          7: values[7]
        });
      }

      const row = { date: null };

      // Parse date
      if (colIdx.date >= 0 && values[colIdx.date]) {
        const dateStr = values[colIdx.date];
        // Handle "14 Jan 2025, 00:00" format
        const match = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
        if (match) {
          const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
          row.date = new Date(parseInt(match[3]), months[match[2]], parseInt(match[1])).toISOString();
        } else {
          row.date = new Date(dateStr).toISOString();
        }
      }

      // Parse numeric values - NO unit conversion, store as-is
      const parseNum = (idx) => {
        if (idx < 0 || !values[idx] || values[idx] === '') return null;
        const num = parseFloat(values[idx]);
        return isNaN(num) ? null : num;
      };

      row.weight = parseNum(colIdx.weight);
      row.bodyFat = parseNum(colIdx.bodyFat);
      row.neck = parseNum(colIdx.neck);
      row.shoulders = parseNum(colIdx.shoulders);
      row.chest = parseNum(colIdx.chest);
      row.leftBicep = parseNum(colIdx.leftBicep);
      row.rightBicep = parseNum(colIdx.rightBicep);
      row.leftForearm = parseNum(colIdx.leftForearm);
      row.rightForearm = parseNum(colIdx.rightForearm);

      // DEBUG: Log first row parsing to check column mapping
      if (i === 1) {
        console.log('Parsed first row:', {
          [`shoulders (idx ${colIdx.shoulders})`]: row.shoulders,
          [`chest (idx ${colIdx.chest})`]: row.chest,
          [`leftBicep (idx ${colIdx.leftBicep})`]: row.leftBicep,
          [`rightBicep (idx ${colIdx.rightBicep})`]: row.rightBicep
        });
      }
      row.abdomen = parseNum(colIdx.abdomen);
      row.waist = parseNum(colIdx.waist);
      row.hips = parseNum(colIdx.hips);
      row.leftThigh = parseNum(colIdx.leftThigh);
      row.rightThigh = parseNum(colIdx.rightThigh);
      row.leftCalf = parseNum(colIdx.leftCalf);
      row.rightCalf = parseNum(colIdx.rightCalf);

      // Combined fields for convenience
      row.biceps = row.leftBicep ?? row.rightBicep;
      row.thighs = row.leftThigh ?? row.rightThigh;
      row.calves = row.leftCalf ?? row.rightCalf;

      // Only include if has at least one value besides date
      const hasData = Object.entries(row).some(([k, v]) => k !== 'date' && v !== null);
      if (row.date && hasData) {
        measurements.push(row);
      }
    }

    console.log(`Parsed ${measurements.length} measurement records`);

    if (measurements.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'No valid measurement data found' });
    }

    // Sort by date (newest first)
    measurements.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Find the row with the most body measurements (not just weight)
    // EXCLUDE rows with weight: 0 (invalid placeholder rows)
    const rowsWithMeasurements = measurements.filter(m =>
      (m.chest || m.biceps || m.waist || m.thighs) && m.weight !== 0
    );

    console.log(`Found ${rowsWithMeasurements.length} rows with valid body measurements (excluding weight: 0 rows)`);

    // Use most recent row with full measurements, or fall back to most recent with valid weight
    const latestWithMeasurements = rowsWithMeasurements[0] || measurements.find(m => m.weight > 0) || measurements[0];
    const latestWeight = measurements.find(m => m.weight !== null && m.weight > 0);
    const latestBodyFat = measurements.find(m => m.bodyFat !== null && m.bodyFat > 0);
    const oldest = measurements[measurements.length - 1];

    console.log('Selected row for measurements:', {
      date: latestWithMeasurements.date,
      weight: latestWithMeasurements.weight,
      chest: latestWithMeasurements.chest,
      leftBicep: latestWithMeasurements.leftBicep,
      rightBicep: latestWithMeasurements.rightBicep
    });
    console.log('Latest weight:', latestWeight?.weight);
    console.log('Latest bodyFat:', latestBodyFat?.bodyFat);

    // Update data - PRESERVE Apple Health data for weight/bodyFat
    const data = readData();

    // Keep Apple Health weight/bodyFat if they exist
    const appleWeight = data.measurements?.sources?.weight === 'Apple Health' ? data.measurements.current?.weight : null;
    const appleBodyFat = data.measurements?.sources?.bodyFat === 'Apple Health' ? data.measurements.current?.bodyFat : null;

    data.measurements = {
      current: {
        // Use Apple Health for weight/bodyFat if available, otherwise Hevy
        weight: appleWeight ?? latestWeight?.weight ?? data.measurements?.current?.weight,
        bodyFat: appleBodyFat ?? latestBodyFat?.bodyFat ?? data.measurements?.current?.bodyFat,
        // Body measurements from Hevy (Apple doesn't have these)
        neck: latestWithMeasurements.neck,
        shoulders: latestWithMeasurements.shoulders,
        chest: latestWithMeasurements.chest,
        leftBicep: latestWithMeasurements.leftBicep,
        rightBicep: latestWithMeasurements.rightBicep,
        biceps: latestWithMeasurements.biceps,
        leftForearm: latestWithMeasurements.leftForearm,
        rightForearm: latestWithMeasurements.rightForearm,
        abdomen: latestWithMeasurements.abdomen,
        waist: latestWithMeasurements.waist,
        hips: latestWithMeasurements.hips,
        leftThigh: latestWithMeasurements.leftThigh,
        rightThigh: latestWithMeasurements.rightThigh,
        thighs: latestWithMeasurements.thighs,
        leftCalf: latestWithMeasurements.leftCalf,
        rightCalf: latestWithMeasurements.rightCalf,
        calves: latestWithMeasurements.calves,
      },
      starting: {
        weight: oldest.weight,
        bodyFat: oldest.bodyFat,
        chest: oldest.chest,
        biceps: oldest.biceps,
        waist: oldest.waist,
        thighs: oldest.thighs,
      },
      history: measurements,
      sources: {
        weight: appleWeight ? 'Apple Health' : 'Hevy',
        bodyFat: appleBodyFat ? 'Apple Health' : 'Hevy',
        measurements: 'Hevy'
      }
    };

    data.lastSync = new Date().toISOString();

    fs.unlinkSync(req.file.path);

    if (writeData(data)) {
      console.log('Saved measurements:', data.measurements.current);
      res.json({
        success: true,
        count: measurements.length,
        current: data.measurements.current,
        sources: data.measurements.sources
      });
    } else {
      res.status(500).json({ error: 'Failed to save data' });
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

    // Merge strength workout data with existing Hevy workouts by date
    console.log(`Merging Apple Health data with ${data.workouts.length} Hevy workouts...`);
    data.workouts = data.workouts.map(workout => {
      const dateKey = workout.start_time.split('T')[0];
      const appleData = processed.strengthWorkoutData[dateKey];

      if (appleData) {
        console.log(`Merging Apple Health data for workout on ${dateKey}`);
        return {
          ...workout,
          appleHealth: {
            duration: appleData.duration,
            activeCalories: appleData.activeCalories,
            avgHeartRate: appleData.avgHeartRate,
            maxHeartRate: appleData.maxHeartRate,
            source: 'Apple Health'
          }
        };
      }
      return workout;
    });

    // Log merge results
    const mergedCount = data.workouts.filter(w => w.appleHealth).length;
    console.log(`Merged Apple Health data with ${mergedCount} workouts`);

    // Set conditioning sessions (sorted newest first)
    data.conditioning = processed.conditioningSessions;

    // Update resting heart rate if available
    if (processed.avgRestingHR) {
      data.appleHealth.restingHeartRate = processed.avgRestingHR;
    }

    // IMPORTANT: Apple Health has PRIORITY for weight and body fat
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

      // Mark Apple Health as source for weight
      data.measurements.sources = data.measurements.sources || {};
      data.measurements.sources.weight = 'Apple Health';
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

      // Mark Apple Health as source for body fat
      data.measurements.sources = data.measurements.sources || {};
      data.measurements.sources.bodyFat = 'Apple Health';
    }

    // Update lean body mass if available
    if (parsedData.leanMassRecords && parsedData.leanMassRecords.length > 0) {
      const sorted = parsedData.leanMassRecords.sort((a, b) => new Date(a.date) - new Date(b.date));
      const startingLeanMass = sorted[0].value;
      const currentLeanMass = sorted[sorted.length - 1].value;

      if (startingLeanMass) {
        data.measurements.starting = {
          ...data.measurements.starting,
          leanMass: Math.round(startingLeanMass * 10) / 10
        };
      }
      if (currentLeanMass) {
        data.measurements.current = {
          ...data.measurements.current,
          leanMass: Math.round(currentLeanMass * 10) / 10
        };
      }

      // Mark Apple Health as source for lean mass
      data.measurements.sources = data.measurements.sources || {};
      data.measurements.sources.leanMass = 'Apple Health';
    }

    // Store dietary calorie intake data
    if (processed.dailyCalorieIntake && Object.keys(processed.dailyCalorieIntake).length > 0) {
      data.nutrition = data.nutrition || {};
      data.nutrition.dailyCalorieIntake = processed.dailyCalorieIntake;
    }

    // Store weight history for trend graphs
    if (processed.weightHistory && processed.weightHistory.length > 0) {
      data.measurements.history = processed.weightHistory;
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
          restingHRRecords: parsedData.stats.restingHRRecordsFound,
          leanMassRecords: parsedData.stats.leanMassRecordsFound
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
// APPLE HEALTH CSV UPLOAD (Health Auto Export app)
// ============================================
app.post('/api/apple-health/csv/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    const lines = fileContent.trim().split('\n');

    if (lines.length < 2) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'CSV file is empty' });
    }

    // Parse headers
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));

    // Common Health Auto Export columns:
    // Date, Active Energy (kcal), Resting Heart Rate (bpm), Weight (kg), Body Fat (%), etc.

    const results = {
      weightRecords: [],
      bodyFatRecords: [],
      restingHRRecords: [],
      leanMassRecords: [],
      calorieRecords: [],
      workouts: []
    };

    // Column index mapping
    const colIndex = {
      date: headers.findIndex(h => h.includes('date') || h.includes('time')),
      weight: headers.findIndex(h => h.includes('weight') || h.includes('body mass')),
      bodyFat: headers.findIndex(h => h.includes('body fat') || h.includes('fat %')),
      leanMass: headers.findIndex(h => h.includes('lean') || h.includes('lean body mass')),
      restingHR: headers.findIndex(h => h.includes('resting') && h.includes('heart')),
      activeCalories: headers.findIndex(h => h.includes('active') && (h.includes('energy') || h.includes('calories'))),
    };

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));

      const date = colIndex.date >= 0 ? values[colIndex.date] : null;
      if (!date) continue;

      // Extract values
      if (colIndex.weight >= 0 && values[colIndex.weight]) {
        const weight = parseFloat(values[colIndex.weight]);
        if (!isNaN(weight) && weight > 0) {
          results.weightRecords.push({ date, value: weight });
        }
      }

      if (colIndex.bodyFat >= 0 && values[colIndex.bodyFat]) {
        const bodyFat = parseFloat(values[colIndex.bodyFat]);
        if (!isNaN(bodyFat) && bodyFat > 0) {
          results.bodyFatRecords.push({ date, value: bodyFat });
        }
      }

      if (colIndex.leanMass >= 0 && values[colIndex.leanMass]) {
        const leanMass = parseFloat(values[colIndex.leanMass]);
        if (!isNaN(leanMass) && leanMass > 0) {
          results.leanMassRecords.push({ date, value: leanMass });
        }
      }

      if (colIndex.restingHR >= 0 && values[colIndex.restingHR]) {
        const hr = parseFloat(values[colIndex.restingHR]);
        if (!isNaN(hr) && hr > 0) {
          results.restingHRRecords.push({ date, value: hr });
        }
      }

      if (colIndex.activeCalories >= 0 && values[colIndex.activeCalories]) {
        const cal = parseFloat(values[colIndex.activeCalories]);
        if (!isNaN(cal) && cal > 0) {
          results.calorieRecords.push({ date, value: cal });
        }
      }
    }

    // Sort by date (newest first)
    Object.keys(results).forEach(key => {
      if (Array.isArray(results[key])) {
        results[key].sort((a, b) => new Date(b.date) - new Date(a.date));
      }
    });

    // Update stored data - Apple Health has PRIORITY
    const data = readData();

    // Update measurements with Apple Health priority
    if (results.weightRecords.length > 0) {
      data.measurements = data.measurements || { current: {}, starting: {} };
      data.measurements.current.weight = results.weightRecords[0].value;
      data.measurements.sources = data.measurements.sources || {};
      data.measurements.sources.weight = 'Apple Health';
    }

    if (results.bodyFatRecords.length > 0) {
      data.measurements = data.measurements || { current: {}, starting: {} };
      data.measurements.current.bodyFat = results.bodyFatRecords[0].value;
      data.measurements.sources = data.measurements.sources || {};
      data.measurements.sources.bodyFat = 'Apple Health';
    }

    if (results.leanMassRecords.length > 0) {
      data.measurements = data.measurements || { current: {}, starting: {} };
      data.measurements.current.leanMass = results.leanMassRecords[0].value;
      data.measurements.sources = data.measurements.sources || {};
      data.measurements.sources.leanMass = 'Apple Health';
    }

    if (results.restingHRRecords.length > 0) {
      data.appleHealth = data.appleHealth || {};
      data.appleHealth.restingHeartRate = Math.round(
        results.restingHRRecords.slice(0, 7).reduce((sum, r) => sum + r.value, 0) /
        Math.min(results.restingHRRecords.length, 7)
      );
    }

    data.lastSync = new Date().toISOString();

    fs.unlinkSync(req.file.path);

    if (writeData(data)) {
      res.json({
        success: true,
        imported: {
          weightRecords: results.weightRecords.length,
          bodyFatRecords: results.bodyFatRecords.length,
          leanMassRecords: results.leanMassRecords.length,
          restingHRRecords: results.restingHRRecords.length,
        },
        current: {
          weight: data.measurements?.current?.weight,
          bodyFat: data.measurements?.current?.bodyFat,
          leanMass: data.measurements?.current?.leanMass,
          restingHR: data.appleHealth?.restingHeartRate
        }
      });
    } else {
      res.status(500).json({ error: 'Failed to save data' });
    }

  } catch (error) {
    console.error('Apple Health CSV upload error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
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
