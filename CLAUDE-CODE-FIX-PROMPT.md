## CLEANUP & FIX: Remove Shortcut Logic, Fix Achievement Merge Bug, Simplify Upload

### TASK 1: Remove Unnecessary Upload Buttons from Menu

Remove these buttons from the MoreMenu/upload options:
- "Test Shortcut Sync"
- "Hevy Workout (JSON/CSV)"  
- "Measurements (CSV)"

**Keep only:**
- "Apple Health (XML)" - main upload
- "Reset All Data" - for clearing

Find the menu component and remove the unwanted options:
```jsx
// In MoreMenu or wherever upload options are defined
// REMOVE these menu items:

// ❌ Remove: Test Shortcut Sync
// ❌ Remove: Hevy Workout JSON/CSV upload
// ❌ Remove: Measurements CSV upload

// ✅ Keep only:
const uploadOptions = [
  {
    id: 'apple-health',
    label: '🍎 Apple Health (XML)',
    accept: '.xml',
    endpoint: '/api/apple-health/upload',
  },
  {
    id: 'reset',
    label: '🗑️ Reset All Data',
    action: handleReset,
    isDestructive: true,
  },
];
```

---

### TASK 2: Fix Achievement Reset Bug - Merge Don't Overwrite

The Apple Health upload is overwriting Hevy workouts instead of merging. Fix in backend:
```javascript
// In backend/server.js - Apple Health upload endpoint
// Find the section that processes workouts

// WRONG - This overwrites:
// data.workouts = parsedWorkouts;

// CORRECT - Merge by checking for duplicates:
app.post('/api/apple-health/upload', upload.single('file'), async (req, res) => {
  try {
    // ... parsing logic ...
    
    // Read EXISTING data first
    const data = readData();
    
    // Keep ALL existing Hevy workouts (source: 'hevy' or has exercises array)
    const existingHevyWorkouts = (data.workouts || []).filter(w => 
      w.source === 'hevy' || 
      w.source === 'Hevy' || 
      (w.exercises && w.exercises.length > 0) ||
      w.id?.startsWith('hevy-')
    );
    
    console.log(`Preserving ${existingHevyWorkouts.length} Hevy workouts`);
    
    // Parse Apple Health workouts (strength training for HR/calories)
    const appleHealthWorkouts = parseAppleHealthWorkouts(xmlContent);
    
    // MERGE: Try to match Apple Health data to Hevy workouts by date
    const mergedWorkouts = existingHevyWorkouts.map(hevyWorkout => {
      const workoutDate = hevyWorkout.start_time?.split('T')[0];
      
      // Find matching Apple Health workout on same day
      const matchingApple = appleHealthWorkouts.find(aw => {
        const appleDate = aw.date?.split('T')[0];
        return appleDate === workoutDate && 
               (aw.type?.toLowerCase().includes('strength') || 
                aw.type?.toLowerCase().includes('training'));
      });
      
      if (matchingApple) {
        console.log(`Merged Apple Health data with Hevy workout on ${workoutDate}`);
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
    
    // Keep Apple Health workouts that DON'T match any Hevy workout (cardio, etc.)
    const unmatchedAppleWorkouts = appleHealthWorkouts.filter(aw => {
      const appleDate = aw.date?.split('T')[0];
      const hasMatch = existingHevyWorkouts.some(hw => 
        hw.start_time?.split('T')[0] === appleDate
      );
      return !hasMatch && !aw.type?.toLowerCase().includes('strength');
    });
    
    // Final workouts = merged Hevy + unmatched cardio from Apple Health
    data.workouts = mergedWorkouts;
    
    // Conditioning = Apple Health cardio workouts (walking, running, etc.)
    // MERGE with existing, don't overwrite
    const existingConditioning = data.conditioning || [];
    const newConditioning = unmatchedAppleWorkouts.map(w => ({
      id: `apple-${w.date}-${Math.random().toString(36).substr(2, 9)}`,
      type: w.type,
      category: w.category,
      date: w.date,
      duration: w.duration,
      activeCalories: w.activeCalories,
      avgHeartRate: w.avgHeartRate,
      maxHeartRate: w.maxHeartRate,
      distance: w.distance,
      steps: w.steps,
      source: 'Apple Health',
    }));
    
    // Merge conditioning - avoid duplicates by date+type
    newConditioning.forEach(nc => {
      const dateKey = nc.date?.split('T')[0];
      const exists = existingConditioning.some(ec => 
        ec.date?.split('T')[0] === dateKey && 
        ec.type === nc.type
      );
      if (!exists) {
        existingConditioning.push(nc);
      }
    });
    
    data.conditioning = existingConditioning.sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    );
    
    // Process measurements, sleep, etc. (these can overwrite as they're point-in-time)
    // ... rest of processing ...
    
    data.lastSync = new Date().toISOString();
    writeData(data);
    
    res.json({
      success: true,
      preserved: {
        hevyWorkouts: existingHevyWorkouts.length,
        mergedWithAppleHealth: mergedWorkouts.filter(w => w.appleHealth).length,
      },
      added: {
        conditioning: newConditioning.length,
      }
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

---

### TASK 3: Remove Shortcut-Related Backend Code (Optional Cleanup)

You can keep or remove the JSON endpoint. If removing:
```javascript
// In backend/server.js
// Comment out or remove:
// app.post('/api/apple-health/json', ...) 
```

---

### TASK 4: Replace Measurements Card with Health Score Card

Replace the Measurements card (Waist, Chest, Shoulders) with a more insightful **Health Score** card:
```jsx
// New HealthScoreCard component
const HealthScoreCard = ({ measurements, appleHealth, conditioning, workouts }) => {
  // Calculate component scores (0-100 each)
  
  // 1. Sleep Score
  const sleepAvg = appleHealth?.sleepAvg || 0;
  const sleepScore = sleepAvg >= 7 ? 100 : sleepAvg >= 6 ? 75 : sleepAvg >= 5 ? 50 : 25;
  
  // 2. Activity Score (based on recent workouts)
  const recentWorkouts = [...(workouts || []), ...(conditioning || [])]
    .filter(w => {
      const date = new Date(w.start_time || w.date);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return date >= weekAgo;
    }).length;
  const activityScore = Math.min(100, recentWorkouts * 20); // 5 workouts = 100
  
  // 3. Heart Health Score (resting HR)
  const restingHR = appleHealth?.restingHeartRate || 70;
  const hrScore = restingHR <= 55 ? 100 : restingHR <= 65 ? 85 : restingHR <= 75 ? 70 : 50;
  
  // 4. Consistency Score (workouts per week average)
  const totalWorkouts = (workouts?.length || 0) + (conditioning?.length || 0);
  const weeksTracked = Math.max(1, Math.ceil(totalWorkouts / 4)); // Rough estimate
  const avgPerWeek = totalWorkouts / weeksTracked;
  const consistencyScore = Math.min(100, avgPerWeek * 25); // 4/week = 100
  
  // Overall Health Score (weighted average)
  const overallScore = Math.round(
    (sleepScore * 0.25) +
    (activityScore * 0.30) +
    (hrScore * 0.20) +
    (consistencyScore * 0.25)
  );
  
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };
  
  const getScoreLabel = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Work';
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="w-4 h-4 text-green-400" />
          Health Score
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Overall Score */}
        <div className="text-center mb-4">
          <div className={`text-4xl font-bold ${getScoreColor(overallScore)}`}>
            {overallScore}
          </div>
          <div className={`text-sm ${getScoreColor(overallScore)}`}>
            {getScoreLabel(overallScore)}
          </div>
        </div>
        
        {/* Component Scores */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-400 flex items-center gap-2">
              <Moon className="w-3 h-3" /> Sleep
            </span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${sleepScore >= 70 ? 'bg-green-500' : 'bg-yellow-500'}`}
                  style={{ width: `${sleepScore}%` }}
                />
              </div>
              <span className="text-xs text-slate-500 w-8">{sleepScore}</span>
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-400 flex items-center gap-2">
              <Dumbbell className="w-3 h-3" /> Activity
            </span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${activityScore >= 70 ? 'bg-green-500' : 'bg-yellow-500'}`}
                  style={{ width: `${activityScore}%` }}
                />
              </div>
              <span className="text-xs text-slate-500 w-8">{activityScore}</span>
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-400 flex items-center gap-2">
              <Heart className="w-3 h-3" /> Heart
            </span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${hrScore >= 70 ? 'bg-green-500' : 'bg-yellow-500'}`}
                  style={{ width: `${hrScore}%` }}
                />
              </div>
              <span className="text-xs text-slate-500 w-8">{hrScore}</span>
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-400 flex items-center gap-2">
              <Target className="w-3 h-3" /> Consistency
            </span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${consistencyScore >= 70 ? 'bg-green-500' : 'bg-yellow-500'}`}
                  style={{ width: `${consistencyScore}%` }}
                />
              </div>
              <span className="text-xs text-slate-500 w-8">{consistencyScore}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
```

**Replace in the layout:**
```jsx
{/* OLD: */}
{/* <MeasurementsCard measurements={data.measurements} /> */}

{/* NEW: */}
<HealthScoreCard 
  measurements={data.measurements}
  appleHealth={data.appleHealth}
  conditioning={data.conditioning}
  workouts={data.workouts}
/>
```

---

### DEPLOYMENT
```bash
git add -A
git commit -m "Fix: Achievement merge bug, remove shortcut buttons, replace measurements with health score"
git push origin main

ssh pi@192.168.1.73 "cd ~/hit-tracker-pro && git pull && docker compose down && docker compose up -d --build"
```

### VERIFICATION

After deployment:
1. [ ] Upload Apple Health XML
2. [ ] Check achievements - should KEEP existing + add new (not reset)
3. [ ] Menu only shows "Apple Health (XML)" and "Reset"
4. [ ] Health Score card shows instead of Measurements
5. [ ] Hevy workouts preserved after XML upload