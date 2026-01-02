## FIX: Multiple Issues - Weight Trend, Calorie Balance, Calisthenics Tab, API Endpoint

### ISSUE 1: Weight Trend Math is Wrong

The weight trend shows:
- Left: 83.0 kg
- Right: 86.6 kg  
- Display: +0.8 kg

This is WRONG. 86.6 - 83.0 = 3.6 kg, not 0.8 kg.

**Find and fix the WeightTrendSection calculation:**
```jsx
const WeightTrendSection = ({ history }) => {
  // Filter to valid weights only (40-200 kg range)
  const weightData = (history || [])
    .filter(h => h.weight && h.weight >= 40 && h.weight <= 200)
    .sort((a, b) => new Date(a.date) - new Date(b.date)) // Sort OLDEST first
    .slice(-30); // Get last 30 entries
  
  if (weightData.length < 2) return null;
  
  const weights = weightData.map(d => d.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  
  // CORRECT CALCULATION:
  // First weight = oldest (leftmost on graph)
  // Last weight = newest (rightmost on graph)
  const firstWeight = weights[0]; // Oldest
  const lastWeight = weights[weights.length - 1]; // Newest (current)
  const change = lastWeight - firstWeight; // Positive = gained, Negative = lost
  
  console.log('Weight Trend Debug:', {
    firstWeight,
    lastWeight,
    change,
    min,
    max,
    dataPoints: weights.length
  });
  
  // For cutting: weight loss (negative change) is good (green)
  // For bulking: weight gain (positive change) is good (green)
  // Default assumption: user is cutting, so loss = green
  const isGoodTrend = change <= 0; // Losing weight = good for cutting
  const trendColor = isGoodTrend ? 'green' : 'red';
  const borderColor = isGoodTrend ? 'border-green-500/30' : 'border-red-500/30';
  const bgColor = isGoodTrend ? 'from-green-500/10 to-green-600/5' : 'from-red-500/10 to-red-600/5';
  const lineColor = isGoodTrend ? '#22c55e' : '#ef4444';
  
  // SVG sparkline
  const width = 280;
  const height = 50;
  const padding = 8;
  const range = max - min || 1;
  
  const points = weights.map((w, i) => {
    const x = padding + (i / (weights.length - 1)) * (width - padding * 2);
    const y = height - padding - ((w - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });
  
  const pathD = `M ${points.join(' L ')}`;
  
  return (
    <div className={`bg-gradient-to-br ${bgColor} rounded-xl p-4 border ${borderColor}`}>
      <div className="flex justify-between items-center mb-2">
        <div className="text-xs text-slate-400">Weight Trend (30d)</div>
        <div className={`text-sm font-medium ${isGoodTrend ? 'text-green-400' : 'text-red-400'}`}>
          {change > 0 ? '+' : ''}{change.toFixed(1)} kg
        </div>
      </div>
      <svg width={width} height={height} className="w-full">
        <line x1={padding} y1={height/2} x2={width-padding} y2={height/2} stroke="#334155" strokeWidth="1" strokeDasharray="4"/>
        <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle 
          cx={parseFloat(points[points.length-1]?.split(',')[0]) || 0} 
          cy={parseFloat(points[points.length-1]?.split(',')[1]) || 0} 
          r="4" 
          fill={lineColor}
        />
      </svg>
      <div className="flex justify-between text-[10px] text-slate-500 mt-1">
        <span>{firstWeight.toFixed(1)} kg</span>
        <span>{lastWeight.toFixed(1)} kg</span>
      </div>
    </div>
  );
};
```

**Key fixes:**
1. Sort by date OLDEST first (so graph goes left→right chronologically)
2. Calculate change as `lastWeight - firstWeight` (newest - oldest)
3. Display first/last weights at bottom (not min/max)

---

### ISSUE 2: Calorie Balance - Add Daily Breakdown

Update CalorieInsight to show daily calories:
```jsx
const CalorieInsight = ({ nutrition, conditioning, workouts, dateRange }) => {
  const dailyIntake = nutrition?.dailyCalorieIntake || {};
  
  const now = new Date();
  const daysMap = { '7D': 7, '30D': 30, '90D': 90, '1Y': 365, 'All': 9999 };
  const daysBack = daysMap[dateRange] || 7;
  const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  
  // Get daily entries within date range
  const dailyEntries = Object.entries(dailyIntake)
    .filter(([date]) => new Date(date) >= startDate)
    .sort((a, b) => new Date(b[0]) - new Date(a[0])) // Newest first
    .slice(0, 7); // Show last 7 days max
  
  const consumedCalories = dailyEntries.reduce((sum, [_, cal]) => sum + (cal || 0), 0);
  
  // Calculate burned calories
  const workoutCalories = (workouts || [])
    .filter(w => new Date(w.start_time) >= startDate)
    .reduce((sum, w) => sum + (w.appleHealth?.activeCalories || 0), 0);
  
  const conditioningCalories = (conditioning || [])
    .filter(c => new Date(c.date) >= startDate)
    .reduce((sum, c) => sum + (c.activeCalories || c.calories || 0), 0);
  
  const burnedCalories = workoutCalories + conditioningCalories;
  
  const balance = consumedCalories - burnedCalories;
  const avgDailyIntake = dailyEntries.length > 0 
    ? Math.round(consumedCalories / dailyEntries.length) 
    : 0;
  const avgDailyBurn = Math.round(burnedCalories / daysBack);
  
  // Weekly weight change estimate (7700 cal = 1kg)
  const weeklyWeightChange = (balance / dailyEntries.length * 7) / 7700;
  
  // Goal status based on balance
  const getGoalStatus = () => {
    const dailyBalance = balance / (dailyEntries.length || 1);
    if (dailyBalance < -300) return { label: 'Cutting', color: 'text-red-400', icon: '🔥' };
    if (dailyBalance > 300) return { label: 'Bulking', color: 'text-green-400', icon: '💪' };
    return { label: 'Maintaining', color: 'text-blue-400', icon: '⚖️' };
  };
  
  const goal = getGoalStatus();
  
  if (consumedCalories === 0 && burnedCalories === 0) return null;
  
  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 mt-4">
      <div className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
        <Flame className="w-4 h-4 text-orange-400" />
        Calorie Balance ({daysBack}d)
      </div>
      
      <div className="space-y-2 text-sm">
        {consumedCalories > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-400">Consumed</span>
            <span className="text-green-400">{Math.round(consumedCalories).toLocaleString()} kcal</span>
          </div>
        )}
        
        {avgDailyIntake > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Daily Avg</span>
            <span className="text-slate-400">{avgDailyIntake.toLocaleString()} kcal/day</span>
          </div>
        )}
        
        <div className="flex justify-between">
          <span className="text-slate-400">Burned (exercise)</span>
          <span className="text-red-400">{Math.round(burnedCalories).toLocaleString()} kcal</span>
        </div>
        
        {consumedCalories > 0 && (
          <>
            <div className="border-t border-slate-700 my-2"></div>
            
            <div className="flex justify-between font-medium">
              <span className="text-slate-300">Net Balance</span>
              <span className={balance < 0 ? 'text-red-400' : 'text-green-400'}>
                {balance > 0 ? '+' : ''}{Math.round(balance).toLocaleString()} kcal
              </span>
            </div>
            
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Est. weekly change</span>
              <span className={weeklyWeightChange < 0 ? 'text-red-400' : 'text-green-400'}>
                {weeklyWeightChange > 0 ? '+' : ''}{weeklyWeightChange.toFixed(2)} kg/week
              </span>
            </div>
            
            <div className="mt-3 flex items-center justify-center gap-2 py-2 bg-slate-900/50 rounded-lg">
              <span className="text-lg">{goal.icon}</span>
              <span className={`font-medium ${goal.color}`}>{goal.label}</span>
            </div>
          </>
        )}
      </div>
      
      {/* Daily Breakdown - Last 7 days */}
      {dailyEntries.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-700">
          <div className="text-xs text-slate-500 mb-2">Daily Intake (Last {dailyEntries.length} days)</div>
          <div className="space-y-1">
            {dailyEntries.slice(0, 5).map(([date, calories]) => (
              <div key={date} className="flex justify-between text-xs">
                <span className="text-slate-500">
                  {new Date(date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                <span className="text-slate-300">{Math.round(calories).toLocaleString()} kcal</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
```

---

### ISSUE 3: Add Calisthenics Tab

Add a new tab for bodyweight/calisthenics workouts:
```jsx
// 1. Update tab options
const TABS = [
  { id: 'push', label: 'Push', icon: Dumbbell, color: 'orange' },
  { id: 'pull', label: 'Pull', icon: ArrowUpRight, color: 'blue' },
  { id: 'legs', label: 'Legs', icon: ArrowDownUp, color: 'purple' },
  { id: 'calisthenics', label: 'Cali', icon: PersonStanding, color: 'cyan' }, // NEW
  { id: 'cardio', label: 'Cardio', icon: Heart, color: 'green' },
];

// 2. Import PersonStanding icon (or use User icon)
import { User as PersonStanding } from 'lucide-react';

// 3. Define calisthenics exercises for categorization
const CALISTHENICS_EXERCISES = [
  'Push Up', 'Push-Up', 'Pushup', 'Push Ups',
  'Pull Up', 'Pull-Up', 'Pullup', 'Pull Ups',
  'Chin Up', 'Chin-Up', 'Chinup',
  'Dip', 'Dips', 'Tricep Dip',
  'Bodyweight Squat', 'Air Squat', 'Squat (Bodyweight)',
  'Lunge', 'Lunges', 'Walking Lunge',
  'Plank', 'Side Plank',
  'Burpee', 'Burpees',
  'Mountain Climber', 'Mountain Climbers',
  'Sit Up', 'Sit-Up', 'Situp',
  'Crunch', 'Crunches',
  'Leg Raise', 'Hanging Leg Raise',
  'Pike Push Up', 'Handstand Push Up',
  'Inverted Row', 'Australian Pull Up',
  'Muscle Up', 'Muscle-Up',
];

// 4. Filter function for calisthenics workouts
const isCalisthenicsExercise = (exerciseName) => {
  if (!exerciseName) return false;
  const lowerName = exerciseName.toLowerCase();
  return CALISTHENICS_EXERCISES.some(ex => 
    lowerName.includes(ex.toLowerCase()) || 
    lowerName.includes('bodyweight') ||
    lowerName.includes('calisthenics')
  );
};

const isCalisthenicsWorkout = (workout) => {
  if (!workout || !workout.exercises) return false;
  // A workout is calisthenics if majority of exercises are bodyweight
  const caliCount = workout.exercises.filter(ex => isCalisthenicsExercise(ex.name)).length;
  return caliCount >= workout.exercises.length * 0.5; // 50%+ calisthenics
};

// 5. Create CalisthenicsTab component
const CalisthenicsTab = ({ workouts, dateRange }) => {
  const filteredWorkouts = useMemo(() => {
    return (workouts || []).filter(w => isCalisthenicsWorkout(w));
  }, [workouts]);
  
  // Calculate stats
  const stats = useMemo(() => {
    const exercises = filteredWorkouts.flatMap(w => w.exercises || []);
    const caliExercises = exercises.filter(ex => isCalisthenicsExercise(ex.name));
    
    // Group by exercise type
    const byExercise = {};
    caliExercises.forEach(ex => {
      const name = ex.name.toLowerCase().includes('push') ? 'Push Ups' :
                   ex.name.toLowerCase().includes('pull') ? 'Pull Ups' :
                   ex.name.toLowerCase().includes('dip') ? 'Dips' :
                   ex.name.toLowerCase().includes('squat') ? 'Squats' :
                   ex.name;
      
      if (!byExercise[name]) {
        byExercise[name] = { totalReps: 0, maxReps: 0, sessions: 0 };
      }
      
      const reps = ex.sets?.reduce((sum, s) => sum + (s.reps || 0), 0) || 0;
      byExercise[name].totalReps += reps;
      byExercise[name].maxReps = Math.max(byExercise[name].maxReps, ...ex.sets?.map(s => s.reps || 0) || [0]);
      byExercise[name].sessions += 1;
    });
    
    return {
      workouts: filteredWorkouts.length,
      totalReps: caliExercises.reduce((sum, ex) => 
        sum + (ex.sets?.reduce((s, set) => s + (set.reps || 0), 0) || 0), 0
      ),
      byExercise,
    };
  }, [filteredWorkouts]);
  
  return (
    <div className="space-y-4">
      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Calisthenics Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-cyan-500/10 rounded-xl p-4 border border-cyan-500/20">
              <div className="text-xs text-cyan-300">Workouts</div>
              <div className="text-2xl font-bold">{stats.workouts}</div>
            </div>
            <div className="bg-cyan-500/10 rounded-xl p-4 border border-cyan-500/20">
              <div className="text-xs text-cyan-300">Total Reps</div>
              <div className="text-2xl font-bold">{stats.totalReps.toLocaleString()}</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Exercise Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Exercise Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(stats.byExercise).map(([name, data]) => (
            <div key={name} className="flex justify-between items-center py-2 border-b border-slate-700/50 last:border-0">
              <div>
                <div className="font-medium">{name}</div>
                <div className="text-xs text-slate-500">{data.sessions} sessions</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-cyan-400">{data.totalReps} reps</div>
                <div className="text-xs text-slate-500">Max: {data.maxReps}</div>
              </div>
            </div>
          ))}
          {Object.keys(stats.byExercise).length === 0 && (
            <div className="text-center text-slate-500 py-4">
              No calisthenics workouts yet.<br/>
              <span className="text-xs">Log workouts with Push Ups, Pull Ups, Dips, etc.</span>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Achievements */}
      <CalisthenicsAchievements stats={stats} />
      
      {/* Workout Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Workout Log
            <span className="text-slate-500 font-normal">({filteredWorkouts.length} entries)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredWorkouts.slice(0, 10).map((workout, idx) => (
            <WorkoutLogItem key={workout.id || idx} workout={workout} />
          ))}
          {filteredWorkouts.length === 0 && (
            <div className="text-center text-slate-500 py-4">No calisthenics workouts found</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// 6. Calisthenics Achievements
const CalisthenicsAchievements = ({ stats }) => {
  const achievements = [
    { name: '100 Push Ups (single session)', target: 100, current: stats.byExercise['Push Ups']?.maxReps || 0, icon: '💪' },
    { name: '1000 Total Push Ups', target: 1000, current: stats.byExercise['Push Ups']?.totalReps || 0, icon: '🔥' },
    { name: '20 Pull Ups (single session)', target: 20, current: stats.byExercise['Pull Ups']?.maxReps || 0, icon: '🎯' },
    { name: '500 Total Pull Ups', target: 500, current: stats.byExercise['Pull Ups']?.totalReps || 0, icon: '⭐' },
    { name: '50 Dips (single session)', target: 50, current: stats.byExercise['Dips']?.maxReps || 0, icon: '💎' },
    { name: '100 Bodyweight Squats', target: 100, current: stats.byExercise['Squats']?.maxReps || 0, icon: '🦵' },
  ];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          Calisthenics Achievements
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {achievements.map((ach, idx) => {
          const progress = Math.min((ach.current / ach.target) * 100, 100);
          const isComplete = progress >= 100;
          return (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span>{ach.icon}</span>
                  <span className={isComplete ? 'text-amber-400' : 'text-slate-300'}>{ach.name}</span>
                  {isComplete && <span className="text-green-400">✓</span>}
                </span>
                <span className="text-slate-400 text-xs">{ach.current}/{ach.target}</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${isComplete ? 'bg-amber-400' : 'bg-cyan-500'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

// 7. Update tab content rendering
{activeTab === 'calisthenics' && (
  <CalisthenicsTab workouts={data.workouts} dateRange={dateRange} />
)}
```

---

### ISSUE 4: Fix Shortcut "Could not connect to server"

The error means the API endpoint isn't accessible. Check:

1. **Verify the endpoint exists:**
```bash
ssh pi@192.168.1.73
cd ~/hit-tracker-pro

# Check if endpoint is in server.js
grep -n "apple-health/json" backend/server.js

# Test the endpoint locally
curl -X POST http://localhost:3001/api/apple-health/json \
  -H "Content-Type: application/json" \
  -d '{"weight": [{"value": 84.5, "date": "2026-01-02"}]}'
```

2. **If endpoint doesn't exist, it needs to be deployed** (from previous prompt)

3. **Check Tailscale is connected on iPhone:**
   - Open Tailscale app on iPhone
   - Make sure it shows "Connected"
   - Try accessing http://100.80.30.43:8080 in Safari

---

### ISSUE 5: Verify Apple Health HR/Calories Wiring

Check if the Apple Health data is being merged with Hevy workouts:
```bash
ssh pi@192.168.1.73
cd ~/hit-tracker-pro

# Check a workout in the data
docker compose exec backend cat /app/data/fitness-data.json | python3 -c "
import sys, json
d = json.load(sys.stdin)
workouts = d.get('workouts', [])
print(f'Total workouts: {len(workouts)}')

# Check for Apple Health data in workouts
for w in workouts[:5]:
    print(f\"\\n{w.get('title')} - {w.get('start_time')}\")
    ah = w.get('appleHealth')
    if ah:
        print(f\"  ✅ Apple Health: HR {ah.get('avgHeartRate')}/{ah.get('maxHeartRate')}, Cal: {ah.get('activeCalories')}\")
    else:
        print(f\"  ❌ No Apple Health data\")
"
```

**The Apple Health data only appears if:**
1. You wore your Apple Watch during the workout
2. You logged the workout in Apple Fitness (Traditional Strength Training)
3. The workout dates match between Hevy and Apple Health
4. You've uploaded the Apple Health XML export after that workout

---

### ISSUE 6: FitnessView Integration for Workouts

Update the Shortcut to use FitnessView's "Export CSV" action:

**Before your current shortcut actions, add:**
ACTION 0: Export CSV (FitnessView)
Start Date: [Date - 30 days]
End Date: [Current Date]
Category Type: Workouts
Export Type: Daily
ACTION 0.5: Set Variable → workoutCSV

**Then in your Dictionary, add:**
workoutCSV: workoutCSV

**And update the backend to parse the FitnessView CSV:**
```javascript
// In /api/apple-health/json endpoint, add handling for workoutCSV:
if (payload.workoutCSV) {
  try {
    // FitnessView CSV format parsing
    const lines = payload.workoutCSV.split('\n');
    const headers = lines[0].split(',');
    
    const workouts = lines.slice(1).map(line => {
      const values = line.split(',');
      return {
        date: values[0],
        type: values[1],
        duration: parseFloat(values[2]) * 60, // minutes to seconds
        activeCalories: parseFloat(values[3]) || 0,
        avgHeartRate: parseFloat(values[4]) || 0,
        maxHeartRate: parseFloat(values[5]) || 0,
        distance: parseFloat(values[6]) || 0,
      };
    }).filter(w => w.date && w.duration > 0);
    
    console.log(`Parsed ${workouts.length} workouts from FitnessView CSV`);
    
    // Merge into conditioning
    workouts.forEach(w => {
      const isDuplicate = data.conditioning.some(
        c => c.date?.split('T')[0] === w.date?.split('T')[0] && c.type === w.type
      );
      if (!isDuplicate) {
        data.conditioning.push({
          id: `fitnessview-${w.date}-${Math.random().toString(36).substr(2, 9)}`,
          ...w,
          source: 'FitnessView',
        });
      }
    });
  } catch (error) {
    console.error('Error parsing FitnessView CSV:', error);
  }
}
```

---

### DEPLOYMENT
```bash
git add -A
git commit -m "Fix: Weight trend calc, calorie daily view, calisthenics tab, FitnessView integration"
git push origin main

ssh pi@192.168.1.73 "cd ~/hit-tracker-pro && git pull && docker compose down && docker compose up -d --build"
```

### VERIFICATION

After deployment:
1. [ ] Weight trend shows correct change (last - first, not random)
2. [ ] Calorie Balance shows daily breakdown
3. [ ] Calisthenics tab appears between Legs and Cardio
4. [ ] Test Shortcut connection: `curl http://100.80.30.43:3001/api/apple-health/json`
5. [ ] Run Shortcut - should connect without error