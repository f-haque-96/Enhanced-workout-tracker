## DEFINITIVE FIX: Make Data Parsing Robust and Defensive

We've identified the root causes. Now let's fix them permanently with robust, defensive code that handles ANY data format.

### PRINCIPLE: Normalize ALL data on READ, not just on WRITE

Instead of hoping the backend saves data correctly, the frontend should normalize data when reading it. This makes the system resilient to format changes.

---

## FIX 1: Create Data Normalization Layer (src/App.jsx)

Add this near the top of App.jsx after the imports:
```javascript
// ============================================
// DATA NORMALIZATION - Handles any format
// ============================================

/**
 * Normalize measurements data from any source
 * Handles: Hevy CSV, Apple Health, manual entry
 */
const normalizeMeasurements = (raw) => {
  if (!raw) return { current: {}, starting: {}, history: [] };
  
  const normalize = (obj) => {
    if (!obj) return {};
    return {
      weight: obj.weight ?? obj.weight_kg ?? obj.bodyMass ?? null,
      bodyFat: obj.bodyFat ?? obj.fat_percent ?? obj.body_fat ?? obj.fatPercent ?? null,
      leanMass: obj.leanMass ?? obj.lean_mass ?? obj.leanBodyMass ?? null,
      // Body measurements - check multiple possible field names
      neck: obj.neck ?? obj.neck_in ?? obj.neckIn ?? null,
      shoulders: obj.shoulders ?? obj.shoulder_in ?? obj.shoulderIn ?? null,
      chest: obj.chest ?? obj.chest_in ?? obj.chestIn ?? null,
      // Biceps - prefer individual, fallback to combined
      leftBicep: obj.leftBicep ?? obj.left_bicep_in ?? obj.left_bicep ?? null,
      rightBicep: obj.rightBicep ?? obj.right_bicep_in ?? obj.right_bicep ?? null,
      biceps: obj.biceps ?? obj.leftBicep ?? obj.rightBicep ?? obj.left_bicep_in ?? obj.right_bicep_in ?? obj.left_bicep ?? obj.right_bicep ?? null,
      // Forearms
      leftForearm: obj.leftForearm ?? obj.left_forearm_in ?? obj.left_forearm ?? null,
      rightForearm: obj.rightForearm ?? obj.right_forearm_in ?? obj.right_forearm ?? null,
      // Core
      abdomen: obj.abdomen ?? obj.abdomen_in ?? null,
      waist: obj.waist ?? obj.waist_in ?? obj.waistIn ?? null,
      hips: obj.hips ?? obj.hips_in ?? obj.hipsIn ?? null,
      // Legs
      leftThigh: obj.leftThigh ?? obj.left_thigh_in ?? obj.left_thigh ?? null,
      rightThigh: obj.rightThigh ?? obj.right_thigh_in ?? obj.right_thigh ?? null,
      thighs: obj.thighs ?? obj.leftThigh ?? obj.rightThigh ?? obj.left_thigh_in ?? obj.right_thigh_in ?? obj.left_thigh ?? obj.right_thigh ?? null,
      leftCalf: obj.leftCalf ?? obj.left_calf_in ?? obj.left_calf ?? null,
      rightCalf: obj.rightCalf ?? obj.right_calf_in ?? obj.right_calf ?? null,
    };
  };
  
  return {
    current: normalize(raw.current),
    starting: normalize(raw.starting),
    history: raw.history || [],
    sources: raw.sources || {}
  };
};

/**
 * Normalize a single conditioning session
 * Handles: Apple Health XML, Apple Health CSV, any format
 */
const normalizeConditioningSession = (session) => {
  if (!session) return null;
  
  return {
    id: session.id ?? `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: session.type ?? session.workoutType ?? session.activityType ?? 'Other',
    category: session.category ?? 'other',
    date: session.date ?? session.startDate ?? session.start_time ?? null,
    source: session.source ?? 'Unknown',
    // Duration - handle seconds or minutes
    duration: session.duration ?? session.durationSeconds ?? (session.durationMinutes ? session.durationMinutes * 60 : 0),
    // Calories - check ALL possible field names
    activeCalories: session.activeCalories ?? session.calories ?? session.totalCalories ?? session.energyBurned ?? session.active_calories ?? 0,
    // Heart rate - check ALL possible field names
    avgHeartRate: session.avgHeartRate ?? session.averageHeartRate ?? session.hr_avg ?? session.heartRateAvg ?? session.avg_hr ?? 0,
    maxHeartRate: session.maxHeartRate ?? session.maximumHeartRate ?? session.hr_max ?? session.heartRateMax ?? session.max_hr ?? 0,
    // Distance
    distance: session.distance ?? session.totalDistance ?? session.distanceKm ?? 0,
    pace: session.pace ?? session.avgPace ?? null,
    hrZones: session.hrZones ?? { zone1: 20, zone2: 30, zone3: 30, zone4: 15, zone5: 5 }
  };
};

/**
 * Normalize conditioning array
 */
const normalizeConditioning = (raw) => {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map(normalizeConditioningSession).filter(s => s !== null);
};

/**
 * Normalize workout with Apple Health data
 */
const normalizeWorkout = (workout) => {
  if (!workout) return null;
  
  // Normalize Apple Health data if present
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

/**
 * Normalize all workouts
 */
const normalizeWorkouts = (raw) => {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map(normalizeWorkout).filter(w => w !== null);
};

/**
 * Normalize Apple Health stats
 */
const normalizeAppleHealth = (raw) => {
  if (!raw) return { restingHeartRate: null, avgSteps: null, avgActiveCalories: null, sleepAvg: null };
  return {
    restingHeartRate: raw.restingHeartRate ?? raw.resting_hr ?? raw.restingHR ?? null,
    avgSteps: raw.avgSteps ?? raw.steps ?? null,
    avgActiveCalories: raw.avgActiveCalories ?? raw.activeCalories ?? null,
    sleepAvg: raw.sleepAvg ?? raw.sleep ?? null,
  };
};

/**
 * Master normalize function - normalizes entire API response
 */
const normalizeApiData = (raw) => {
  if (!raw) return null;
  return {
    workouts: normalizeWorkouts(raw.workouts),
    conditioning: normalizeConditioning(raw.conditioning),
    measurements: normalizeMeasurements(raw.measurements),
    appleHealth: normalizeAppleHealth(raw.appleHealth),
    lastSync: raw.lastSync,
    lastWebhook: raw.lastWebhook,
  };
};
```

---

## FIX 2: Use Normalization When Loading Data

Find the useEffect that loads data and update it:
```javascript
useEffect(() => {
  const loadData = async () => {
    setLoading(true);
    
    try {
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
    console.log('📊 Using mock data');
    setLastUpdated(new Date());
    setLoading(false);
  };
  
  loadData();
  
  const interval = setInterval(loadData, 5 * 60 * 1000);
  return () => clearInterval(interval);
}, []);
```

---

## FIX 3: Update Backend to Store Correct Field Names (backend/server.js)

Find the Apple Health parser output and fix field names:
```javascript
// In processAppleHealthData or wherever conditioning sessions are created:
// CHANGE:
calories: Math.round(workout.calories),
// TO:
activeCalories: Math.round(workout.calories),

// Also ensure heart rate fields are correct:
avgHeartRate: workout.avgHeartRate || 0,
maxHeartRate: workout.maxHeartRate || 0,
```

---

## FIX 4: Fix Hevy Measurements CSV Parser (backend/server.js)

The measurements are being stored with wrong values. Find the `/api/hevy/measurements/upload` endpoint and REPLACE the parsing logic:
```javascript
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
    const rowsWithMeasurements = measurements.filter(m => 
      m.chest || m.biceps || m.waist || m.thighs
    );
    
    // Use most recent row with full measurements, or just most recent
    const latestWithMeasurements = rowsWithMeasurements[0] || measurements[0];
    const latestWeight = measurements.find(m => m.weight !== null);
    const latestBodyFat = measurements.find(m => m.bodyFat !== null);
    const oldest = measurements[measurements.length - 1];
    
    console.log('Latest with measurements:', latestWithMeasurements);
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
    console.error('Hevy measurements error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});
```

---

## FIX 5: Fix Apple Health Parser Field Names (backend/apple-health-parser.js or server.js)

Find where conditioning sessions are created and ensure correct field names:
```javascript
// When creating conditioning sessions, use activeCalories NOT calories:
conditioningSessions.push({
  id: `apple-${workout.startDate}-${idx}`,
  type: workout.displayType,
  category: workout.category,
  date: workout.startDate,
  source: 'Apple Health',
  duration: workout.duration,
  activeCalories: Math.round(workout.calories),  // USE activeCalories
  avgHeartRate: workout.avgHeartRate || 0,
  maxHeartRate: workout.maxHeartRate || 0,
  distance: workout.distance > 0 ? parseFloat((workout.distance / 1000).toFixed(2)) : null,
  pace: null,
  hrZones: { zone1: 20, zone2: 30, zone3: 30, zone4: 15, zone5: 5 }
});
```

---

## DEPLOYMENT & VERIFICATION
```bash
# Commit and push
git add -A
git commit -m "Robust data normalization - handles any format"
git push origin main

# Deploy
ssh pi@192.168.1.73 "cd ~/hit-tracker-pro && git pull && docker compose down && docker compose up -d --build"

# Wait and verify
sleep 30

# Check the data structure
ssh pi@192.168.1.73 "cd ~/hit-tracker-pro && docker compose exec backend cat /app/data/fitness-data.json | head -100"
```

Then re-upload your Hevy measurement_data.csv and verify:
- Chest should be 40"
- Biceps should be 14"
- Cardio should show HR and calories properly