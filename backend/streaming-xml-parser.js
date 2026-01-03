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

      // Active Energy Burned (calories burned from exercise + daily activity)
      else if (line.includes('HKQuantityTypeIdentifierActiveEnergyBurned') && line.includes('Record')) {
        const record = parseRecordLine(line);
        if (record && record.value > 0) {
          results.activeEnergy.push(record);
          results.stats.recordsFound++;
        }
      }

      // Basal Energy Burned (BMR - resting calories)
      else if (line.includes('HKQuantityTypeIdentifierBasalEnergyBurned') && line.includes('Record')) {
        const record = parseRecordLine(line);
        if (record && record.value > 0) {
          results.basalEnergy = results.basalEnergy || [];
          results.basalEnergy.push(record);
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
