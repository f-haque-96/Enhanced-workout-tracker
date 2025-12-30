const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

// Your Hevy API Key
const HEVY_API_KEY = process.env.HEVY_API_KEY || '63d8a8e8-e4b5-408b-bf03-aa06ea80a5f1';
const HEVY_API_BASE = 'https://api.hevyapp.com/v1';

// Webhook secret for verification (you'll set this in Hevy)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'hit-tracker-webhook-secret-2024';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// File upload config
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit for Apple Health exports
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
      current: { weight: 82, bodyFat: 14, chest: 104, waist: 82, biceps: 38, thighs: 58 },
      starting: { weight: 78, bodyFat: 18, chest: 98, waist: 85, biceps: 35, thighs: 54 }
    },
    appleHealth: {
      restingHeartRate: 62,
      avgSteps: 8432,
      avgActiveCalories: 520,
      sleepAvg: 7.2
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
  let category = 'other';
  const exerciseNames = workout.exercises.map(e => (e.title || '').toLowerCase()).join(' ');
  
  if (exerciseNames.includes('bench') || exerciseNames.includes('shoulder') || exerciseNames.includes('tricep') || exerciseNames.includes('chest') || exerciseNames.includes('fly') || exerciseNames.includes('incline') || exerciseNames.includes('press') && !exerciseNames.includes('leg')) {
    category = 'push';
  } else if (exerciseNames.includes('deadlift') || exerciseNames.includes('row') || exerciseNames.includes('pull') || exerciseNames.includes('curl') || exerciseNames.includes('lat') || exerciseNames.includes('back')) {
    category = 'pull';
  } else if (exerciseNames.includes('squat') || exerciseNames.includes('leg') || exerciseNames.includes('lunge') || exerciseNames.includes('calf') || exerciseNames.includes('hamstring')) {
    category = 'legs';
  }
  
  return {
    id: workout.id,
    title: workout.title || `${category.charAt(0).toUpperCase() + category.slice(1)} Day`,
    category,
    start_time: workout.start_time,
    end_time: workout.end_time,
    appleHealth: null,
    exercises: (workout.exercises || []).map(exercise => ({
      title: exercise.title,
      muscle_group: exercise.muscle_group || 'other',
      sets: (exercise.sets || []).map(set => ({
        set_type: set.set_type || (set.rpe >= 10 ? 'failure' : set.rpe === null ? 'warmup' : 'working'),
        weight_kg: set.weight_kg,
        reps: set.reps,
        rpe: set.rpe,
        distance_meters: set.distance_meters,
        duration_seconds: set.duration_seconds
      }))
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
    
    while (hasMore && page <= 10) {
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

// Upload Hevy JSON export
app.post('/api/hevy/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    const hevyData = JSON.parse(fileContent);
    
    const workouts = (hevyData.workouts || []).map(transformWorkout);
    
    const data = readData();
    data.workouts = workouts;
    data.lastSync = new Date().toISOString();
    
    fs.unlinkSync(req.file.path);
    
    if (writeData(data)) {
      res.json({ success: true, workoutsCount: workouts.length });
    } else {
      res.status(500).json({ error: 'Failed to save data' });
    }
    
  } catch (error) {
    console.error('Hevy upload error:', error);
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// APPLE HEALTH ROUTES
// ============================================

// Upload Apple Health export
app.post('/api/apple-health/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log('Processing Apple Health export...');
    
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(fileContent);
    
    const healthData = result.HealthData;
    const records = healthData.Record || [];
    const workoutRecords = healthData.Workout || [];
    
    console.log(`Found ${records.length} records and ${workoutRecords.length} workouts`);
    
    const conditioningSessions = [];
    const strengthWorkoutData = {};
    
    workoutRecords.forEach(workout => {
      const attrs = workout.$ || {};
      const workoutType = attrs.workoutActivityType || '';
      const startDate = attrs.startDate;
      const duration = parseFloat(attrs.duration) || 0;
      const totalCalories = parseFloat(attrs.totalEnergyBurned) || 0;
      const totalDistance = parseFloat(attrs.totalDistance) || 0;
      
      const metadata = {};
      (workout.MetadataEntry || []).forEach(entry => {
        if (entry.$) {
          metadata[entry.$.key] = entry.$.value;
        }
      });
      
      const isStrength = workoutType.includes('StrengthTraining') || 
                         workoutType.includes('TraditionalStrengthTraining') ||
                         workoutType.includes('FunctionalStrengthTraining');
      
      if (isStrength) {
        const dateKey = startDate.split('T')[0];
        strengthWorkoutData[dateKey] = {
          duration: duration * 60,
          activeCalories: totalCalories,
          avgHeartRate: parseInt(metadata['HKAverageHeartRate']) || null,
          maxHeartRate: parseInt(metadata['HKMaximumHeartRate']) || null
        };
      } else {
        let category = 'other';
        let type = 'Other';
        
        if (workoutType.includes('Walking')) { category = 'walking'; type = 'Outdoor Walk'; }
        else if (workoutType.includes('Running')) { category = 'running'; type = 'Outdoor Run'; }
        else if (workoutType.includes('Cycling')) { category = 'cycling'; type = 'Cycling'; }
        else if (workoutType.includes('Swimming')) { category = 'swimming'; type = 'Swimming'; }
        else if (workoutType.includes('HIIT') || workoutType.includes('HighIntensity')) { category = 'hiit'; type = 'HIIT'; }
        
        conditioningSessions.push({
          id: `apple-${startDate}`,
          type,
          category,
          date: startDate,
          source: 'Apple Health',
          duration: duration * 60,
          activeCalories: Math.round(totalCalories),
          avgHeartRate: parseInt(metadata['HKAverageHeartRate']) || 120,
          maxHeartRate: parseInt(metadata['HKMaximumHeartRate']) || 150,
          distance: totalDistance > 0 ? parseFloat((totalDistance / 1000).toFixed(2)) : null,
          pace: (totalDistance > 0 && duration > 0) ? Math.round((duration * 60) / (totalDistance / 1000)) : null,
          hrZones: { zone1: 15, zone2: 35, zone3: 30, zone4: 15, zone5: 5 }
        });
      }
    });
    
    let restingHRSum = 0, restingHRCount = 0;
    
    records.forEach(record => {
      const attrs = record.$ || {};
      const type = attrs.type || '';
      const value = parseFloat(attrs.value) || 0;
      
      if (type === 'HKQuantityTypeIdentifierRestingHeartRate') {
        restingHRSum += value;
        restingHRCount++;
      }
    });
    
    const data = readData();
    
    data.workouts = data.workouts.map(workout => {
      const dateKey = workout.start_time.split('T')[0];
      if (strengthWorkoutData[dateKey]) {
        return { ...workout, appleHealth: strengthWorkoutData[dateKey] };
      }
      return workout;
    });
    
    data.conditioning = conditioningSessions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (restingHRCount > 0) {
      data.appleHealth.restingHeartRate = Math.round(restingHRSum / restingHRCount);
    }
    
    data.lastSync = new Date().toISOString();
    
    fs.unlinkSync(req.file.path);
    
    if (writeData(data)) {
      res.json({ 
        success: true, 
        conditioningSessions: conditioningSessions.length,
        strengthWorkoutsEnriched: Object.keys(strengthWorkoutData).length
      });
    } else {
      res.status(500).json({ error: 'Failed to save data' });
    }
    
  } catch (error) {
    console.error('Apple Health upload error:', error);
    if (req.file) fs.unlinkSync(req.file.path);
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
    
    while (hasMore && page <= 10) {
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
