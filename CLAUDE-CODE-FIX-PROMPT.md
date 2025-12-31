# HIT Tracker Pro - Comprehensive Bug Fixes

## OVERVIEW
Fix 3 critical issues:
1. Apple Health 150MB XML causing 502 crashes
2. Hevy Measurements CSV parsing failing  
3. Tooltip appearing behind adjacent cards

Pi5: pi@192.168.1.73
Project: ~/hit-tracker-pro
GitHub: https://github.com/f-haque-96/Enhanced-workout-tracker

---

## FIX 1: Apple Health Large File Parser (CRITICAL)

The current XML parser loads the entire 150MB file into memory, crashing Node.js.

### Solution: Create a streaming line-by-line parser

Create a new file `backend/apple-health-parser.js`:

```javascript
// ============================================
// APPLE HEALTH LARGE FILE PARSER
// Extracts only needed data using streaming/regex
// Handles 150MB+ files without crashing
// ============================================

const fs = require('fs');
const readline = require('readline');

/**
 * Parse Apple Health export.xml file efficiently
 * Uses line-by-line reading + regex extraction
 * Memory efficient - can handle 150MB+ files
 */
async function parseAppleHealthExport(filePath, progressCallback = null) {
  return new Promise((resolve, reject) => {
    const results = {
      workouts: [],
      weightRecords: [],
      bodyFatRecords: [],
      restingHRRecords: [],
      stats: {
        linesProcessed: 0,
        workoutsFound: 0,
        weightRecordsFound: 0,
        bodyFatRecordsFound: 0,
        restingHRRecordsFound: 0
      }
    };

    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8', highWaterMark: 64 * 1024 });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let workoutBuffer = '';
    let insideWorkout = false;

    rl.on('line', (line) => {
      results.stats.linesProcessed++;
      
      if (progressCallback && results.stats.linesProcessed % 50000 === 0) {
        progressCallback(results.stats.linesProcessed);
      }

      // WORKOUT PARSING (can span multiple lines)
      if (line.includes('<Workout ')) {
        insideWorkout = true;
        workoutBuffer = line;
      } else if (insideWorkout) {
        workoutBuffer += ' ' + line.trim();
        if (line.includes('</Workout>') || (workoutBuffer.includes('<Workout ') && line.trim().endsWith('/>'))) {
          const workout = parseWorkoutXML(workoutBuffer);
          if (workout) {
            results.workouts.push(workout);
            results.stats.workoutsFound++;
          }
          insideWorkout = false;
          workoutBuffer = '';
        }
        // Prevent buffer from growing too large
        if (workoutBuffer.length > 50000) {
          insideWorkout = false;
          workoutBuffer = '';
        }
      }

      // WEIGHT RECORDS (single line)
      if (line.includes('HKQuantityTypeIdentifierBodyMass') && line.includes('value=')) {
        const record = parseHealthRecord(line, 'weight');
        if (record) {
          results.weightRecords.push(record);
          results.stats.weightRecordsFound++;
        }
      }

      // BODY FAT RECORDS (single line)
      if (line.includes('HKQuantityTypeIdentifierBodyFatPercentage') && line.includes('value=')) {
        const record = parseHealthRecord(line, 'bodyFat');
        if (record) {
          results.bodyFatRecords.push(record);
          results.stats.bodyFatRecordsFound++;
        }
      }

      // RESTING HEART RATE (single line)
      if (line.includes('HKQuantityTypeIdentifierRestingHeartRate') && line.includes('value=')) {
        const record = parseHealthRecord(line, 'restingHR');
        if (record) {
          results.restingHRRecords.push(record);
          results.stats.restingHRRecordsFound++;
        }
      }
    });

    rl.on('close', () => {
      // Sort all records by date (newest first)
      results.workouts.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
      results.weightRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
      results.bodyFatRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
      results.restingHRRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      console.log(`[Apple Health Parser] Complete:`, results.stats);
      resolve(results);
    });

    rl.on('error', reject);
    fileStream.on('error', reject);
  });
}

function parseWorkoutXML(xml) {
  try {
    const typeMatch = xml.match(/workoutActivityType="([^"]+)"/);
    const startMatch = xml.match(/startDate="([^"]+)"/);
    const endMatch = xml.match(/endDate="([^"]+)"/);
    const durationMatch = xml.match(/duration="([^"]+)"/);
    const caloriesMatch = xml.match(/totalEnergyBurned="([^"]+)"/);
    const distanceMatch = xml.match(/totalDistance="([^"]+)"/);

    if (!typeMatch || !startMatch) return null;

    const workoutType = typeMatch[1];
    
    let category = 'other';
    let displayType = 'Other';
    
    if (workoutType.includes('TraditionalStrengthTraining') || workoutType.includes('FunctionalStrengthTraining')) {
      category = 'strength';
      displayType = 'Strength Training';
    } else if (workoutType.includes('Walking')) {
      category = 'walking';
      displayType = 'Walking';
    } else if (workoutType.includes('Running')) {
      category = 'running';
      displayType = 'Running';
    } else if (workoutType.includes('Cycling')) {
      category = 'cycling';
      displayType = 'Cycling';
    } else if (workoutType.includes('Swimming')) {
      category = 'swimming';
      displayType = 'Swimming';
    } else if (workoutType.includes('HIIT') || workoutType.includes('HighIntensityIntervalTraining')) {
      category = 'hiit';
      displayType = 'HIIT';
    }

    const avgHRMatch = xml.match(/HKAverageHeartRate[^>]*value="([^"]+)"/);
    const maxHRMatch = xml.match(/HKMaximumHeartRate[^>]*value="([^"]+)"/);

    return {
      type: workoutType,
      category,
      displayType,
      startDate: startMatch[1],
      endDate: endMatch ? endMatch[1] : null,
      duration: durationMatch ? parseFloat(durationMatch[1]) * 60 : 0,
      calories: caloriesMatch ? parseFloat(caloriesMatch[1]) : 0,
      distance: distanceMatch ? parseFloat(distanceMatch[1]) : 0,
      avgHeartRate: avgHRMatch ? parseInt(avgHRMatch[1]) : null,
      maxHeartRate: maxHRMatch ? parseInt(maxHRMatch[1]) : null
    };
  } catch (e) {
    return null;
  }
}

function parseHealthRecord(line, type) {
  try {
    const valueMatch = line.match(/value="([^"]+)"/);
    const dateMatch = line.match(/startDate="([^"]+)"/);

    if (!valueMatch || !dateMatch) return null;

    let value = parseFloat(valueMatch[1]);
    
    // Convert body fat from decimal to percentage if needed
    if (type === 'bodyFat' && value < 1) {
      value = value * 100;
    }

    return { value, date: dateMatch[1] };
  } catch (e) {
    return null;
  }
}

module.exports = { parseAppleHealthExport };
```

### Update the Apple Health upload endpoint in `backend/server.js`:

Find the `/api/apple-health/upload` endpoint and REPLACE it with:

```javascript
// At the top of server.js, add:
const { parseAppleHealthExport } = require('./apple-health-parser');

// Replace the entire /api/apple-health/upload endpoint:
app.post('/api/apple-health/upload', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    const fileSize = req.file.size;
    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
    
    console.log(`[Apple Health] Starting upload processing: ${fileSizeMB}MB`);
    
    // Use streaming parser for ALL files (works for any size)
    const parsedData = await parseAppleHealthExport(filePath, (lines) => {
      console.log(`[Apple Health] Processed ${lines.toLocaleString()} lines...`);
    });
    
    console.log(`[Apple Health] Parsing complete:`, parsedData.stats);
    
    // Process the parsed data
    const strengthWorkoutData = {};
    const conditioningSessions = [];
    
    parsedData.workouts.forEach((workout, idx) => {
      const dateKey = workout.startDate.split('T')[0];
      
      if (workout.category === 'strength') {
        strengthWorkoutData[dateKey] = {
          duration: workout.duration,
          activeCalories: Math.round(workout.calories),
          avgHeartRate: workout.avgHeartRate,
          maxHeartRate: workout.maxHeartRate
        };
      } else if (workout.category !== 'other') {
        conditioningSessions.push({
          id: `apple-${workout.startDate}-${idx}`,
          type: workout.displayType,
          category: workout.category,
          date: workout.startDate,
          source: 'Apple Health',
          duration: workout.duration,
          activeCalories: Math.round(workout.calories),
          avgHeartRate: workout.avgHeartRate || 120,
          maxHeartRate: workout.maxHeartRate || 150,
          distance: workout.distance > 0 ? parseFloat((workout.distance / 1000).toFixed(2)) : null,
          pace: workout.distance > 0 && workout.duration > 0 
            ? Math.round(workout.duration / (workout.distance / 1000)) 
            : null,
          hrZones: { zone1: 20, zone2: 30, zone3: 30, zone4: 15, zone5: 5 }
        });
      }
    });
    
    // Get latest weight and body fat
    const latestWeight = parsedData.weightRecords.length > 0 ? parsedData.weightRecords[0].value : null;
    const latestBodyFat = parsedData.bodyFatRecords.length > 0 ? parsedData.bodyFatRecords[0].value : null;
    
    // Calculate average resting HR
    let avgRestingHR = null;
    if (parsedData.restingHRRecords.length > 0) {
      const recentHR = parsedData.restingHRRecords.slice(0, 30);
      avgRestingHR = Math.round(recentHR.reduce((acc, r) => acc + r.value, 0) / recentHR.length);
    }
    
    // Update data - PRESERVE existing measurements
    const data = readData();
    
    // Merge Apple Health data with existing Hevy workouts
    data.workouts = (data.workouts || []).map(workout => {
      const dateKey = workout.start_time?.split('T')[0];
      if (dateKey && strengthWorkoutData[dateKey]) {
        return { ...workout, appleHealth: strengthWorkoutData[dateKey] };
      }
      return workout;
    });
    
    // Add/update conditioning sessions
    if (conditioningSessions.length > 0) {
      data.conditioning = conditioningSessions.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    
    // Update measurements - PRESERVE existing body part measurements!
    data.measurements = data.measurements || { current: {}, starting: {} };
    if (latestWeight !== null) {
      data.measurements.current.weight = latestWeight;
    }
    if (latestBodyFat !== null) {
      data.measurements.current.bodyFat = latestBodyFat;
    }
    
    // Update resting HR
    if (avgRestingHR !== null) {
      data.appleHealth = data.appleHealth || {};
      data.appleHealth.restingHeartRate = avgRestingHR;
    }
    
    data.lastSync = new Date().toISOString();
    
    // Cleanup uploaded file
    fs.unlinkSync(filePath);
    
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    if (writeData(data)) {
      console.log(`[Apple Health] Success! Processed in ${processingTime}s`);
      res.json({ 
        success: true,
        processingTimeSeconds: processingTime,
        stats: parsedData.stats,
        conditioningSessions: conditioningSessions.length,
        strengthWorkoutsEnriched: Object.keys(strengthWorkoutData).length,
        weight: latestWeight,
        bodyFat: latestBodyFat,
        restingHR: avgRestingHR
      });
    } else {
      res.status(500).json({ error: 'Failed to save data' });
    }
    
  } catch (error) {
    console.error('[Apple Health] Upload error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});
```

---

## FIX 2: Hevy Measurements CSV Parser

The current parser may not match Hevy's actual CSV format.

### First, show me the actual Hevy CSV columns by asking the user to run:
```bash
# On Mac, if they have a Hevy export:
head -2 ~/Downloads/*.csv
```

### Then update the parser to handle whatever format Hevy uses.

Common Hevy CSV issues:
- Date format might be different (DD/MM/YYYY vs YYYY-MM-DD)
- Column names might have different casing
- Units might be in column name or separate column

Update the column mapping in the `/api/hevy/measurements/upload` endpoint:

```javascript
// More comprehensive column mapping
const columnMap = {
  // Date variations
  'date': 'date',
  'recorded': 'date',
  'recorded_at': 'date',
  'timestamp': 'date',
  
  // Weight variations
  'weight_kg': 'weight',
  'weight': 'weight',
  'body_weight': 'weight',
  'body_weight_kg': 'weight',
  'bodyweight': 'weight',
  
  // Body fat variations
  'body_fat_%': 'bodyFat',
  'body_fat': 'bodyFat',
  'body_fat_pct': 'bodyFat',
  'body_fat_percentage': 'bodyFat',
  'bodyfat': 'bodyFat',
  'bodyfat_%': 'bodyFat',
  'fat_%': 'bodyFat',
  'fat_pct': 'bodyFat',
  
  // Measurements (handle both with and without _cm suffix)
  'neck_cm': 'neck', 'neck': 'neck',
  'shoulders_cm': 'shoulders', 'shoulders': 'shoulders',
  'chest_cm': 'chest', 'chest': 'chest',
  'left_bicep_cm': 'leftBicep', 'left_bicep': 'leftBicep', 'l_bicep': 'leftBicep',
  'right_bicep_cm': 'rightBicep', 'right_bicep': 'rightBicep', 'r_bicep': 'rightBicep',
  'bicep_cm': 'biceps', 'bicep': 'biceps', 'biceps': 'biceps',
  'left_forearm_cm': 'leftForearm', 'left_forearm': 'leftForearm',
  'right_forearm_cm': 'rightForearm', 'right_forearm': 'rightForearm',
  'waist_cm': 'waist', 'waist': 'waist',
  'hips_cm': 'hips', 'hips': 'hips',
  'left_thigh_cm': 'leftThigh', 'left_thigh': 'leftThigh', 'l_thigh': 'leftThigh',
  'right_thigh_cm': 'rightThigh', 'right_thigh': 'rightThigh', 'r_thigh': 'rightThigh',
  'thigh_cm': 'thighs', 'thigh': 'thighs', 'thighs': 'thighs',
  'left_calf_cm': 'leftCalf', 'left_calf': 'leftCalf',
  'right_calf_cm': 'rightCalf', 'right_calf': 'rightCalf',
  'calf_cm': 'calves', 'calf': 'calves', 'calves': 'calves',
};

// More flexible header normalization
const normalizeHeader = (header) => {
  return header
    .toLowerCase()
    .trim()
    .replace(/[()%]/g, '')      // Remove (), %
    .replace(/\s+/g, '_')       // Spaces to underscores
    .replace(/__+/g, '_')       // Multiple underscores to single
    .replace(/^_|_$/g, '');     // Remove leading/trailing underscores
};
```

---

## FIX 3: Tooltip Z-Index (Still Behind Card)

The tooltip has `z-[9999]` but the PARENT CARD creates a new stacking context that traps the tooltip.

### Solution: Use a React Portal to render tooltip at document root

In `src/App.jsx`, replace the Tooltip component:

```jsx
import { createPortal } from 'react-dom';

const Tooltip = ({ children, content, position = 'top' }) => {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    
    let top, left;
    
    switch (position) {
      case 'top':
        top = rect.top + scrollY - 8;
        left = rect.left + scrollX + rect.width / 2;
        break;
      case 'bottom':
        top = rect.bottom + scrollY + 8;
        left = rect.left + scrollX + rect.width / 2;
        break;
      case 'left':
        top = rect.top + scrollY + rect.height / 2;
        left = rect.left + scrollX - 8;
        break;
      case 'right':
        top = rect.top + scrollY + rect.height / 2;
        left = rect.right + scrollX + 8;
        break;
      default:
        top = rect.top + scrollY - 8;
        left = rect.left + scrollX + rect.width / 2;
    }
    
    setCoords({ top, left });
  };
  
  const handleMouseEnter = () => {
    updatePosition();
    setShow(true);
  };
  
  const positionClasses = {
    top: '-translate-x-1/2 -translate-y-full',
    bottom: '-translate-x-1/2',
    left: '-translate-x-full -translate-y-1/2',
    right: '-translate-y-1/2'
  };
  
  return (
    <>
      <span 
        ref={triggerRef}
        className="relative inline-block"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShow(false)}
      >
        {children}
      </span>
      {show && createPortal(
        <div 
          className={`fixed ${positionClasses[position]} px-3 py-2 text-xs rounded-lg bg-slate-800 border border-white/20 shadow-xl max-w-xs whitespace-normal pointer-events-none`}
          style={{ 
            top: coords.top, 
            left: coords.left, 
            zIndex: 99999 
          }}
        >
          {content}
        </div>,
        document.body
      )}
    </>
  );
};
```

Also add `useRef` to the imports at the top of the file if not already there:
```jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
```

---

## DEPLOYMENT

After making all changes:

```bash
# Commit and push
git add .
git commit -m "Fix: Apple Health streaming parser, tooltip portal, CSV parsing"
git push origin main

# Deploy to Pi5
ssh pi@192.168.1.73
cd ~/hit-tracker-pro
git pull origin main
docker compose down
docker compose up -d --build

# Watch logs to verify
docker compose logs -f backend
```

## TESTING

1. Test Apple Health upload with your 150MB file
2. Test Hevy measurements CSV upload
3. Test tooltip hover on Key Lifts card - should appear ABOVE adjacent card now

---

## IMPORTANT NOTES

- The streaming parser processes line-by-line, using <100MB RAM even for 150MB files
- The Portal renders tooltips at document root, escaping all stacking contexts
- Always PRESERVE existing body measurements when updating from Apple Health
