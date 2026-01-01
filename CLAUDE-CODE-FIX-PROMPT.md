## IMPLEMENT: Smart Insights Features + Distance Formatting

in addition to the Future Enhancement Opportunities:
  - Weight trend graph (data now available!)
  - TDEE vs. calorie intake comparison (data now available!)
  - Macro nutrient tracking (if you want to add protein/carbs/fat extraction)

I also want to integrate and implement seamlessly into the dashboard:

### TASK 1: Distance & Avg pace Formatting
Please remove avg pace in over view and replace with avg steps

and in the workout log if it is any form of walking and running add another column for steps. It looks like the current column for distance are actually steps not distance. and ensure the steps numbers that go above 999 turn into K i.e 10000 is 10K. and for distance ensure there are no decimal places.


**1b. Hide column/row when 0 in cardio section:**
```jsx
{/* Only show distance if > 0 */}
{session.distance > 0 && (
  <div className="flex justify-between py-1">
    <span className="text-slate-400">Distance</span>
    <span className="font-semibold">{formatDistance(session.distance)}</span>
  </div>
)}
```

---

### TASK 2: Weight Trend Mini-Graph in Body Composition Card

Add a sparkline/mini line graph showing weight trend below the weight display:
```jsx
// Simple SVG sparkline component
const WeightSparkline = ({ history, days = 30 }) => {
  if (!history || history.length < 2) return null;
  
  // Get last N days of weight data
  const weightData = history
    .filter(h => h.weight && h.weight > 0)
    .slice(0, days)
    .reverse(); // Oldest first for left-to-right
  
  if (weightData.length < 2) return null;
  
  const weights = weightData.map(d => d.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  
  // SVG dimensions
  const width = 200;
  const height = 40;
  const padding = 4;
  
  // Generate path
  const points = weights.map((w, i) => {
    const x = padding + (i / (weights.length - 1)) * (width - padding * 2);
    const y = height - padding - ((w - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });
  
  const pathD = `M ${points.join(' L ')}`;
  
  // Trend direction
  const trend = weights[weights.length - 1] - weights[0];
  const trendColor = trend > 0 ? '#22c55e' : trend < 0 ? '#ef4444' : '#94a3b8';
  
  return (
    <div className="mt-3">
      <div className="text-xs text-slate-500 mb-1">Weight Trend ({days}d)</div>
      <svg width={width} height={height} className="w-full">
        {/* Grid lines */}
        <line x1={padding} y1={height/2} x2={width-padding} y2={height/2} stroke="#334155" strokeWidth="1" strokeDasharray="4"/>
        {/* Trend line */}
        <path d={pathD} fill="none" stroke={trendColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        {/* End dot */}
        <circle cx={points[points.length-1]?.split(',')[0]} cy={points[points.length-1]?.split(',')[1]} r="3" fill={trendColor}/>
      </svg>
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>{min.toFixed(1)}kg</span>
        <span>{max.toFixed(1)}kg</span>
      </div>
    </div>
  );
};
```

**Add to BodyCompositionCard:**
```jsx
const BodyCompositionCard = ({ measurements }) => {
  // ... existing code ...
  
  return (
    <Card>
      {/* ... existing weight/body fat display ... */}
      
      {/* Weight Trend Graph */}
      <WeightSparkline history={measurements?.history} days={30} />
      
      {/* ... rest of card ... */}
    </Card>
  );
};
```

---

### TASK 3: Smart Calorie Insight in Weekly Insights Card

Add a calorie balance section showing consumed vs burned:
```jsx
const CalorieInsight = ({ nutrition, conditioning, workouts, dateRange }) => {
  // Calculate calories consumed (from nutrition.dailyCalorieIntake)
  const dailyIntake = nutrition?.dailyCalorieIntake || {};
  
  // Filter by date range
  const now = new Date();
  const daysBack = dateRange === '7D' ? 7 : dateRange === '30D' ? 30 : dateRange === '90D' ? 90 : 7;
  const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  
  const consumedCalories = Object.entries(dailyIntake)
    .filter(([date]) => new Date(date) >= startDate)
    .reduce((sum, [_, cal]) => sum + (cal || 0), 0);
  
  // Calculate calories burned (from workouts + conditioning)
  const workoutCalories = (workouts || [])
    .filter(w => new Date(w.start_time) >= startDate)
    .reduce((sum, w) => sum + (w.appleHealth?.activeCalories || 0), 0);
  
  const conditioningCalories = (conditioning || [])
    .filter(c => new Date(c.date) >= startDate)
    .reduce((sum, c) => sum + (c.activeCalories || c.calories || 0), 0);
  
  const burnedCalories = workoutCalories + conditioningCalories;
  
  // Calculate balance
  const balance = consumedCalories - burnedCalories;
  const dailyAvgBalance = balance / daysBack;
  
  // Estimate weekly weight change (3500 cal = ~0.45kg)
  const weeklyWeightChange = (dailyAvgBalance * 7) / 7700; // 7700 cal = 1kg
  
  // Determine goal status
  const getGoalStatus = () => {
    if (dailyAvgBalance < -300) return { label: 'Cutting', color: 'text-red-400', icon: '🔥' };
    if (dailyAvgBalance > 300) return { label: 'Bulking', color: 'text-green-400', icon: '💪' };
    return { label: 'Maintaining', color: 'text-blue-400', icon: '⚖️' };
  };
  
  const goal = getGoalStatus();
  
  if (consumedCalories === 0 && burnedCalories === 0) {
    return null; // Don't show if no data
  }
  
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
            <span className="text-green-400">{consumedCalories.toLocaleString()} kcal</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-400">Burned (exercise)</span>
          <span className="text-red-400">{burnedCalories.toLocaleString()} kcal</span>
        </div>
        
        {consumedCalories > 0 && (
          <>
            <div className="border-t border-slate-700 my-2"></div>
            <div className="flex justify-between font-medium">
              <span className="text-slate-300">Balance</span>
              <span className={balance < 0 ? 'text-red-400' : 'text-green-400'}>
                {balance > 0 ? '+' : ''}{balance.toLocaleString()} kcal
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Est. weekly change</span>
              <span className={weeklyWeightChange < 0 ? 'text-red-400' : 'text-green-400'}>
                {weeklyWeightChange > 0 ? '+' : ''}{weeklyWeightChange.toFixed(2)} kg/week
              </span>
            </div>
            
            <div className="mt-3 flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-900/50">
              <span className="text-lg">{goal.icon}</span>
              <span className={`font-medium ${goal.color}`}>{goal.label}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
```

**Add to WeeklyInsightsCard:**
```jsx
<CalorieInsight 
  nutrition={data.nutrition}
  conditioning={data.conditioning}
  workouts={data.workouts}
  dateRange={dateRange}
/>
```

---

### TASK 4: Update Data Loading to Include Nutrition

Make sure the frontend loads and normalizes nutrition data:
```jsx
// In normalizeApiData function, add:
const normalizeApiData = (raw) => {
  if (!raw) return null;
  return {
    workouts: normalizeWorkouts(raw.workouts),
    conditioning: normalizeConditioning(raw.conditioning),
    measurements: normalizeMeasurements(raw.measurements),
    appleHealth: normalizeAppleHealth(raw.appleHealth),
    nutrition: raw.nutrition || { dailyCalorieIntake: {} }, // Add this
    lastSync: raw.lastSync,
    lastWebhook: raw.lastWebhook,
  };
};
```

---

### TASK 5: Add Flame Icon Import

Make sure Flame icon is imported from lucide-react:
```jsx
import { 
  // ... existing imports ...
  Flame,
} from 'lucide-react';
```

---

I have also changed the icon in the public folder and the name to Fahim's Tracker pro. can you also change the icon besides the name to the same one in the public folder. make it beautiful. 

furthermore, the battery icon for recovery score should look more full when its at a higher percentage at 82% right now but the battery looks like its empty (like its at 0%)

### TASK 6: Verify data syncronisation across all devices

Ensure that all fitness data is fully synchronised and consistent across every device linked to my account. For example, at present, my PC correctly shows the cardio section with populated stats and figures, but on my iPhone the cardio section appears empty. Investigate and resolve any discrepancies so that the same data is visible on all devices consistently. Confirm that the sync process is complete and that no data is missing or delayed.

### VERIFICATION CHECKLIST

After deployment, verify:

1. **Distance and steps Formatting:**
   - [ ] Columns that display 0 in workout logs in cardio is hidden(no "0" showing)
   - [ ] 15000 shows as "15K" or 15519 shows as "15.5K"
   - [ ] 50.3453 miles shows as "50 miles"

2. **Weight Trend Graph:**
   - [ ] Shows below weight in Body Composition card
   - [ ] Line goes up/down based on trend
   - [ ] Shows min/max values below

3. **Calorie Insight:**
   - [ ] Shows in Weekly Insights card
   - [ ] Shows "Consumed" if nutrition data exists
   - [ ] Shows "Burned (exercise)" from workouts
   - [ ] Shows balance and weekly estimate
   - [ ] Shows Cutting/Bulking/Maintaining status

4. **Data Loading:**
   - [ ] Re-upload Apple Health XML
   - [ ] Check that nutrition.dailyCalorieIntake is populated
   - [ ] Check that measurements.history has weight records

---

### DEPLOYMENT
```bash
git add -A
git commit -m "Feature: Weight trend graph, calorie insights, smart distance formatting"
git push origin main

ssh pi@192.168.1.73 "cd ~/hit-tracker-pro && git pull && docker compose down && docker compose up -d --build"
```

After deployment, re-upload your Apple Health XML to populate the new data fields.