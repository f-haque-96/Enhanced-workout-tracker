## MAJOR UPDATE: Streaming XML Parser, Fix Achievements, Cleanup UI, Health Score Card

### OVERVIEW

This update does the following:
1. **Fix achievement merge bug** - Don't overwrite Hevy workouts when uploading Apple Health
2. **Remove unnecessary buttons** - Only keep "Apple Health XML" and "Reset"
3. **Streaming XML parser** - Process 150MB+ files without memory issues
4. **Auto-delete XML** - Remove uploaded file immediately after processing
5. **Replace Measurements card** - New Health Score card

---

### TASK 1: Create Streaming XML Parser (Memory Efficient)

Create a new file `backend/streaming-xml-parser.js`:
```javascript
const fs = require('fs');
const readline = require('readline');

/**
 * Streaming Apple Health XML Parser
 * Processes large XML files line-by-line without loading entire file into memory
 * Extracts only the data we need, ignores everything else
 */

const parseAppleHealthXMLStreaming = async (filePath) => {
  return new Promise((resolve, reject) => {
    const results = {
      weight: [],
      bodyFat: [],
      leanBodyMass: [],
      waistCircumference: [],
      workouts: [],
      sleepAnalysis: [],
      restingHeartRate: [],
      steps: [],
      activeEnergy: [],
      dietaryEnergy: [],
      stats: {
        linesProcessed: 0,
        recordsFound: 0,
        startTime: Date.now(),
      }
    };

    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let currentWorkout = null;
    let workoutBuffer = '';

    rl.on('line', (line) => {
      results.stats.linesProcessed++;
      
      // Weight
      if (line.includes('HKQuantityTypeIdentifierBodyMass') && line.includes('Record')) {
        const record = parseRecordLine(line);
        if (record && record.value >= 40 && record.value <= 200) {
          results.weight.push(record);
          results.stats.recordsFound++;
        }
      }
      
      // Body Fat Percentage
      else if (line.includes('HKQuantityTypeIdentifierBodyFatPercentage') && line.includes('Record')) {
        const record = parseRecordLine(line);
        if (record) {
          // Convert decimal to percentage if needed
          record.value = record.value < 1 ? record.value * 100 : record.value;
          if (record.value > 0 && record.value < 60) {
            results.bodyFat.push(record);
            results.stats.recordsFound++;
          }
        }
      }
      
      // Lean Body Mass
      else if (line.includes('HKQuantityTypeIdentifierLeanBodyMass') && line.includes('Record')) {
        const record = parseRecordLine(line);
        if (record && record.value >= 30 && record.value <= 150) {
          results.leanBodyMass.push(record);
          results.stats.recordsFound++;
        }
      }
      
      // Waist Circumference
      else if (line.includes('HKQuantityTypeIdentifierWaistCircumference') && line.includes('Record')) {
        const record = parseRecordLine(line);
        if (record && record.value > 0) {
          // Convert cm to inches if needed (Apple Health stores in cm)
          if (record.value > 50) record.value = record.value / 2.54;
          results.waistCircumference.push(record);
          results.stats.recordsFound++;
        }
      }
      
      // Sleep Analysis
      else if (line.includes('HKCategoryTypeIdentifierSleepAnalysis') && line.includes('Record')) {
        const record = parseSleepRecord(line);
        if (record && record.duration > 0) {
          results.sleepAnalysis.push(record);
          results.stats.recordsFound++;
        }
      }
      
      // Resting Heart Rate
      else if (line.includes('HKQuantityTypeIdentifierRestingHeartRate') && line.includes('Record')) {
        const record = parseRecordLine(line);
        if (record && record.value > 30 && record.value < 150) {
          results.restingHeartRate.push(record);
          results.stats.recordsFound++;
        }
      }
      
      // Steps (daily totals)
      else if (line.includes('HKQuantityTypeIdentifierStepCount') && line.includes('Record')) {
        const record = parseRecordLine(line);
        if (record && record.value > 0) {
          results.steps.push(record);
          results.stats.recordsFound++;
        }
      }
      
      // Active Energy Burned
      else if (line.includes('HKQuantityTypeIdentifierActiveEnergyBurned') && line.includes('Record')) {
        const record = parseRecordLine(line);
        if (record && record.value > 0) {
          results.activeEnergy.push(record);
          results.stats.recordsFound++;
        }
      }
      
      // Dietary Energy (calories consumed)
      else if (line.includes('HKQuantityTypeIdentifierDietaryEnergyConsumed') && line.includes('Record')) {
        const record = parseRecordLine(line);
        if (record && record.value > 0) {
          results.dietaryEnergy.push(record);
          results.stats.recordsFound++;
        }
      }
      
      // Workouts - these span multiple lines
      else if (line.includes('<Workout')) {
        currentWorkout = { raw: line };
        workoutBuffer = line;
      }
      else if (currentWorkout && line.includes('</Workout>')) {
        workoutBuffer += line;
        const workout = parseWorkoutBlock(workoutBuffer);
        if (workout) {
          results.workouts.push(workout);
          results.stats.recordsFound++;
        }
        currentWorkout = null;
        workoutBuffer = '';
      }
      else if (currentWorkout) {
        workoutBuffer += line;
        // Extract workout statistics from nested elements
        if (line.includes('WorkoutStatistics') || line.includes('HeartRateStatistics')) {
          const stats = parseWorkoutStats(line);
          if (stats) {
            Object.assign(currentWorkout, stats);
          }
        }
      }
    });

    rl.on('close', () => {
      results.stats.endTime = Date.now();
      results.stats.duration = (results.stats.endTime - results.stats.startTime) / 1000;
      
      console.log(`Streaming parse complete:`);
      console.log(`  Lines processed: ${results.stats.linesProcessed}`);
      console.log(`  Records found: ${results.stats.recordsFound}`);
      console.log(`  Duration: ${results.stats.duration}s`);
      console.log(`  Weight records: ${results.weight.length}`);
      console.log(`  Workouts: ${results.workouts.length}`);
      console.log(`  Sleep records: ${results.sleepAnalysis.length}`);
      
      resolve(results);
    });

    rl.on('error', (error) => {
      reject(error);
    });
  });
};

// Helper: Parse a single-line Record element
const parseRecordLine = (line) => {
  try {
    const valueMatch = line.match(/value="([^"]+)"/);
    const dateMatch = line.match(/startDate="([^"]+)"/);
    const sourceMatch = line.match(/sourceName="([^"]+)"/);
    
    if (valueMatch && dateMatch) {
      return {
        value: parseFloat(valueMatch[1]),
        date: dateMatch[1],
        source: sourceMatch ? sourceMatch[1] : 'Apple Health',
      };
    }
  } catch (e) {
    // Skip malformed records
  }
  return null;
};

// Helper: Parse sleep record (has start and end date for duration)
const parseSleepRecord = (line) => {
  try {
    const startMatch = line.match(/startDate="([^"]+)"/);
    const endMatch = line.match(/endDate="([^"]+)"/);
    const valueMatch = line.match(/value="([^"]+)"/);
    
    if (startMatch && endMatch) {
      const start = new Date(startMatch[1]);
      const end = new Date(endMatch[1]);
      const duration = (end - start) / 1000 / 3600; // hours
      
      // Only count actual sleep (not "InBed")
      const isAsleep = valueMatch && 
        (valueMatch[1].includes('Asleep') || valueMatch[1].includes('asleep'));
      
      if (duration > 0 && duration < 24) {
        return {
          date: startMatch[1],
          duration: duration,
          isAsleep: isAsleep,
        };
      }
    }
  } catch (e) {
    // Skip malformed records
  }
  return null;
};

// Helper: Parse workout block
const parseWorkoutBlock = (block) => {
  try {
    const typeMatch = block.match(/workoutActivityType="([^"]+)"/);
    const startMatch = block.match(/startDate="([^"]+)"/);
    const endMatch = block.match(/endDate="([^"]+)"/);
    const durationMatch = block.match(/duration="([^"]+)"/);
    const caloriesMatch = block.match(/totalEnergyBurned="([^"]+)"/);
    const distanceMatch = block.match(/totalDistance="([^"]+)"/);
    
    // Extract statistics
    const avgHRMatch = block.match(/type="HKQuantityTypeIdentifierHeartRate"[^>]*average="([^"]+)"/);
    const maxHRMatch = block.match(/type="HKQuantityTypeIdentifierHeartRate"[^>]*maximum="([^"]+)"/);
    const activeCalMatch = block.match(/type="HKQuantityTypeIdentifierActiveEnergyBurned"[^>]*sum="([^"]+)"/);
    const distStatMatch = block.match(/type="HKQuantityTypeIdentifierDistanceWalkingRunning"[^>]*sum="([^"]+)"/);
    const stepsMatch = block.match(/type="HKQuantityTypeIdentifierStepCount"[^>]*sum="([^"]+)"/);
    
    if (typeMatch && startMatch) {
      // Clean up workout type
      let type = typeMatch[1].replace('HKWorkoutActivityType', '');
      type = type.replace(/([A-Z])/g, ' $1').trim();
      
      // Determine category
      const typeLower = type.toLowerCase();
      let category = 'other';
      if (typeLower.includes('walk')) category = 'walking';
      else if (typeLower.includes('run')) category = 'running';
      else if (typeLower.includes('cycl') || typeLower.includes('bike')) category = 'cycling';
      else if (typeLower.includes('swim')) category = 'swimming';
      else if (typeLower.includes('strength') || typeLower.includes('training')) category = 'strength';
      else if (typeLower.includes('hiit')) category = 'hiit';
      else if (typeLower.includes('yoga')) category = 'yoga';
      else if (typeLower.includes('elliptical')) category = 'elliptical';
      
      const start = new Date(startMatch[1]);
      const end = endMatch ? new Date(endMatch[1]) : null;
      const duration = durationMatch 
        ? parseFloat(durationMatch[1]) * 60 // Convert minutes to seconds
        : (end ? (end - start) / 1000 : 0);
      
      return {
        type: type,
        category: category,
        date: startMatch[1],
        endDate: endMatch ? endMatch[1] : null,
        duration: Math.round(duration),
        activeCalories: activeCalMatch ? Math.round(parseFloat(activeCalMatch[1])) : 
                       (caloriesMatch ? Math.round(parseFloat(caloriesMatch[1])) : 0),
        avgHeartRate: avgHRMatch ? Math.round(parseFloat(avgHRMatch[1])) : 0,
        maxHeartRate: maxHRMatch ? Math.round(parseFloat(maxHRMatch[1])) : 0,
        distance: distStatMatch ? parseFloat(distStatMatch[1]) : 
                 (distanceMatch ? parseFloat(distanceMatch[1]) : 0),
        steps: stepsMatch ? Math.round(parseFloat(stepsMatch[1])) : 0,
        source: 'Apple Health',
      };
    }
  } catch (e) {
    console.error('Error parsing workout:', e.message);
  }
  return null;
};

// Helper: Parse workout statistics line
const parseWorkoutStats = (line) => {
  const stats = {};
  
  if (line.includes('HKQuantityTypeIdentifierHeartRate')) {
    const avgMatch = line.match(/average="([^"]+)"/);
    const maxMatch = line.match(/maximum="([^"]+)"/);
    if (avgMatch) stats.avgHeartRate = Math.round(parseFloat(avgMatch[1]));
    if (maxMatch) stats.maxHeartRate = Math.round(parseFloat(maxMatch[1]));
  }
  
  if (line.includes('HKQuantityTypeIdentifierActiveEnergyBurned')) {
    const sumMatch = line.match(/sum="([^"]+)"/);
    if (sumMatch) stats.activeCalories = Math.round(parseFloat(sumMatch[1]));
  }
  
  if (line.includes('HKQuantityTypeIdentifierDistanceWalkingRunning')) {
    const sumMatch = line.match(/sum="([^"]+)"/);
    if (sumMatch) stats.distance = parseFloat(sumMatch[1]);
  }
  
  if (line.includes('HKQuantityTypeIdentifierStepCount')) {
    const sumMatch = line.match(/sum="([^"]+)"/);
    if (sumMatch) stats.steps = Math.round(parseFloat(sumMatch[1]));
  }
  
  return Object.keys(stats).length > 0 ? stats : null;
};

module.exports = { parseAppleHealthXMLStreaming };
```

---

### TASK 2: Update Apple Health Upload Endpoint

Update `backend/server.js` to use streaming parser and fix merge bug:
```javascript
const { parseAppleHealthXMLStreaming } = require('./streaming-xml-parser');

// Increase upload limit for large XML files
app.post('/api/apple-health/upload', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log(`Received file: ${req.file.originalname}, size: ${(req.file.size / 1024 / 1024).toFixed(2)} MB`);
    
    const filePath = req.file.path;
    
    // Read EXISTING data first - CRITICAL for merge
    const data = readData();
    
    // Count existing Hevy workouts BEFORE processing
    const existingHevyWorkouts = (data.workouts || []).filter(w => 
      w.source === 'hevy' || 
      w.source === 'Hevy' || 
      (w.exercises && w.exercises.length > 0)
    );
    console.log(`Preserving ${existingHevyWorkouts.length} existing Hevy workouts`);
    
    // Stream parse the XML file
    console.log('Starting streaming XML parse...');
    const parsed = await parseAppleHealthXMLStreaming(filePath);
    
    // DELETE the XML file immediately after parsing
    try {
      fs.unlinkSync(filePath);
      console.log('✅ Deleted uploaded XML file');
    } catch (e) {
      console.warn('Could not delete XML file:', e.message);
    }
    
    // Process Weight (last 90 days, latest value)
    if (parsed.weight.length > 0) {
      const sorted = parsed.weight.sort((a, b) => new Date(b.date) - new Date(a.date));
      data.measurements = data.measurements || { current: {}, starting: {}, history: [] };
      data.measurements.current.weight = sorted[0].value;
      data.measurements.sources = data.measurements.sources || {};
      data.measurements.sources.weight = 'Apple Health';
      
      // Build weight history (last 90 days)
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const recentWeights = sorted.filter(w => new Date(w.date) >= ninetyDaysAgo);
      
      // Merge with existing history
      recentWeights.forEach(w => {
        const dateKey = new Date(w.date).toISOString().split('T')[0];
        const exists = (data.measurements.history || []).some(h => h.date?.includes(dateKey));
        if (!exists) {
          data.measurements.history = data.measurements.history || [];
          data.measurements.history.push({ date: w.date, weight: w.value });
        }
      });
      
      data.measurements.history = (data.measurements.history || [])
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 90);
    }
    
    // Process Body Fat
    if (parsed.bodyFat.length > 0) {
      const sorted = parsed.bodyFat.sort((a, b) => new Date(b.date) - new Date(a.date));
      data.measurements = data.measurements || { current: {} };
      data.measurements.current.bodyFat = sorted[0].value;
      data.measurements.sources = data.measurements.sources || {};
      data.measurements.sources.bodyFat = 'Apple Health';
    }
    
    // Process Lean Body Mass
    if (parsed.leanBodyMass.length > 0) {
      const sorted = parsed.leanBodyMass.sort((a, b) => new Date(b.date) - new Date(a.date));
      data.measurements = data.measurements || { current: {} };
      data.measurements.current.leanMass = sorted[0].value;
    }
    
    // Process Waist Circumference
    if (parsed.waistCircumference.length > 0) {
      const sorted = parsed.waistCircumference.sort((a, b) => new Date(b.date) - new Date(a.date));
      data.measurements = data.measurements || { current: {} };
      data.measurements.current.waist = sorted[0].value;
      data.measurements.sources = data.measurements.sources || {};
      data.measurements.sources.waist = 'Apple Health';
    }
    
    // Process Sleep
    if (parsed.sleepAnalysis.length > 0) {
      // Aggregate sleep by night
      const sleepByNight = {};
      parsed.sleepAnalysis.forEach(s => {
        const dateKey = new Date(s.date).toISOString().split('T')[0];
        sleepByNight[dateKey] = (sleepByNight[dateKey] || 0) + s.duration;
      });
      
      const sleepRecords = Object.entries(sleepByNight)
        .map(([date, hours]) => ({ date, hours }))
        .filter(s => s.hours > 0 && s.hours < 16) // Filter unreasonable values
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 30);
      
      data.appleHealth = data.appleHealth || {};
      data.appleHealth.sleepRecords = sleepRecords;
      
      if (sleepRecords.length >= 7) {
        data.appleHealth.sleepAvg = sleepRecords.slice(0, 7)
          .reduce((sum, s) => sum + s.hours, 0) / 7;
      }
    }
    
    // Process Resting Heart Rate
    if (parsed.restingHeartRate.length > 0) {
      const sorted = parsed.restingHeartRate.sort((a, b) => new Date(b.date) - new Date(a.date));
      data.appleHealth = data.appleHealth || {};
      data.appleHealth.restingHeartRate = Math.round(
        sorted.slice(0, 7).reduce((sum, r) => sum + r.value, 0) / Math.min(sorted.length, 7)
      );
    }
    
    // Process Steps (aggregate by day)
    if (parsed.steps.length > 0) {
      const stepsByDay = {};
      parsed.steps.forEach(s => {
        const dateKey = new Date(s.date).toISOString().split('T')[0];
        stepsByDay[dateKey] = (stepsByDay[dateKey] || 0) + s.value;
      });
      
      const dailySteps = Object.entries(stepsByDay)
        .sort((a, b) => new Date(b[0]) - new Date(a[0]))
        .slice(0, 7);
      
      if (dailySteps.length > 0) {
        data.appleHealth = data.appleHealth || {};
        data.appleHealth.avgSteps = Math.round(
          dailySteps.reduce((sum, [_, steps]) => sum + steps, 0) / dailySteps.length
        );
      }
    }
    
    // Process Active Energy (aggregate by day)
    if (parsed.activeEnergy.length > 0) {
      const caloriesByDay = {};
      parsed.activeEnergy.forEach(c => {
        const dateKey = new Date(c.date).toISOString().split('T')[0];
        caloriesByDay[dateKey] = (caloriesByDay[dateKey] || 0) + c.value;
      });
      
      data.appleHealth = data.appleHealth || {};
      data.appleHealth.dailyActiveCalories = {};
      Object.entries(caloriesByDay).forEach(([date, cal]) => {
        data.appleHealth.dailyActiveCalories[date] = Math.round(cal);
      });
      
      const dailyCals = Object.values(caloriesByDay).slice(0, 7);
      if (dailyCals.length > 0) {
        data.appleHealth.avgActiveCalories = Math.round(
          dailyCals.reduce((sum, c) => sum + c, 0) / dailyCals.length
        );
      }
    }
    
    // Process Dietary Energy (calories consumed)
    if (parsed.dietaryEnergy.length > 0) {
      const dietByDay = {};
      parsed.dietaryEnergy.forEach(d => {
        const dateKey = new Date(d.date).toISOString().split('T')[0];
        dietByDay[dateKey] = (dietByDay[dateKey] || 0) + d.value;
      });
      
      data.nutrition = data.nutrition || { dailyCalorieIntake: {} };
      Object.entries(dietByDay).forEach(([date, cal]) => {
        data.nutrition.dailyCalorieIntake[date] = Math.round(cal);
      });
    }
    
    // Process Workouts - MERGE with existing Hevy workouts
    if (parsed.workouts.length > 0) {
      // Separate strength workouts (to merge with Hevy) from cardio (for conditioning)
      const strengthWorkouts = parsed.workouts.filter(w => w.category === 'strength');
      const cardioWorkouts = parsed.workouts.filter(w => w.category !== 'strength');
      
      // Merge Apple Health data into existing Hevy workouts by date
      const mergedHevyWorkouts = existingHevyWorkouts.map(hevyWorkout => {
        const hevyDate = hevyWorkout.start_time?.split('T')[0];
        
        const matchingApple = strengthWorkouts.find(aw => {
          const appleDate = aw.date?.split('T')[0];
          return appleDate === hevyDate;
        });
        
        if (matchingApple) {
          console.log(`Merged Apple Health data with Hevy workout on ${hevyDate}`);
          return {
            ...hevyWorkout,
            appleHealth: {
              duration: matchingApple.duration,
              activeCalories: matchingApple.activeCalories,
              avgHeartRate: matchingApple.avgHeartRate,
              maxHeartRate: matchingApple.maxHeartRate,
            }
          };
        }
        
        return hevyWorkout;
      });
      
      // Replace workouts with merged data (preserves Hevy exercises!)
      data.workouts = mergedHevyWorkouts;
      
      // Add cardio workouts to conditioning
      data.conditioning = data.conditioning || [];
      cardioWorkouts.forEach(cw => {
        const dateKey = cw.date?.split('T')[0];
        const exists = data.conditioning.some(c => 
          c.date?.split('T')[0] === dateKey && c.type === cw.type
        );
        
        if (!exists) {
          data.conditioning.push({
            id: `apple-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ...cw,
          });
        }
      });
      
      // Sort conditioning by date
      data.conditioning = data.conditioning
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    
    // Update sync timestamp
    data.lastSync = new Date().toISOString();
    data.lastSyncSource = 'Apple Health XML';
    
    // Save
    writeData(data);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    const response = {
      success: true,
      message: 'Apple Health data processed successfully',
      duration: `${duration}s`,
      processed: {
        weight: parsed.weight.length,
        bodyFat: parsed.bodyFat.length,
        leanBodyMass: parsed.leanBodyMass.length,
        workouts: parsed.workouts.length,
        sleepRecords: parsed.sleepAnalysis.length,
        restingHR: parsed.restingHeartRate.length,
        steps: parsed.steps.length,
        activeCalories: parsed.activeEnergy.length,
        dietaryCalories: parsed.dietaryEnergy.length,
      },
      preserved: {
        hevyWorkouts: existingHevyWorkouts.length,
      },
    };
    
    console.log('Upload complete:', response);
    res.json(response);
    
  } catch (error) {
    console.error('Apple Health upload error:', error);
    
    // Clean up file on error
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    
    res.status(500).json({ error: error.message });
  }
});
```

---

### TASK 3: Remove Unnecessary Upload Buttons

In the frontend MoreMenu component, simplify to only essential options:
```jsx
// Find the upload menu and simplify to:
const uploadOptions = [
  {
    id: 'apple-health-xml',
    label: '🍎 Upload Apple Health',
    description: 'Import from Health app export',
    accept: '.xml',
    endpoint: '/api/apple-health/upload',
    icon: <Apple className="w-4 h-4" />,
  },
];

const actionOptions = [
  {
    id: 'reset',
    label: '🗑️ Reset All Data',
    description: 'Clear all data and start fresh',
    action: handleResetData,
    isDestructive: true,
    icon: <Trash2 className="w-4 h-4" />,
  },
];

// REMOVE these options:
// - "Test Shortcut Sync"
// - "Hevy Workout (JSON/CSV)"
// - "Measurements (CSV)"
// - Any JSON endpoint testing
```

---

### TASK 4: Replace Measurements Card with Health Score Card

See the HealthScoreCard component from my previous response and add it to replace the Measurements card in the Body Composition section.

---

### TASK 5: Clean Up - Remove JSON Endpoint (Optional)

If you want to completely remove the Shortcut functionality:
```javascript
// In backend/server.js
// You can remove or comment out:
// app.post('/api/apple-health/json', ...)
```

---

### DEPLOYMENT
```bash
git add -A
git commit -m "Major: Streaming XML parser, fix achievement merge, simplify upload UI, health score card"
git push origin main

ssh pi@192.168.1.73 "cd ~/hit-tracker-pro && git pull && docker compose down && docker compose up -d --build"
```

### VERIFICATION

After deployment:
1. [ ] Upload Apple Health XML (even 150MB+ should work)
2. [ ] Check backend logs - should show "Deleted uploaded XML file"
3. [ ] Achievements should KEEP existing ones + add new (not reset)
4. [ ] Menu only shows "Upload Apple Health" and "Reset All Data"
5. [ ] Hevy workout exercises are preserved after upload
6. [ ] Health Score card shows instead of Measurements
7. [ ] Weight, sleep, HR data updates correctly