## SIMPLIFY: Remove complex measurements, fix Apple Health display

### TASK 1: Simplify Body Composition Card

Update the frontend to only show these measurements:
- Weight (kg)
- Body Fat (%)
- BMI
- Waist (inches)

Remove from display: chest, biceps, shoulders, thighs, calves, neck, etc.

In src/App.jsx, find the BodyCompositionCard and simplify it:
```jsx
// Body Composition Card - SIMPLIFIED
const BodyCompositionCard = ({ measurements }) => {
  const current = measurements?.current || {};
  const starting = measurements?.starting || {};
  
  const weight = current.weight || 0;
  const bodyFat = current.bodyFat || 0;
  const waist = current.waist || 0;
  const height = 1.75; // Your height in meters (adjust if needed)
  const bmi = weight > 0 ? (weight / (height * height)).toFixed(1) : null;
  
  const getBmiCategory = (bmi) => {
    if (!bmi) return { label: 'No data', color: 'text-slate-400' };
    if (bmi < 18.5) return { label: 'Underweight', color: 'text-blue-400' };
    if (bmi < 25) return { label: 'Normal', color: 'text-green-400' };
    if (bmi < 30) return { label: 'Overweight', color: 'text-yellow-400' };
    return { label: 'Obese', color: 'text-red-400' };
  };
  
  const bmiInfo = getBmiCategory(parseFloat(bmi));
  
  const calcChange = (current, starting) => {
    if (!current || !starting || starting === 0) return null;
    return (((current - starting) / starting) * 100).toFixed(1);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-blue-400" />
          Body Composition
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Weight & Body Fat */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl p-4 border border-blue-500/20">
            <div className="text-xs text-blue-300 mb-1">Weight</div>
            <div className="text-2xl font-bold">{weight}<span className="text-sm text-slate-400 ml-1">kg</span></div>
            {calcChange(weight, starting.weight) && (
              <div className={`text-xs mt-1 ${parseFloat(calcChange(weight, starting.weight)) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {calcChange(weight, starting.weight) > 0 ? '+' : ''}{calcChange(weight, starting.weight)}%
              </div>
            )}
          </div>
          <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-xl p-4 border border-purple-500/20">
            <div className="text-xs text-purple-300 mb-1">Body Fat</div>
            <div className="text-2xl font-bold">{bodyFat}<span className="text-sm text-slate-400 ml-1">%</span></div>
            {calcChange(bodyFat, starting.bodyFat) && (
              <div className={`text-xs mt-1 ${parseFloat(calcChange(bodyFat, starting.bodyFat)) < 0 ? 'text-green-400' : 'text-red-400'}`}>
                {calcChange(bodyFat, starting.bodyFat) > 0 ? '+' : ''}{calcChange(bodyFat, starting.bodyFat)}%
              </div>
            )}
          </div>
        </div>
        
        {/* BMI */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-slate-400">BMI</div>
            <div className={`text-sm ${bmiInfo.color}`}>{bmiInfo.label}</div>
          </div>
          <div className="text-2xl font-bold mt-1">{bmi || 'No data'}</div>
        </div>
        
        {/* Waist */}
        {waist > 0 && (
          <div className="flex justify-between items-center py-2 border-t border-slate-700/50">
            <span className="text-slate-400">Waist</span>
            <span className="font-semibold">{waist}"</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

---

### TASK 2: Fix Apple Health Display on Cardio/Conditioning

The conditioning data shows "HKWorkoutActivityTypeWalking" instead of "Walking" and HR/Calories are 0.

**Problem 1:** Workout type not being cleaned up
**Problem 2:** HR and Calories stored as 0 in the data

Fix the display name in the frontend:
```jsx
// Helper to clean up Apple Health workout type names
const cleanWorkoutType = (type) => {
  if (!type) return 'Other';
  // Remove "HKWorkoutActivityType" prefix
  return type
    .replace('HKWorkoutActivityType', '')
    .replace(/([A-Z])/g, ' $1')  // Add space before capitals
    .trim();
};
```

Use this when displaying conditioning sessions:
```jsx
<div className="font-medium">{cleanWorkoutType(session.type)}</div>
```

---

### TASK 3: Fix Apple Health Parser to Extract HR/Calories

The Apple Health XML parser is not extracting heart rate and calories from workouts.

In backend/server.js or backend/apple-health-parser.js, update the workout parsing to extract statistics:
```javascript
// When parsing Apple Health XML, look for workout statistics
// Calories are in: <WorkoutStatistics type="HKQuantityTypeIdentifierActiveEnergyBurned" sum="XXX"/>
// HR is in: <HeartRateStatistics average="XXX" maximum="YYY"/>

function parseWorkoutXML(xml) {
  // ... existing code ...
  
  // Extract calories from WorkoutStatistics
  const caloriesMatch = xml.match(/HKQuantityTypeIdentifierActiveEnergyBurned[^>]*sum="([^"]+)"/);
  const calories = caloriesMatch ? parseFloat(caloriesMatch[1]) : 0;
  
  // Extract HR from HeartRateStatistics or WorkoutStatistics
  const avgHRMatch = xml.match(/HeartRateStatistics[^>]*average="([^"]+)"/) || 
                     xml.match(/HKQuantityTypeIdentifierHeartRate[^>]*average="([^"]+)"/);
  const maxHRMatch = xml.match(/HeartRateStatistics[^>]*maximum="([^"]+)"/) ||
                     xml.match(/HKQuantityTypeIdentifierHeartRate[^>]*maximum="([^"]+)"/);
  
  const avgHeartRate = avgHRMatch ? parseInt(avgHRMatch[1]) : 0;
  const maxHeartRate = maxHRMatch ? parseInt(maxHRMatch[1]) : 0;
  
  // Also try to get from metadata
  if (avgHeartRate === 0) {
    const metaHR = xml.match(/key="HKAverageHeartRate"[^>]*>(\d+)/);
    if (metaHR) avgHeartRate = parseInt(metaHR[1]);
  }
  
  return {
    // ... existing fields ...
    calories,
    avgHeartRate,
    maxHeartRate,
  };
}
```

---

### TASK 4: Add Reset Button

Add a reset button to clear all data and start fresh.

In the frontend menu (MoreMenu component), add:
```jsx
{ 
  id: 'reset', 
  label: '🗑️ Reset All Data', 
  action: async () => {
    if (confirm('Are you sure? This will delete ALL workout and measurement data!')) {
      const res = await fetch(`${API_BASE_URL}/reset`, { method: 'POST' });
      if (res.ok) {
        alert('All data cleared! Refresh the page.');
        window.location.reload();
      }
    }
  }
}
```

Add the backend endpoint:
```javascript
// Reset all data
app.post('/api/reset', (req, res) => {
  const freshData = {
    workouts: [],
    conditioning: [],
    measurements: { current: {}, starting: {}, history: [] },
    appleHealth: {},
    lastSync: null,
    lastWebhook: null
  };
  
  if (writeData(freshData)) {
    console.log('All data reset!');
    res.json({ success: true, message: 'All data cleared' });
  } else {
    res.status(500).json({ error: 'Failed to reset data' });
  }
});
```

---

### DEPLOYMENT
```bash
git add -A
git commit -m "Simplify body comp, fix Apple Health display, add reset button"
git push origin main

ssh pi@192.168.1.73 "cd ~/hit-tracker-pro && git pull && docker compose down && docker compose up -d --build"
```