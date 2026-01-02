## FIX: "Invalid Date" Showing in Cardio Workout Log

The conditioning sessions from Apple Shortcuts show "Invalid Date" because the date format from Shortcuts is different than expected.

### TASK 1: Fix Date Parsing in Frontend

Find where conditioning sessions display the date and add robust parsing:
```jsx
// Add this helper function near the top of App.jsx
const parseDate = (dateInput) => {
  if (!dateInput) return null;
  
  // If already a Date object
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }
  
  // If string, try multiple formats
  if (typeof dateInput === 'string') {
    // Try standard ISO format
    let date = new Date(dateInput);
    if (!isNaN(date.getTime())) return date;
    
    // Try timestamp (seconds or milliseconds)
    const num = Number(dateInput);
    if (!isNaN(num)) {
      // If less than year 2000 in ms, it's probably seconds
      date = new Date(num > 1000000000000 ? num : num * 1000);
      if (!isNaN(date.getTime())) return date;
    }
    
    // Try other common formats
    // "23/12/2025, 12:16 pm" format from Shortcuts
    const ukMatch = dateInput.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{1,2}):(\d{2})\s*(am|pm)?/i);
    if (ukMatch) {
      let hours = parseInt(ukMatch[4]);
      if (ukMatch[6]?.toLowerCase() === 'pm' && hours < 12) hours += 12;
      if (ukMatch[6]?.toLowerCase() === 'am' && hours === 12) hours = 0;
      date = new Date(ukMatch[3], ukMatch[2] - 1, ukMatch[1], hours, ukMatch[5]);
      if (!isNaN(date.getTime())) return date;
    }
    
    // "Dec 23, 2025" format
    const usMatch = dateInput.match(/(\w+)\s+(\d{1,2}),?\s*(\d{4})/);
    if (usMatch) {
      date = new Date(dateInput);
      if (!isNaN(date.getTime())) return date;
    }
  }
  
  // If number (timestamp)
  if (typeof dateInput === 'number') {
    const date = new Date(dateInput > 1000000000000 ? dateInput : dateInput * 1000);
    if (!isNaN(date.getTime())) return date;
  }
  
  console.warn('Could not parse date:', dateInput);
  return null;
};

// Format date for display
const formatDisplayDate = (dateInput) => {
  const date = parseDate(dateInput);
  if (!date) return 'No date';
  
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};
```

### TASK 2: Update Conditioning Session Display

Find where conditioning sessions are rendered and use the new formatter:
```jsx
// In the conditioning/cardio workout log display:
{conditioning.map((session, idx) => (
  <div key={session.id || idx} className="...">
    <div className="...">
      <span className="font-medium">{session.type || 'Workout'}</span>
      <span className="text-slate-500 text-sm">
        {formatDisplayDate(session.date)} • {session.source || 'Apple Health'}
      </span>
    </div>
    {/* ... rest of session display */}
  </div>
))}
```

### TASK 3: Also Fix Date in Data Normalization

Update normalizeConditioningSession to handle dates:
```jsx
const normalizeConditioningSession = (session) => {
  if (!session) return null;
  
  // Parse and normalize the date
  const parsedDate = parseDate(session.date || session.startDate);
  
  return {
    ...session,
    date: parsedDate ? parsedDate.toISOString() : session.date,
    activeCalories: session.activeCalories ?? session.calories ?? 0,
    avgHeartRate: session.avgHeartRate ?? session.averageHeartRate ?? session.hr_avg ?? 0,
    maxHeartRate: session.maxHeartRate ?? session.maximumHeartRate ?? session.hr_max ?? 0,
    distance: session.distance ?? 0,
    duration: session.duration ?? 0,
    steps: session.steps ?? 0,
  };
};
```

## IMPLEMENT: Apple Health JSON API Endpoint for Shortcuts Automation

### TASK 3: Create New API Endpoint for JSON Health Data

Add a new endpoint that accepts JSON from Apple Shortcuts:
```javascript
// POST /api/apple-health/json
// Accepts JSON payload from Apple Shortcuts with health data
app.post('/api/apple-health/json', express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const userId = getUserId(req);
    console.log(`Apple Health JSON upload for user: ${userId}`);
    
    const payload = req.body;
    
    // Validate payload
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }
    
    console.log('Received health data:', {
      weightRecords: payload.weight?.length || 0,
      bodyFatRecords: payload.bodyFat?.length || 0,
      workouts: payload.workouts?.length || 0,
      sleepRecords: payload.sleep?.length || 0,
      heartRateRecords: payload.heartRate?.length || 0,
      steps: payload.steps?.length || 0,
      activeCalories: payload.activeCalories?.length || 0,
    });
    
    // Read existing data
    const data = readUserData ? readUserData(userId) : readData();
    
    // Process Weight Records
    if (payload.weight && Array.isArray(payload.weight)) {
      const validWeights = payload.weight
        .filter(w => w.value && w.value >= 40 && w.value <= 200)
        .map(w => ({
          date: w.date || w.startDate || new Date().toISOString(),
          value: parseFloat(w.value),
          source: w.source || 'Apple Health',
        }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      
      if (validWeights.length > 0) {
        // Update current weight
        data.measurements = data.measurements || { current: {}, starting: {}, history: [] };
        data.measurements.current.weight = validWeights[0].value;
        
        // Update history (keep last 90 days)
        const existingHistory = data.measurements.history || [];
        const weightDates = new Set(existingHistory.map(h => h.date?.split('T')[0]));
        
        validWeights.forEach(w => {
          const dateKey = w.date.split('T')[0];
          if (!weightDates.has(dateKey)) {
            existingHistory.push({
              date: w.date,
              weight: w.value,
            });
          }
        });
        
        // Sort and limit to 90 days
        data.measurements.history = existingHistory
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 90);
        
        data.measurements.sources = data.measurements.sources || {};
        data.measurements.sources.weight = 'Apple Health';
      }
    }
    
    // Process Body Fat Records
    if (payload.bodyFat && Array.isArray(payload.bodyFat)) {
      const validBodyFat = payload.bodyFat
        .filter(bf => bf.value && bf.value > 0 && bf.value < 50)
        .map(bf => ({
          date: bf.date || bf.startDate || new Date().toISOString(),
          // Apple Health stores as decimal (0.25), convert to percentage (25)
          value: bf.value < 1 ? bf.value * 100 : bf.value,
          source: bf.source || 'Apple Health',
        }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      
      if (validBodyFat.length > 0) {
        data.measurements = data.measurements || { current: {}, starting: {}, history: [] };
        data.measurements.current.bodyFat = validBodyFat[0].value;
        data.measurements.sources = data.measurements.sources || {};
        data.measurements.sources.bodyFat = 'Apple Health';
        
        // Add to history
        validBodyFat.forEach(bf => {
          const existing = data.measurements.history.find(
            h => h.date?.split('T')[0] === bf.date.split('T')[0]
          );
          if (existing) {
            existing.bodyFat = bf.value;
          }
        });
      }
    }
    
    // Process Lean Body Mass
    if (payload.leanBodyMass && Array.isArray(payload.leanBodyMass)) {
      const validLeanMass = payload.leanBodyMass
        .filter(lm => lm.value && lm.value >= 30 && lm.value <= 150)
        .sort((a, b) => new Date(b.date || b.startDate) - new Date(a.date || a.startDate));
      
      if (validLeanMass.length > 0) {
        data.measurements = data.measurements || { current: {}, starting: {}, history: [] };
        data.measurements.current.leanMass = validLeanMass[0].value;
      }
    }
    
    // Process Waist Circumference
    if (payload.waistCircumference && Array.isArray(payload.waistCircumference)) {
      const validWaist = payload.waistCircumference
        .filter(w => w.value && w.value > 0)
        .map(w => ({
          date: w.date || w.startDate,
          // Apple Health stores in cm, convert to inches
          value: w.unit === 'cm' ? w.value / 2.54 : w.value,
        }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      
      if (validWaist.length > 0) {
        data.measurements = data.measurements || { current: {}, starting: {}, history: [] };
        data.measurements.current.waist = validWaist[0].value;
        data.measurements.sources = data.measurements.sources || {};
        data.measurements.sources.waist = 'Apple Health';
      }
    }
    
    // Process Sleep Records
    if (payload.sleep && Array.isArray(payload.sleep)) {
      const sleepRecords = payload.sleep
        .filter(s => s.value || s.duration)
        .map(s => ({
          date: s.date || s.startDate || s.endDate,
          // Duration in hours
          hours: s.value ? parseFloat(s.value) / 3600 : s.duration / 3600,
          source: s.source || 'Apple Health',
        }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      
      if (sleepRecords.length > 0) {
        data.appleHealth = data.appleHealth || {};
        data.appleHealth.sleepRecords = sleepRecords.slice(0, 30);
        
        // Calculate average sleep
        const last7 = sleepRecords.slice(0, 7);
        data.appleHealth.sleepAvg = last7.reduce((sum, s) => sum + s.hours, 0) / last7.length;
      }
    }
    
    // Process Resting Heart Rate
    if (payload.restingHeartRate && Array.isArray(payload.restingHeartRate)) {
      const hrRecords = payload.restingHeartRate
        .filter(hr => hr.value && hr.value > 30 && hr.value < 150)
        .sort((a, b) => new Date(b.date || b.startDate) - new Date(a.date || a.startDate));
      
      if (hrRecords.length > 0) {
        data.appleHealth = data.appleHealth || {};
        // Average of last 7 days
        const last7 = hrRecords.slice(0, 7);
        data.appleHealth.restingHeartRate = Math.round(
          last7.reduce((sum, hr) => sum + hr.value, 0) / last7.length
        );
      }
    }
    
    // Process Workouts (Conditioning)
    if (payload.workouts && Array.isArray(payload.workouts)) {
      const workouts = payload.workouts.map(w => {
        // Determine category
        const type = (w.type || w.workoutType || '').toLowerCase();
        let category = 'other';
        if (type.includes('walk')) category = 'walking';
        else if (type.includes('run')) category = 'running';
        else if (type.includes('cycl') || type.includes('bike')) category = 'cycling';
        else if (type.includes('swim')) category = 'swimming';
        else if (type.includes('hiit') || type.includes('interval')) category = 'hiit';
        else if (type.includes('strength') || type.includes('weight')) category = 'strength';
        else if (type.includes('yoga')) category = 'yoga';
        else if (type.includes('elliptical')) category = 'elliptical';
        else if (type.includes('row')) category = 'rowing';
        
        // Clean up type name
        let displayType = type
          .replace('hkworkoutactivitytype', '')
          .replace(/([A-Z])/g, ' $1')
          .trim();
        displayType = displayType.charAt(0).toUpperCase() + displayType.slice(1);
        
        return {
          id: `apple-${w.startDate || w.date}-${Math.random().toString(36).substr(2, 9)}`,
          type: displayType || 'Workout',
          category,
          date: w.startDate || w.date,
          endDate: w.endDate,
          source: 'Apple Health',
          duration: w.duration || 0, // seconds
          activeCalories: Math.round(w.activeCalories || w.calories || 0),
          totalCalories: Math.round(w.totalCalories || w.activeCalories || w.calories || 0),
          avgHeartRate: Math.round(w.avgHeartRate || w.averageHeartRate || 0),
          maxHeartRate: Math.round(w.maxHeartRate || w.maximumHeartRate || 0),
          distance: w.distance || 0, // meters
          steps: w.steps || 0,
        };
      }).filter(w => w.duration > 0 || w.activeCalories > 0);
      
      // Merge with existing conditioning (avoid duplicates by date)
      data.conditioning = data.conditioning || [];
      const existingDates = new Set(data.conditioning.map(c => c.date?.split('T')[0]));
      
      workouts.forEach(w => {
        const dateKey = w.date?.split('T')[0];
        // Check for duplicate by date and type
        const isDuplicate = data.conditioning.some(
          c => c.date?.split('T')[0] === dateKey && c.type === w.type
        );
        if (!isDuplicate) {
          data.conditioning.push(w);
        }
      });
      
      // Sort by date (newest first)
      data.conditioning.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      // Also try to merge with Hevy workouts
      if (data.workouts && data.workouts.length > 0) {
        data.workouts = data.workouts.map(workout => {
          const workoutDate = workout.start_time?.split('T')[0];
          const matchingApple = workouts.find(w => {
            const appleDate = w.date?.split('T')[0];
            return appleDate === workoutDate && w.category === 'strength';
          });
          
          if (matchingApple) {
            return {
              ...workout,
              appleHealth: {
                duration: matchingApple.duration,
                activeCalories: matchingApple.activeCalories,
                avgHeartRate: matchingApple.avgHeartRate,
                maxHeartRate: matchingApple.maxHeartRate,
              }
            };
          }
          return workout;
        });
      }
    }
    
    // Process Daily Steps
    if (payload.steps && Array.isArray(payload.steps)) {
      const stepsRecords = payload.steps
        .filter(s => s.value && s.value > 0)
        .sort((a, b) => new Date(b.date || b.startDate) - new Date(a.date || a.startDate));
      
      if (stepsRecords.length > 0) {
        data.appleHealth = data.appleHealth || {};
        // Average of last 7 days
        const last7 = stepsRecords.slice(0, 7);
        data.appleHealth.avgSteps = Math.round(
          last7.reduce((sum, s) => sum + s.value, 0) / last7.length
        );
      }
    }
    
    // Process Active Calories (daily totals)
    if (payload.activeCalories && Array.isArray(payload.activeCalories)) {
      const calRecords = payload.activeCalories
        .filter(c => c.value && c.value > 0)
        .sort((a, b) => new Date(b.date || b.startDate) - new Date(a.date || a.startDate));
      
      if (calRecords.length > 0) {
        data.appleHealth = data.appleHealth || {};
        const last7 = calRecords.slice(0, 7);
        data.appleHealth.avgActiveCalories = Math.round(
          last7.reduce((sum, c) => sum + c.value, 0) / last7.length
        );
      }
    }
    
    // Process Dietary Calories (from MacroFactor etc.)
    if (payload.dietaryCalories && Array.isArray(payload.dietaryCalories)) {
      data.nutrition = data.nutrition || { dailyCalorieIntake: {} };
      
      payload.dietaryCalories.forEach(dc => {
        const dateKey = (dc.date || dc.startDate)?.split('T')[0];
        if (dateKey && dc.value) {
          data.nutrition.dailyCalorieIntake[dateKey] = Math.round(dc.value);
        }
      });
    }
    
    // Update sync timestamp
    data.lastSync = new Date().toISOString();
    data.lastSyncSource = 'Apple Shortcut';
    
    // Save data
    const saved = writeUserData ? writeUserData(userId, data) : writeData(data);
    
    if (saved) {
      const response = {
        success: true,
        message: 'Health data synced successfully',
        synced: {
          weight: payload.weight?.length || 0,
          bodyFat: payload.bodyFat?.length || 0,
          workouts: payload.workouts?.length || 0,
          sleep: payload.sleep?.length || 0,
          restingHR: payload.restingHeartRate?.length || 0,
          steps: payload.steps?.length || 0,
        },
        current: {
          weight: data.measurements?.current?.weight,
          bodyFat: data.measurements?.current?.bodyFat,
          restingHR: data.appleHealth?.restingHeartRate,
          sleepAvg: data.appleHealth?.sleepAvg?.toFixed(1),
        },
        timestamp: data.lastSync,
      };
      
      console.log('Sync successful:', response);
      res.json(response);
    } else {
      res.status(500).json({ error: 'Failed to save data' });
    }
    
  } catch (error) {
    console.error('Apple Health JSON upload error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

---

### TASK 4: Add Menu Option for Manual JSON Sync Test

In the frontend MoreMenu, add option to test JSON sync:
```jsx
// Add to upload menu options
{
  id: 'test-json-sync',
  label: '🔗 Test Shortcut Sync',
  action: async () => {
    // Test the JSON endpoint with sample data
    const testData = {
      weight: [{ date: new Date().toISOString(), value: 80, source: 'Test' }],
    };
    
    try {
      const res = await fetch(`${API_BASE_URL}/apple-health/json?userId=${userId}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Id': userId,
        },
        body: JSON.stringify(testData),
      });
      
      const result = await res.json();
      if (result.success) {
        alert('JSON sync endpoint working! You can now use the Apple Shortcut.');
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      alert('Connection error: ' + error.message);
    }
  }
}
```

---

### DEPLOYMENT
```bash
git add -A
git commit -m "Feature: Apple Health JSON API for Shortcuts automation"
git push origin main

ssh pi@192.168.1.73 "cd ~/hit-tracker-pro && git pull && docker compose down && docker compose up -d --build"
```

### TEST THE ENDPOINT
```bash
# Test with curl
curl -X POST http://100.80.30.43:3001/api/apple-health/json \
  -H "Content-Type: application/json" \
  -d '{
    "weight": [{"date": "2025-01-01T10:00:00Z", "value": 84.5}],
    "bodyFat": [{"date": "2025-01-01T10:00:00Z", "value": 0.265}],
    "restingHeartRate": [{"date": "2025-01-01T10:00:00Z", "value": 58}]
  }'
```