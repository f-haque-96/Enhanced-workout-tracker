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
      dietaryCalorieRecords: [],
      waistRecords: [],
      stats: {
        linesProcessed: 0,
        workoutsFound: 0,
        weightRecordsFound: 0,
        bodyFatRecordsFound: 0,
        restingHRRecordsFound: 0,
        leanMassRecordsFound: 0,
        dietaryCaloriesFound: 0,
        waistRecordsFound: 0
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
        if (line.includes('</Workout>')) {
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

      // ==========================================
      // DIETARY ENERGY CONSUMED (single line)
      // ==========================================
      if (line.includes('HKQuantityTypeIdentifierDietaryEnergyConsumed') && line.includes('value=')) {
        const record = parseHealthRecord(line, 'dietaryCalories');
        if (record) {
          results.dietaryCalorieRecords.push(record);
          results.stats.dietaryCaloriesFound++;
        }
      }

      // ==========================================
      // WAIST CIRCUMFERENCE (single line)
      // ==========================================
      if (line.includes('HKQuantityTypeIdentifierWaistCircumference') && line.includes('value=')) {
        const record = parseHealthRecord(line, 'waist');
        if (record) {
          results.waistRecords.push(record);
          results.stats.waistRecordsFound++;
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
      results.dietaryCalorieRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
      results.waistRecords.sort((a, b) => new Date(b.date) - new Date(a.date));

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

    // Extract calories - try multiple patterns
    let calories = caloriesMatch ? parseFloat(caloriesMatch[1]) : 0;

    // Try WorkoutStatistics with sum attribute
    if (calories === 0) {
      const statsCaloriesMatch = xml.match(/HKQuantityTypeIdentifierActiveEnergyBurned[^>]*sum="([^"]+)"/);
      if (statsCaloriesMatch) {
        calories = parseFloat(statsCaloriesMatch[1]);
      }
    }

    // Try WorkoutStatistics with quantity attribute
    if (calories === 0) {
      const quantityCaloriesMatch = xml.match(/HKQuantityTypeIdentifierActiveEnergyBurned[^>]*quantity="([^"]+)"/);
      if (quantityCaloriesMatch) {
        calories = parseFloat(quantityCaloriesMatch[1]);
      }
    }

    // Try metadata value
    if (calories === 0) {
      const metaCaloriesMatch = xml.match(/HKActiveEnergyBurned[^>]*value="([^"]+)"/);
      if (metaCaloriesMatch) {
        calories = parseFloat(metaCaloriesMatch[1]);
      }
    }

    // Extract heart rate - try multiple sources with comprehensive patterns
    let avgHeartRate = null;
    let maxHeartRate = null;

    // Pattern 1: HeartRateStatistics element
    const hrStatsAvgMatch = xml.match(/HeartRateStatistics[^>]*average="([^"]+)"/);
    const hrStatsMaxMatch = xml.match(/HeartRateStatistics[^>]*maximum="([^"]+)"/);
    if (hrStatsAvgMatch) avgHeartRate = Math.round(parseFloat(hrStatsAvgMatch[1]));
    if (hrStatsMaxMatch) maxHeartRate = Math.round(parseFloat(hrStatsMaxMatch[1]));

    // Pattern 2: WorkoutStatistics with average/maximum attributes
    if (!avgHeartRate) {
      const statsAvgHRMatch = xml.match(/HKQuantityTypeIdentifierHeartRate[^>]*average="([^"]+)"/);
      if (statsAvgHRMatch) {
        avgHeartRate = Math.round(parseFloat(statsAvgHRMatch[1]));
      }
    }
    if (!maxHeartRate) {
      const statsMaxHRMatch = xml.match(/HKQuantityTypeIdentifierHeartRate[^>]*maximum="([^"]+)"/);
      if (statsMaxHRMatch) maxHeartRate = Math.round(parseFloat(statsMaxHRMatch[1]));
    }

    // Pattern 3: Metadata elements
    if (!avgHeartRate) {
      const metaAvgHRMatch = xml.match(/HKAverageHeartRate[^>]*value="([^"]+)"/);
      if (metaAvgHRMatch) avgHeartRate = Math.round(parseFloat(metaAvgHRMatch[1]));
    }
    if (!maxHeartRate) {
      const metaMaxHRMatch = xml.match(/HKMaximumHeartRate[^>]*value="([^"]+)"/);
      if (metaMaxHRMatch) maxHeartRate = Math.round(parseFloat(metaMaxHRMatch[1]));
    }

    // Pattern 4: WorkoutEvent with heart rate data
    if (!avgHeartRate) {
      const eventAvgMatch = xml.match(/HeartRate[^>]*average[^>]*value="([^"]+)"/);
      if (eventAvgMatch) avgHeartRate = Math.round(parseFloat(eventAvgMatch[1]));
    }
    if (!maxHeartRate) {
      const eventMaxMatch = xml.match(/HeartRate[^>]*max[^>]*value="([^"]+)"/);
      if (eventMaxMatch) maxHeartRate = Math.round(parseFloat(eventMaxMatch[1]));
    }

    // Extract distance from WorkoutStatistics if not in main attributes
    let distance = distanceMatch ? parseFloat(distanceMatch[1]) : 0;
    if (distance === 0) {
      // Try DistanceWalkingRunning from WorkoutStatistics
      const distStatsMatch = xml.match(/HKQuantityTypeIdentifierDistanceWalkingRunning[^>]*sum="([^"]+)"/);
      if (distStatsMatch) {
        const distValue = parseFloat(distStatsMatch[1]);
        const unitMatch = xml.match(/HKQuantityTypeIdentifierDistanceWalkingRunning[^>]*unit="([^"]+)"/);
        const unit = unitMatch ? unitMatch[1] : 'mi';

        // Convert to meters
        if (unit === 'mi') {
          distance = distValue * 1609.34; // miles to meters
        } else if (unit === 'km') {
          distance = distValue * 1000; // km to meters
        } else {
          distance = distValue; // assume already in meters
        }
      }
    }

    return {
      type: workoutType,
      category,
      displayType,
      startDate: startMatch[1],
      endDate: endMatch ? endMatch[1] : null,
      duration: durationMatch ? parseFloat(durationMatch[1]) * 60 : 0, // Convert to seconds
      calories,
      distance,
      avgHeartRate,
      maxHeartRate
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
    const unit = unitMatch ? unitMatch[1] : null;

    // Convert body fat from decimal to percentage if needed
    if (type === 'bodyFat' && value < 1) {
      value = value * 100;
    }

    // Convert waist from cm to inches (Apple Health stores in cm)
    if (type === 'waist' && unit === 'cm') {
      value = value / 2.54; // cm to inches
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
    avgRestingHR: null,
    dailyCalorieIntake: {},
    weightHistory: []
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

  // Get latest waist circumference (converted from cm to inches)
  if (parsedData.waistRecords.length > 0) {
    result.latestWaist = parsedData.waistRecords[0].value;
  }

  // Calculate average resting HR (last 30 days)
  if (parsedData.restingHRRecords.length > 0) {
    const recentHR = parsedData.restingHRRecords.slice(0, 30);
    const sum = recentHR.reduce((acc, r) => acc + r.value, 0);
    result.avgRestingHR = Math.round(sum / recentHR.length);
  }

  // Process dietary calorie intake (aggregate by day)
  if (parsedData.dietaryCalorieRecords && parsedData.dietaryCalorieRecords.length > 0) {
    parsedData.dietaryCalorieRecords.forEach(record => {
      const dateKey = record.date.split('T')[0].split(' ')[0];
      if (!result.dailyCalorieIntake[dateKey]) {
        result.dailyCalorieIntake[dateKey] = 0;
      }
      result.dailyCalorieIntake[dateKey] += record.value;
    });
  }

  // Process weight history (last 90 days for trend graph)
  if (parsedData.weightRecords && parsedData.weightRecords.length > 0) {
    const last90Days = parsedData.weightRecords.slice(0, 90);
    result.weightHistory = last90Days.map(record => ({
      date: record.date.split('T')[0].split(' ')[0],
      weight: record.value
    }));
  }

  return result;
}

module.exports = {
  parseAppleHealthExport,
  processAppleHealthData
};
