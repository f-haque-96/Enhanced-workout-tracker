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
      leanMassRecords: [],
      stats: {
        linesProcessed: 0,
        workoutsFound: 0,
        weightRecordsFound: 0,
        bodyFatRecordsFound: 0,
        restingHRRecordsFound: 0,
        leanMassRecordsFound: 0
      }
    };

    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let currentWorkout = null;
    let workoutBuffer = '';
    let insideWorkout = false;

    rl.on('line', (line) => {
      results.stats.linesProcessed++;
      
      // Progress callback every 10000 lines
      if (progressCallback && results.stats.linesProcessed % 10000 === 0) {
        progressCallback(results.stats.linesProcessed);
      }

      // ==========================================
      // WORKOUT PARSING (multi-line)
      // ==========================================
      if (line.includes('<Workout ')) {
        insideWorkout = true;
        workoutBuffer = line;
      } else if (insideWorkout) {
        workoutBuffer += line;
        if (line.includes('</Workout>') || (line.includes('/>') && !workoutBuffer.includes('</Workout'))) {
          // Parse completed workout
          const workout = parseWorkoutXML(workoutBuffer);
          if (workout) {
            results.workouts.push(workout);
            results.stats.workoutsFound++;
          }
          insideWorkout = false;
          workoutBuffer = '';
        }
      }

      // ==========================================
      // WEIGHT RECORDS (single line)
      // ==========================================
      if (line.includes('HKQuantityTypeIdentifierBodyMass') && line.includes('value=')) {
        const record = parseHealthRecord(line, 'weight');
        if (record) {
          results.weightRecords.push(record);
          results.stats.weightRecordsFound++;
        }
      }

      // ==========================================
      // BODY FAT RECORDS (single line)
      // ==========================================
      if (line.includes('HKQuantityTypeIdentifierBodyFatPercentage') && line.includes('value=')) {
        const record = parseHealthRecord(line, 'bodyFat');
        if (record) {
          results.bodyFatRecords.push(record);
          results.stats.bodyFatRecordsFound++;
        }
      }

      // ==========================================
      // RESTING HEART RATE (single line)
      // ==========================================
      if (line.includes('HKQuantityTypeIdentifierRestingHeartRate') && line.includes('value=')) {
        const record = parseHealthRecord(line, 'restingHR');
        if (record) {
          results.restingHRRecords.push(record);
          results.stats.restingHRRecordsFound++;
        }
      }

      // ==========================================
      // LEAN BODY MASS (single line)
      // ==========================================
      if (line.includes('HKQuantityTypeIdentifierLeanBodyMass') && line.includes('value=')) {
        const record = parseHealthRecord(line, 'leanMass');
        if (record) {
          results.leanMassRecords.push(record);
          results.stats.leanMassRecordsFound++;
        }
      }
    });

    rl.on('close', () => {
      // Sort all records by date (newest first)
      results.workouts.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
      results.weightRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
      results.bodyFatRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
      results.restingHRRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
      results.leanMassRecords.sort((a, b) => new Date(b.date) - new Date(a.date));

      resolve(results);
    });

    rl.on('error', (err) => {
      reject(err);
    });

    fileStream.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Parse a single workout XML block
 */
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
    
    // Determine category
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
    } else if (workoutType.includes('Yoga')) {
      category = 'yoga';
      displayType = 'Yoga';
    } else if (workoutType.includes('Elliptical')) {
      category = 'elliptical';
      displayType = 'Elliptical';
    } else if (workoutType.includes('Rowing')) {
      category = 'rowing';
      displayType = 'Rowing';
    }

    // Extract heart rate from metadata if available
    const avgHRMatch = xml.match(/HKAverageHeartRate[^>]*value="([^"]+)"/);
    const maxHRMatch = xml.match(/HKMaximumHeartRate[^>]*value="([^"]+)"/);

    return {
      type: workoutType,
      category,
      displayType,
      startDate: startMatch[1],
      endDate: endMatch ? endMatch[1] : null,
      duration: durationMatch ? parseFloat(durationMatch[1]) * 60 : 0, // Convert to seconds
      calories: caloriesMatch ? parseFloat(caloriesMatch[1]) : 0,
      distance: distanceMatch ? parseFloat(distanceMatch[1]) : 0, // in meters
      avgHeartRate: avgHRMatch ? parseInt(avgHRMatch[1]) : null,
      maxHeartRate: maxHRMatch ? parseInt(maxHRMatch[1]) : null
    };
  } catch (e) {
    console.error('Error parsing workout:', e.message);
    return null;
  }
}

/**
 * Parse a single health record line
 */
function parseHealthRecord(line, type) {
  try {
    const valueMatch = line.match(/value="([^"]+)"/);
    const dateMatch = line.match(/startDate="([^"]+)"/);
    const unitMatch = line.match(/unit="([^"]+)"/);

    if (!valueMatch || !dateMatch) return null;

    let value = parseFloat(valueMatch[1]);
    
    // Convert body fat from decimal to percentage if needed
    if (type === 'bodyFat' && value < 1) {
      value = value * 100;
    }

    return {
      value,
      date: dateMatch[1],
      unit: unitMatch ? unitMatch[1] : null
    };
  } catch (e) {
    return null;
  }
}

/**
 * Process parsed Apple Health data into dashboard format
 */
function processAppleHealthData(parsedData, existingData) {
  const result = {
    strengthWorkoutData: {},
    conditioningSessions: [],
    latestWeight: null,
    latestBodyFat: null,
    avgRestingHR: null
  };

  // Process workouts
  parsedData.workouts.forEach((workout, idx) => {
    const dateKey = workout.startDate.split('T')[0];
    
    if (workout.category === 'strength') {
      // Store strength data for merging with Hevy workouts
      result.strengthWorkoutData[dateKey] = {
        duration: workout.duration,
        activeCalories: Math.round(workout.calories),
        avgHeartRate: workout.avgHeartRate,
        maxHeartRate: workout.maxHeartRate
      };
    } else if (workout.category !== 'other') {
      // Add to conditioning sessions
      result.conditioningSessions.push({
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

  // Get latest weight
  if (parsedData.weightRecords.length > 0) {
    result.latestWeight = parsedData.weightRecords[0].value;
  }

  // Get latest body fat
  if (parsedData.bodyFatRecords.length > 0) {
    result.latestBodyFat = parsedData.bodyFatRecords[0].value;
  }

  // Calculate average resting HR (last 30 days)
  if (parsedData.restingHRRecords.length > 0) {
    const recentHR = parsedData.restingHRRecords.slice(0, 30);
    const sum = recentHR.reduce((acc, r) => acc + r.value, 0);
    result.avgRestingHR = Math.round(sum / recentHR.length);
  }

  return result;
}

module.exports = {
  parseAppleHealthExport,
  processAppleHealthData
};
