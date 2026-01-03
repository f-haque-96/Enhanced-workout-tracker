## FIX: Calories Burned, Keep Body Stats, Fix Achievement Merge, Fix Conditioning Loss

### CRITICAL BUG 1: Conditioning Data Lost During Normalization

The console shows:
- "⚠️ NO CONDITIONING DATA IN API RESPONSE!"
- "❌ CONDITIONING DATA LOST DURING NORMALIZATION!"

Find and fix the normalizeApiData function:
```jsx
// In src/App.jsx, find normalizeApiData and fix it:

const normalizeApiData = (raw) => {
  if (!raw) {
    console.error('normalizeApiData: received null/undefined');
    return null;
  }
  
  // Debug: Log what we received
  console.log('📥 Raw API data:', {
    workouts: raw.workouts?.length || 0,
    conditioning: raw.conditioning?.length || 0,
    measurements: !!raw.measurements,
    appleHealth: !!raw.appleHealth,
  });
  
  // CRITICAL: Preserve conditioning data - don't transform it away!
  let normalizedConditioning = [];
  
  if (raw.conditioning && Array.isArray(raw.conditioning)) {
    normalizedConditioning = raw.conditioning.map(session => {
      if (!session) return null;
      return {
        ...session,
        date: session.date || session.startDate || session.Start_Date,
        activeCalories: session.activeCalories ?? session.calories ?? session.Calories ?? 0,
        avgHeartRate: session.avgHeartRate ?? session.averageHeartRate ?? session.hr_avg ?? 0,
        maxHeartRate: session.maxHeartRate ?? session.maximumHeartRate ?? session.hr_max ?? 0,
        duration: session.duration ?? session.Duration ?? 0,
        distance: session.distance ?? session.Distance ?? 0,
        steps: session.steps ?? session.Steps ?? 0,
        type: session.type ?? session.Type ?? 'Workout',
        category: session.category ?? 'other',
      };
    }).filter(Boolean);
    
    console.log('✅ Normalized conditioning:', normalizedConditioning.length);
  } else {
    console.warn('⚠️ No conditioning array in raw data');
  }
  
  // Normalize workouts
  let normalizedWorkouts = [];
  if (raw.workouts && Array.isArray(raw.workouts)) {
    normalizedWorkouts = raw.workouts.map(w => ({
      ...w,
      // Preserve all existing data
    })).filter(Boolean);
  }
  
  const result = {
    workouts: normalizedWorkouts,
    conditioning: normalizedConditioning,
    measurements: raw.measurements || { current: {}, starting: {}, history: [] },
    appleHealth: raw.appleHealth || {},
    nutrition: raw.nutrition || { dailyCalorieIntake: {} },
    lastSync: raw.lastSync,
    lastWebhook: raw.lastWebhook,
  };
  
  // VERIFY conditioning wasn't lost
  if (raw.conditioning?.length > 0 && result.conditioning.length === 0) {
    console.error('❌ CONDITIONING WAS LOST! Using raw data as fallback');
    result.conditioning = raw.conditioning;
  }
  
  console.log('📤 Normalized result:', {
    workouts: result.workouts.length,
    conditioning: result.conditioning.length,
  });
  
  return result;
};
```

**Also check if there's a separate normalizeConditioning function that's breaking things:**
```bash
grep -n "normalizeConditioning\|conditioning.*filter\|conditioning.*map" src/App.jsx
```

If found, ensure it doesn't filter out valid data.

---

### CRITICAL BUG 2: Achievements Disappear After Apple Health Import

The backend is overwriting workouts instead of merging. Fix in `backend/server.js`:
```javascript
// In the Apple Health upload endpoint, BEFORE processing workouts:

app.post('/api/apple-health/upload', upload.single('file'), async (req, res) => {
  try {
    // ... file handling ...
    
    // Read EXISTING data FIRST
    const data = readData();
    
    // PRESERVE all existing Hevy workouts - these contain the exercises for achievements!
    const existingHevyWorkouts = (data.workouts || []).filter(w => {
      // Keep if it has exercises (definitely from Hevy)
      if (w.exercises && w.exercises.length > 0) return true;
      // Keep if source is Hevy
      if (w.source === 'hevy' || w.source === 'Hevy') return true;
      // Keep if it has Hevy-specific fields
      if (w.id && !w.id.startsWith('apple-')) return true;
      return false;
    });
    
    console.log(`🏋️ Preserving ${existingHevyWorkouts.length} Hevy workouts with exercises`);
    
    // Also preserve existing conditioning
    const existingConditioning = data.conditioning || [];
    console.log(`🏃 Preserving ${existingConditioning.length} existing conditioning sessions`);
    
    // Parse XML...
    const parsed = await parseAppleHealthXMLStreaming(filePath);
    
    // ... process measurements, sleep, etc ...
    
    // MERGE workouts - don't replace!
    if (parsed.workouts && parsed.workouts.length > 0) {
      // Separate Apple Health strength workouts from cardio
      const appleStrength = parsed.workouts.filter(w => 
        w.category === 'strength' || 
        w.type?.toLowerCase().includes('strength') ||
        w.type?.toLowerCase().includes('training')
      );
      const appleCardio = parsed.workouts.filter(w => 
        w.category !== 'strength' && 
        !w.type?.toLowerCase().includes('strength') &&
        !w.type?.toLowerCase().includes('training')
      );
      
      console.log(`📊 Apple Health: ${appleStrength.length} strength, ${appleCardio.length} cardio`);
      
      // Merge Apple Health HR/calories INTO existing Hevy workouts (by date)
      const mergedWorkouts = existingHevyWorkouts.map(hevyWorkout => {
        const hevyDate = (hevyWorkout.start_time || hevyWorkout.date)?.split('T')[0];
        
        // Find Apple Health strength workout on same day
        const matchingApple = appleStrength.find(aw => {
          const appleDate = aw.date?.split('T')[0];
          return appleDate === hevyDate;
        });
        
        if (matchingApple) {
          console.log(`✅ Merged Apple Health data with Hevy workout on ${hevyDate}`);
          return {
            ...hevyWorkout, // KEEP all Hevy data including exercises!
            appleHealth: {
              duration: matchingApple.duration,
              activeCalories: matchingApple.activeCalories,
              avgHeartRate: matchingApple.avgHeartRate,
              maxHeartRate: matchingApple.maxHeartRate,
            }
          };
        }
        
        return hevyWorkout; // Return unchanged if no match
      });
      
      // Set workouts to merged data - PRESERVES Hevy exercises!
      data.workouts = mergedWorkouts;
      
      // Add Apple Health cardio to conditioning (avoid duplicates)
      appleCardio.forEach(cardio => {
        const cardioDate = cardio.date?.split('T')[0];
        const isDuplicate = existingConditioning.some(ec => 
          ec.date?.split('T')[0] === cardioDate && 
          ec.type === cardio.type
        );
        
        if (!isDuplicate) {
          existingConditioning.push({
            id: `apple-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ...cardio,
            source: 'Apple Health',
          });
        }
      });
      
      data.conditioning = existingConditioning.sort((a, b) => 
        new Date(b.date) - new Date(a.date)
      );
    } else {
      // No workouts in XML - KEEP existing data unchanged!
      data.workouts = existingHevyWorkouts;
      data.conditioning = existingConditioning;
    }
    
    console.log(`📦 Final: ${data.workouts.length} workouts, ${data.conditioning.length} conditioning`);
    
    // ... save and respond ...
  }
});
```

---

### TASK 3: Add Calories Burned to XML Parser

In `backend/streaming-xml-parser.js`, ensure Active Energy (calories burned) is being captured:
```javascript
// This should already exist, but verify:
// Active Energy Burned (calories burned from exercise + daily activity)
else if (line.includes('HKQuantityTypeIdentifierActiveEnergyBurned') && line.includes('Record')) {
  const record = parseRecordLine(line);
  if (record && record.value > 0) {
    results.activeEnergy.push(record);
    results.stats.recordsFound++;
  }
}

// Also capture Basal Energy Burned (BMR - resting calories)
else if (line.includes('HKQuantityTypeIdentifierBasalEnergyBurned') && line.includes('Record')) {
  const record = parseRecordLine(line);
  if (record && record.value > 0) {
    results.basalEnergy = results.basalEnergy || [];
    results.basalEnergy.push(record);
    results.stats.recordsFound++;
  }
}
```

**Then in the upload endpoint, process and store daily calories burned:**
```javascript
// Process Active Energy (calories burned) - aggregate by day
if (parsed.activeEnergy && parsed.activeEnergy.length > 0) {
  const caloriesByDay = {};
  parsed.activeEnergy.forEach(c => {
    const dateKey = new Date(c.date).toISOString().split('T')[0];
    caloriesByDay[dateKey] = (caloriesByDay[dateKey] || 0) + c.value;
  });
  
  data.appleHealth = data.appleHealth || {};
  data.appleHealth.dailyActiveCalories = caloriesByDay;
  
  // Calculate 7-day average
  const last7Days = Object.entries(caloriesByDay)
    .sort((a, b) => new Date(b[0]) - new Date(a[0]))
    .slice(0, 7);
  
  if (last7Days.length > 0) {
    data.appleHealth.avgActiveCalories = Math.round(
      last7Days.reduce((sum, [_, cal]) => sum + cal, 0) / last7Days.length
    );
  }
  
  console.log(`🔥 Processed ${Object.keys(caloriesByDay).length} days of active calories`);
}
```

---

### TASK 4: Update Health Score Card to Include Body Stats

Rename to "Health Score & Body Stats" and keep Weight, Weight Trend, BMI, Body Fat:
```jsx
const HealthScoreBodyStatsCard = ({ measurements, appleHealth, conditioning, workouts }) => {
  const current = measurements?.current || {};
  const history = measurements?.history || [];
  
  const weight = current.weight || 0;
  const bodyFat = current.bodyFat || 0;
  const leanMass = current.leanMass || 0;
  const heightM = 1.75; // TODO: Make configurable
  const bmi = weight > 0 ? (weight / (heightM * heightM)) : 0;
  
  // Calculate Health Score components (0-100 each)
  const sleepAvg = appleHealth?.sleepAvg || 0;
  const sleepScore = sleepAvg >= 7 ? 100 : sleepAvg >= 6 ? 75 : sleepAvg >= 5 ? 50 : 25;
  
  const recentWorkouts = [...(workouts || []), ...(conditioning || [])]
    .filter(w => {
      const date = new Date(w.start_time || w.date);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return date >= weekAgo;
    }).length;
  const activityScore = Math.min(100, recentWorkouts * 20);
  
  const restingHR = appleHealth?.restingHeartRate || 70;
  const hrScore = restingHR <= 55 ? 100 : restingHR <= 65 ? 85 : restingHR <= 75 ? 70 : 50;
  
  // Overall Health Score (no decimals)
  const overallScore = Math.round(
    (sleepScore * 0.35) +
    (activityScore * 0.35) +
    (hrScore * 0.30)
  );
  
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };
  
  const getBmiCategory = (bmi) => {
    if (!bmi) return { label: 'No data', color: 'text-slate-400' };
    if (bmi < 18.5) return { label: 'Underweight', color: 'text-blue-400' };
    if (bmi < 25) return { label: 'Normal', color: 'text-green-400' };
    if (bmi < 30) return { label: 'Overweight', color: 'text-yellow-400' };
    return { label: 'Obese', color: 'text-red-400' };
  };
  
  const bmiInfo = getBmiCategory(bmi);
  
  // Weight trend calculation
  const weightData = (history || [])
    .filter(h => h.weight && h.weight >= 40 && h.weight <= 200)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-30);
  
  const hasWeightTrend = weightData.length >= 2;
  const firstWeight = hasWeightTrend ? weightData[0].weight : 0;
  const lastWeight = hasWeightTrend ? weightData[weightData.length - 1].weight : weight;
  const weightChange = hasWeightTrend ? lastWeight - firstWeight : 0;
  
  // Sparkline
  const weights = weightData.map(d => d.weight);
  const minWeight = weights.length > 0 ? Math.min(...weights) : 0;
  const maxWeight = weights.length > 0 ? Math.max(...weights) : 0;
  const range = maxWeight - minWeight || 1;
  
  const sparklineWidth = 200;
  const sparklineHeight = 40;
  const padding = 4;
  
  const points = weights.map((w, i) => {
    const x = padding + (i / (weights.length - 1 || 1)) * (sparklineWidth - padding * 2);
    const y = sparklineHeight - padding - ((w - minWeight) / range) * (sparklineHeight - padding * 2);
    return `${x},${y}`;
  });
  
  const pathD = points.length > 1 ? `M ${points.join(' L ')}` : '';
  const trendColor = weightChange <= 0 ? '#22c55e' : '#ef4444'; // Green if losing (cutting)
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="w-4 h-4 text-green-400" />
          Health Score & Body Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Health Score - No Decimals */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 mb-1">Health Score</div>
            <div className={`text-3xl font-bold ${getScoreColor(overallScore)}`}>
              {overallScore}
            </div>
          </div>
          <div className="flex gap-2">
            <div className="text-center px-3 py-1 bg-slate-800/50 rounded-lg">
              <div className="text-[10px] text-slate-500">Sleep</div>
              <div className="text-sm font-medium">{sleepScore}</div>
            </div>
            <div className="text-center px-3 py-1 bg-slate-800/50 rounded-lg">
              <div className="text-[10px] text-slate-500">Activity</div>
              <div className="text-sm font-medium">{activityScore}</div>
            </div>
            <div className="text-center px-3 py-1 bg-slate-800/50 rounded-lg">
              <div className="text-[10px] text-slate-500">Heart</div>
              <div className="text-sm font-medium">{hrScore}</div>
            </div>
          </div>
        </div>
        
        <div className="border-t border-slate-700/50 pt-4"></div>
        
        {/* Weight + Lean Mass Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl p-3 border border-blue-500/20">
            <div className="text-xs text-blue-300">Weight</div>
            <div className="text-2xl font-bold">{weight}<span className="text-sm text-slate-400 ml-1">kg</span></div>
          </div>
          <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 rounded-xl p-3 border border-cyan-500/20">
            <div className="text-xs text-cyan-300">Lean Mass</div>
            <div className="text-2xl font-bold">
              {leanMass > 0 ? leanMass.toFixed(1) : '--'}
              <span className="text-sm text-slate-400 ml-1">kg</span>
            </div>
          </div>
        </div>
        
        {/* BMI + Body Fat Row */}
        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-xl p-3 border border-purple-500/20">
          <div className="flex justify-between">
            <div>
              <div className="text-xs text-purple-300">BMI</div>
              <div className="text-xl font-bold">{bmi > 0 ? bmi.toFixed(1) : '--'}</div>
              <div className={`text-xs ${bmiInfo.color}`}>{bmiInfo.label}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-purple-300">Body Fat</div>
              <div className="text-xl font-bold">{bodyFat > 0 ? bodyFat.toFixed(1) : '--'}<span className="text-sm">%</span></div>
            </div>
          </div>
        </div>
        
        {/* Weight Trend Graph */}
        {hasWeightTrend && (
          <div className={`rounded-xl p-3 border ${weightChange <= 0 ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
            <div className="flex justify-between items-center mb-2">
              <div className="text-xs text-slate-400">Weight Trend (30d)</div>
              <div className={`text-sm font-medium ${weightChange <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)} kg
              </div>
            </div>
            <svg width={sparklineWidth} height={sparklineHeight} className="w-full">
              <line x1={padding} y1={sparklineHeight/2} x2={sparklineWidth-padding} y2={sparklineHeight/2} stroke="#334155" strokeWidth="1" strokeDasharray="4"/>
              {pathD && (
                <>
                  <path d={pathD} fill="none" stroke={trendColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle 
                    cx={parseFloat(points[points.length-1]?.split(',')[0]) || 0} 
                    cy={parseFloat(points[points.length-1]?.split(',')[1]) || 0} 
                    r="3" 
                    fill={trendColor}
                  />
                </>
              )}
            </svg>
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>{firstWeight.toFixed(1)} kg</span>
              <span>{lastWeight.toFixed(1)} kg</span>
            </div>
          </div>
        )}
        
      </CardContent>
    </Card>
  );
};
```

---

### TASK 5: Simplify Recovery & Sleep Card

Remove "Last Night", "Sleep Quality", "Consistency" - keep only essential info:
```jsx
const RecoverySleepCard = ({ restDays, sleepData, recovery }) => {
  const avgSleep = sleepData?.avgHours || 0;
  
  // Determine card color based on recovery status
  const getCardStyle = () => {
    if (recovery.score >= 75) {
      return {
        bg: 'from-green-500/20 to-green-600/10',
        border: 'border-green-500/30',
        accent: 'text-green-400',
        icon: '💪',
        message: 'Ready for intense workout!',
      };
    } else if (recovery.score >= 50) {
      return {
        bg: 'from-amber-500/20 to-amber-600/10',
        border: 'border-amber-500/30',
        accent: 'text-amber-400',
        icon: '⚡',
        message: 'Light workout or cardio recommended',
      };
    } else {
      return {
        bg: 'from-red-500/20 to-red-600/10',
        border: 'border-red-500/30',
        accent: 'text-red-400',
        icon: '😴',
        message: 'Rest day recommended',
      };
    }
  };
  
  const style = getCardStyle();
  
  return (
    <div className={`bg-gradient-to-br ${style.bg} rounded-xl p-4 border ${style.border}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Moon className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-medium text-slate-200">Recovery & Sleep</span>
        </div>
        <div className="text-xl">{style.icon}</div>
      </div>
      
      {/* Main Stats - SIMPLIFIED */}
      <div className="grid grid-cols-3 gap-4 mb-3">
        <div className="text-center">
          <div className={`text-2xl font-bold ${style.accent}`}>{recovery.score}%</div>
          <div className="text-xs text-slate-400">Recovery</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-200">{restDays}</div>
          <div className="text-xs text-slate-400">Rest Days</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-indigo-400">{avgSleep.toFixed(1)}<span className="text-sm">h</span></div>
          <div className="text-xs text-slate-400">Avg Sleep</div>
        </div>
      </div>
      
      {/* Status Message */}
      <div className={`text-center text-sm ${style.accent} font-medium py-2 bg-slate-900/30 rounded-lg`}>
        {style.message}
      </div>
    </div>
  );
};
```

---

### DEPLOYMENT
```bash
git add -A
git commit -m "Fix: Achievement merge, conditioning loss, add calories burned, keep body stats, simplify recovery card"
git push origin main

ssh pi@192.168.1.73 "cd ~/hit-tracker-pro && git pull && docker compose down && docker compose up -d --build"
```

### VERIFICATION

After deployment:
1. [ ] Upload Apple Health XML
2. [ ] Check console - NO "conditioning lost" errors
3. [ ] Achievements should KEEP existing (not reset to 0)
4. [ ] Health Score card shows: Score (no decimals), Weight, Lean Mass, BMI, Body Fat, Weight Trend
5. [ ] Recovery & Sleep card shows ONLY: Recovery %, Rest Days, Avg Sleep, Status Message
6. [ ] Cardio tab shows conditioning sessions
7. [ ] Calorie Balance shows "Burned (exercise)" with actual data