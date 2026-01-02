## FIX: Critical Data Issues - fetchData Error, Conditioning Lost, Weight/Calories Wrong

### ISSUE 1: "fetchData is not defined" Error

Find and fix the undefined function reference:
```bash
ssh pi@192.168.1.73
cd ~/hit-tracker-pro

# Find where fetchData is called but not defined
grep -n "fetchData" src/App.jsx
```

**Fix:** The function is likely called but not defined or named differently. Find the data loading function and ensure it's properly referenced:
```jsx
// In App.jsx, find the data loading function
// It might be called loadData, refreshData, or similar

// If there's a "Test Shortcut Sync" button calling fetchData:
const handleTestShortcutSync = async () => {
  try {
    const testData = {
      weight: [{ date: new Date().toISOString(), value: 80 }],
    };
    
    const res = await fetch(`${API_BASE_URL}/apple-health/json`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-User-Id': 'fahim',
      },
      body: JSON.stringify(testData),
    });
    
    const result = await res.json();
    
    if (result.success) {
      alert('JSON sync endpoint working! Reloading data...');
      // Call the actual data reload function - find its correct name
      window.location.reload(); // Fallback: just reload the page
    } else {
      alert('Error: ' + result.error);
    }
  } catch (error) {
    alert('Connection error: ' + error.message);
  }
};

// OR if there IS a fetchData function, make sure it's defined:
const fetchData = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/data?_t=${Date.now()}`);
    if (res.ok) {
      const apiData = await res.json();
      const normalized = normalizeApiData(apiData);
      setData(normalized);
    }
  } catch (error) {
    console.error('Fetch error:', error);
  }
};
```

---

### ISSUE 2: "CONDITIONING DATA LOST DURING NORMALIZATION" 

The console shows conditioning data exists in API but gets lost. Fix the normalization:
```jsx
// Find normalizeApiData function and fix it:

const normalizeApiData = (raw) => {
  if (!raw) {
    console.error('normalizeApiData received null/undefined');
    return null;
  }
  
  console.log('Raw API data:', {
    workouts: raw.workouts?.length || 0,
    conditioning: raw.conditioning?.length || 0,
    measurements: !!raw.measurements,
  });
  
  // CRITICAL: Don't lose conditioning data!
  const normalizedConditioning = (raw.conditioning || []).map(session => {
    if (!session) return null;
    
    return {
      ...session,
      // Normalize date
      date: session.date || session.startDate || session.Start_Date,
      // Normalize calories - try multiple field names
      activeCalories: session.activeCalories ?? session.calories ?? session.Calories ?? session.active_calories ?? 0,
      // Normalize heart rate
      avgHeartRate: session.avgHeartRate ?? session.averageHeartRate ?? session.avg_heart_rate ?? session.hr_avg ?? 0,
      maxHeartRate: session.maxHeartRate ?? session.maximumHeartRate ?? session.max_heart_rate ?? session.hr_max ?? 0,
      // Normalize other fields
      duration: session.duration ?? session.Duration ?? 0,
      distance: session.distance ?? session.Distance ?? 0,
      steps: session.steps ?? session.Steps ?? 0,
      type: session.type ?? session.Type ?? session.workoutType ?? 'Unknown',
    };
  }).filter(s => s !== null);
  
  console.log('Normalized conditioning:', normalizedConditioning.length);
  
  const result = {
    workouts: normalizeWorkouts(raw.workouts || []),
    conditioning: normalizedConditioning, // Use the properly normalized data
    measurements: normalizeMeasurements(raw.measurements || {}),
    appleHealth: raw.appleHealth || {},
    nutrition: raw.nutrition || { dailyCalorieIntake: {} },
    lastSync: raw.lastSync,
    lastWebhook: raw.lastWebhook,
  };
  
  // Debug: verify conditioning wasn't lost
  if (raw.conditioning?.length > 0 && result.conditioning.length === 0) {
    console.error('❌ CONDITIONING DATA WAS LOST!');
    console.error('Raw conditioning sample:', raw.conditioning[0]);
    // Emergency fallback - just use raw data
    result.conditioning = raw.conditioning;
  }
  
  return result;
};

// Also check if there's a separate normalizeConditioning function that's broken:
const normalizeConditioning = (raw) => {
  if (!raw) return [];
  if (!Array.isArray(raw)) {
    console.error('normalizeConditioning: input is not array:', typeof raw);
    return [];
  }
  
  return raw.map(session => ({
    ...session,
    date: session.date || session.startDate,
    activeCalories: session.activeCalories ?? session.calories ?? 0,
    avgHeartRate: session.avgHeartRate ?? session.averageHeartRate ?? 0,
    maxHeartRate: session.maxHeartRate ?? session.maximumHeartRate ?? 0,
    duration: session.duration ?? 0,
    distance: session.distance ?? 0,
    steps: session.steps ?? 0,
  })).filter(s => s !== null && s !== undefined);
};
```

---

### ISSUE 3: Weight Not Updating from Shortcut (80 vs 82.3)

The Apple Shortcut sends data in a specific format. Check and fix the parsing:
```bash
# Check what the Shortcut is actually sending
docker compose logs backend --tail=100 | grep -A 5 "Apple Health JSON"
```

**Fix the backend to handle Apple Shortcuts format:**

The data from Apple Shortcuts looks different than expected. Update the endpoint:
```javascript
// In backend/server.js - /api/apple-health/json endpoint

// Apple Shortcuts sends data in this format:
// { weight: [ {Value: 82.3, Start Date: "2026-01-02 08:30:00 +0000", ...} ] }

// Process Weight Records - handle multiple formats
if (payload.weight && Array.isArray(payload.weight)) {
  console.log('Raw weight data sample:', JSON.stringify(payload.weight[0]));
  
  const validWeights = payload.weight
    .map(w => {
      // Try multiple field name formats
      const value = w.value ?? w.Value ?? w.qty ?? w.Qty ?? w.quantity ?? w.Quantity;
      const date = w.date ?? w.Date ?? w.startDate ?? w['Start Date'] ?? w.Start_Date ?? w.start_date;
      
      console.log(`Weight record: value=${value}, date=${date}`);
      
      return { value: parseFloat(value), date };
    })
    .filter(w => w.value && w.value >= 40 && w.value <= 200 && w.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  console.log(`Valid weights after filtering: ${validWeights.length}`);
  
  if (validWeights.length > 0) {
    console.log(`Latest weight: ${validWeights[0].value} kg from ${validWeights[0].date}`);
    
    data.measurements = data.measurements || { current: {}, starting: {}, history: [] };
    data.measurements.current.weight = validWeights[0].value;
    
    // Also update history
    validWeights.forEach(w => {
      const dateKey = new Date(w.date).toISOString().split('T')[0];
      const exists = (data.measurements.history || []).some(h => 
        h.date?.includes(dateKey)
      );
      if (!exists) {
        data.measurements.history = data.measurements.history || [];
        data.measurements.history.push({
          date: new Date(w.date).toISOString(),
          weight: w.value,
        });
      }
    });
    
    // Sort and limit history
    data.measurements.history = (data.measurements.history || [])
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 90);
  }
}
```

---

### ISSUE 4: Calories Burned = 0

The active calories from Shortcut aren't being stored or displayed:
```javascript
// In backend - /api/apple-health/json endpoint
// Fix active calories parsing:

if (payload.activeCalories && Array.isArray(payload.activeCalories)) {
  console.log('Raw activeCalories sample:', JSON.stringify(payload.activeCalories[0]));
  
  const calRecords = payload.activeCalories
    .map(c => {
      const value = c.value ?? c.Value ?? c.qty ?? c.Qty ?? c.quantity;
      const date = c.date ?? c.Date ?? c.startDate ?? c['Start Date'];
      return { value: parseFloat(value), date };
    })
    .filter(c => c.value && c.value > 0 && c.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  console.log(`Valid active calories records: ${calRecords.length}`);
  
  if (calRecords.length > 0) {
    data.appleHealth = data.appleHealth || {};
    data.appleHealth.avgActiveCalories = Math.round(
      calRecords.slice(0, 7).reduce((sum, c) => sum + c.value, 0) / 
      Math.min(calRecords.length, 7)
    );
    
    // Also store daily active calories for calorie balance calculation
    data.appleHealth.dailyActiveCalories = data.appleHealth.dailyActiveCalories || {};
    calRecords.forEach(c => {
      const dateKey = new Date(c.date).toISOString().split('T')[0];
      data.appleHealth.dailyActiveCalories[dateKey] = Math.round(c.value);
    });
    
    console.log(`Stored active calories for ${Object.keys(data.appleHealth.dailyActiveCalories).length} days`);
  }
}
```

**Also update the frontend CalorieInsight to use the new data:**
```jsx
const CalorieInsight = ({ nutrition, conditioning, workouts, appleHealth, dateRange }) => {
  // Get daily intake
  const dailyIntake = nutrition?.dailyCalorieIntake || {};
  
  // Get daily active calories from appleHealth (from Shortcut)
  const dailyActiveCalories = appleHealth?.dailyActiveCalories || {};
  
  // Calculate burned calories
  const now = new Date();
  const daysMap = { '7D': 7, '30D': 30, '90D': 90, '1Y': 365, 'All': 9999 };
  const daysBack = daysMap[dateRange] || 7;
  const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  
  // Sum active calories from Apple Health Shortcut data
  const burnedFromShortcut = Object.entries(dailyActiveCalories)
    .filter(([date]) => new Date(date) >= startDate)
    .reduce((sum, [_, cal]) => sum + cal, 0);
  
  // Sum calories from conditioning sessions
  const burnedFromConditioning = (conditioning || [])
    .filter(c => new Date(c.date) >= startDate)
    .reduce((sum, c) => sum + (c.activeCalories || c.calories || 0), 0);
  
  // Sum calories from workouts with Apple Health data
  const burnedFromWorkouts = (workouts || [])
    .filter(w => new Date(w.start_time) >= startDate)
    .reduce((sum, w) => sum + (w.appleHealth?.activeCalories || 0), 0);
  
  // Total burned = max of (Shortcut data) or (conditioning + workouts)
  // Use Shortcut data if available as it's more comprehensive
  const burnedCalories = burnedFromShortcut > 0 
    ? burnedFromShortcut 
    : (burnedFromConditioning + burnedFromWorkouts);
  
  console.log('Calorie calculation:', {
    burnedFromShortcut,
    burnedFromConditioning,
    burnedFromWorkouts,
    totalBurned: burnedCalories,
  });
  
  // ... rest of component
};
```

---

### ISSUE 5: Dietary Calories Inaccurate

Check and fix dietary calorie parsing:
```javascript
// In backend - /api/apple-health/json endpoint

if (payload.dietaryCalories && Array.isArray(payload.dietaryCalories)) {
  console.log('Raw dietary calories sample:', JSON.stringify(payload.dietaryCalories[0]));
  
  data.nutrition = data.nutrition || { dailyCalorieIntake: {} };
  
  payload.dietaryCalories.forEach(dc => {
    const value = dc.value ?? dc.Value ?? dc.qty ?? dc.Qty ?? dc.quantity;
    const date = dc.date ?? dc.Date ?? dc.startDate ?? dc['Start Date'];
    
    if (value && date) {
      const dateKey = new Date(date).toISOString().split('T')[0];
      const calories = Math.round(parseFloat(value));
      
      // Only update if we have a valid value
      if (calories > 0) {
        console.log(`Dietary calories for ${dateKey}: ${calories}`);
        data.nutrition.dailyCalorieIntake[dateKey] = calories;
      }
    }
  });
  
  console.log('Dietary calories stored:', data.nutrition.dailyCalorieIntake);
}
```

---

### DEPLOYMENT
```bash
git add -A
git commit -m "Fix: fetchData error, conditioning normalization, weight/calorie parsing from Shortcuts"
git push origin main

ssh pi@192.168.1.73 "cd ~/hit-tracker-pro && git pull && docker compose down && docker compose up -d --build"
```

### VERIFICATION

After deployment:

1. **Check backend logs when Shortcut runs:**
```bash
ssh pi@192.168.1.73 "cd ~/hit-tracker-pro && docker compose logs backend --tail=100"
```
Look for:
- `Raw weight data sample:` - shows what Shortcut is sending
- `Latest weight: X kg` - confirms parsing worked
- `Valid active calories records: X` - confirms calories received

2. **Run Shortcut again** and check dashboard updates

3. **Check data file:**
```bash
ssh pi@192.168.1.73 "cd ~/hit-tracker-pro && docker compose exec backend cat /app/data/fitness-data.json | python3 -c \"import sys,json; d=json.load(sys.stdin); print('Weight:', d.get('measurements',{}).get('current',{}).get('weight')); print('Active cal:', d.get('appleHealth',{}).get('dailyActiveCalories',{}))\""
```

4. **Test Shortcut Sync button** - should not show "fetchData is not defined" error