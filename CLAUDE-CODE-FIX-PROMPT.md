## SMART RECOVERY SCORE + SLEEP ANALYSIS + LEAN MASS

### TASK 1: Smart Recovery Score with Sleep Data

Update the recovery score calculation to factor in sleep:
```javascript
// Enhanced Recovery Score Calculation
const calculateRecoveryScore = (restDays, avgRPE, sleepData) => {
  // Components:
  // 1. Rest Days (40% weight) - How many days since last workout
  // 2. RPE Fatigue (25% weight) - How hard recent workouts were
  // 3. Sleep Quality (35% weight) - Sleep duration and consistency
  
  // Rest Days Score (0-100)
  // 0 days = 20%, 1 day = 50%, 2 days = 75%, 3+ days = 100%
  const restScore = Math.min(100, restDays === 0 ? 20 : restDays === 1 ? 50 : restDays === 2 ? 75 : 100);
  
  // RPE Score (0-100) - Lower RPE = more recovered
  // RPE 10 = 30%, RPE 7 = 70%, RPE 5 = 90%, RPE 0 = 100%
  const rpeScore = Math.max(0, 100 - (avgRPE * 7));
  
  // Sleep Score (0-100)
  const avgSleepHours = sleepData?.avgHours || 7;
  const sleepConsistency = sleepData?.consistency || 0.8; // 0-1 scale
  
  // Optimal sleep is 7-9 hours
  let sleepDurationScore;
  if (avgSleepHours >= 7 && avgSleepHours <= 9) {
    sleepDurationScore = 100;
  } else if (avgSleepHours >= 6 && avgSleepHours < 7) {
    sleepDurationScore = 70;
  } else if (avgSleepHours >= 5 && avgSleepHours < 6) {
    sleepDurationScore = 50;
  } else if (avgSleepHours > 9) {
    sleepDurationScore = 85; // Oversleeping slightly penalized
  } else {
    sleepDurationScore = 30; // Under 5 hours
  }
  
  // Combine sleep duration and consistency
  const sleepScore = (sleepDurationScore * 0.7) + (sleepConsistency * 100 * 0.3);
  
  // Weighted final score
  const finalScore = Math.round(
    (restScore * 0.40) + 
    (rpeScore * 0.25) + 
    (sleepScore * 0.35)
  );
  
  return {
    score: Math.min(100, Math.max(0, finalScore)),
    components: {
      rest: restScore,
      rpe: rpeScore,
      sleep: sleepScore,
    },
    status: finalScore >= 75 ? 'ready' : finalScore >= 50 ? 'moderate' : 'fatigued',
    color: finalScore >= 75 ? 'green' : finalScore >= 50 ? 'amber' : 'red',
  };
};
```

---

### TASK 2: Enhanced Rest Day Card with Sleep Analysis

Replace the small Rest Days card with a larger card that spans the full width (matching Weekly Insights card width) and includes sleep analysis:
```jsx
const RestDaySleepCard = ({ restDays, sleepData, recovery }) => {
  const avgSleep = sleepData?.avgHours || 0;
  const lastNightSleep = sleepData?.lastNight || 0;
  const sleepDebt = sleepData?.debt || 0; // Hours of sleep debt
  const sleepConsistency = sleepData?.consistency || 0;
  
  // Determine card color based on recovery status
  const getCardStyle = () => {
    switch (recovery.status) {
      case 'ready':
        return {
          bg: 'from-green-500/20 to-green-600/10',
          border: 'border-green-500/30',
          accent: 'text-green-400',
          icon: '💪',
          message: 'Well rested - Ready for intense workout!',
        };
      case 'moderate':
        return {
          bg: 'from-amber-500/20 to-amber-600/10',
          border: 'border-amber-500/30',
          accent: 'text-amber-400',
          icon: '⚡',
          message: 'Moderate recovery - Light workout or cardio recommended',
        };
      case 'fatigued':
        return {
          bg: 'from-red-500/20 to-red-600/10',
          border: 'border-red-500/30',
          accent: 'text-red-400',
          icon: '😴',
          message: 'Fatigued - Consider rest or very light activity',
        };
      default:
        return {
          bg: 'from-slate-500/20 to-slate-600/10',
          border: 'border-slate-500/30',
          accent: 'text-slate-400',
          icon: '📊',
          message: 'Insufficient data',
        };
    }
  };
  
  const style = getCardStyle();
  
  // Sleep quality rating
  const getSleepQuality = (hours) => {
    if (hours >= 7 && hours <= 9) return { label: 'Optimal', color: 'text-green-400' };
    if (hours >= 6) return { label: 'Adequate', color: 'text-amber-400' };
    return { label: 'Poor', color: 'text-red-400' };
  };
  
  const sleepQuality = getSleepQuality(avgSleep);
  
  return (
    <div className={`bg-gradient-to-br ${style.bg} rounded-xl p-4 border ${style.border} col-span-2`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Moon className="w-5 h-5 text-indigo-400" />
          <span className="font-medium text-slate-200">Recovery & Sleep</span>
        </div>
        <div className={`text-2xl`}>{style.icon}</div>
      </div>
      
      {/* Main Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Recovery Score */}
        <div className="text-center">
          <div className={`text-3xl font-bold ${style.accent}`}>{recovery.score}%</div>
          <div className="text-xs text-slate-400">Recovery Score</div>
        </div>
        
        {/* Rest Days */}
        <div className="text-center">
          <div className="text-3xl font-bold text-slate-200">{restDays}</div>
          <div className="text-xs text-slate-400">Rest Days</div>
        </div>
        
        {/* Avg Sleep */}
        <div className="text-center">
          <div className="text-3xl font-bold text-indigo-400">{avgSleep.toFixed(1)}<span className="text-lg">h</span></div>
          <div className="text-xs text-slate-400">Avg Sleep</div>
        </div>
      </div>
      
      {/* Sleep Details */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-slate-900/30 rounded-lg p-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Last Night</span>
            <span className="font-medium">{lastNightSleep.toFixed(1)}h</span>
          </div>
        </div>
        <div className="bg-slate-900/30 rounded-lg p-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Sleep Quality</span>
            <span className={`font-medium ${sleepQuality.color}`}>{sleepQuality.label}</span>
          </div>
        </div>
        {sleepDebt > 0 && (
          <div className="bg-slate-900/30 rounded-lg p-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Sleep Debt</span>
              <span className="font-medium text-red-400">-{sleepDebt.toFixed(1)}h</span>
            </div>
          </div>
        )}
        <div className="bg-slate-900/30 rounded-lg p-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Consistency</span>
            <span className="font-medium">{Math.round(sleepConsistency * 100)}%</span>
          </div>
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

**Update Weekly Insights layout to use the new card:**
```jsx
{/* Weekly Insights - Updated Layout */}
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <TrendingUp className="w-5 h-5 text-blue-400" />
      Weekly Insights
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Row 1: Rest & Sleep Card (full width) */}
    <RestDaySleepCard 
      restDays={restDays} 
      sleepData={sleepData} 
      recovery={recoveryData}
    />
    
    {/* Row 2: Avg RPE + Avg Steps */}
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 rounded-xl p-3 border border-yellow-500/20">
        <div className="flex items-center gap-1 text-yellow-300 text-xs mb-1">
          <Zap className="w-3 h-3" />
          Avg RPE
        </div>
        <div className="text-xl font-bold">{avgRPE.toFixed(1)}</div>
      </div>
      <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 rounded-xl p-3 border border-green-500/20">
        <div className="flex items-center gap-1 text-green-300 text-xs mb-1">
          <Footprints className="w-3 h-3" />
          Avg Steps
        </div>
        <div className="text-xl font-bold">
          {avgSteps >= 1000 ? `${(avgSteps / 1000).toFixed(1)}K` : avgSteps || 0}
        </div>
      </div>
    </div>
    
    {/* Row 3: Set Breakdown */}
    <div className="flex justify-around py-2">
      <div className="text-center">
        <div className="text-2xl font-bold text-orange-400">{warmupSets}</div>
        <div className="text-xs text-slate-500">Warmup</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-slate-200">{workingSets}</div>
        <div className="text-xs text-slate-500">Working</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-red-400">{failureSets}</div>
        <div className="text-xs text-slate-500">Failure</div>
      </div>
    </div>
  </CardContent>
</Card>
```

---

### TASK 3: Add Lean Mass to Weight Card (Expanded)

Update the Weight card in Body Composition to include Lean Mass and match the BMI/Body Fat card width:
```jsx
{/* Row 1: Weight + Lean Mass Card (same width as BMI/Body Fat card below) */}
<div className="grid grid-cols-1 gap-3">
  {/* Weight + Lean Mass - Full width card */}
  <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl p-4 border border-blue-500/20">
    <div className="grid grid-cols-2 gap-4">
      {/* Weight */}
      <div>
        <div className="text-xs text-blue-300 mb-1">Weight</div>
        <div className="text-2xl font-bold">
          {weight}<span className="text-sm text-slate-400 ml-1">kg</span>
        </div>
        {weightChange !== null && (
          <div className={`text-xs mt-1 ${weightChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)}%
          </div>
        )}
      </div>
      
      {/* Lean Mass */}
      <div>
        <div className="text-xs text-cyan-300 mb-1">Lean Mass</div>
        <div className="text-2xl font-bold">
          {leanMass > 0 ? leanMass.toFixed(1) : '--'}
          <span className="text-sm text-slate-400 ml-1">kg</span>
        </div>
        {leanMass > 0 && weight > 0 && (
          <div className="text-xs mt-1 text-slate-400">
            {((leanMass / weight) * 100).toFixed(0)}% of total
          </div>
        )}
      </div>
    </div>
    
    {/* Weight vs Lean Mass mini comparison bar */}
    {leanMass > 0 && weight > 0 && (
      <div className="mt-3 pt-3 border-t border-blue-500/20">
        <div className="text-xs text-slate-400 mb-1">Composition</div>
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden flex">
          <div 
            className="h-full bg-cyan-500"
            style={{ width: `${(leanMass / weight) * 100}%` }}
          />
          <div 
            className="h-full bg-amber-500"
            style={{ width: `${((weight - leanMass) / weight) * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] mt-1">
          <span className="text-cyan-400">Lean: {leanMass.toFixed(1)}kg</span>
          <span className="text-amber-400">Fat: {(weight - leanMass).toFixed(1)}kg</span>
        </div>
      </div>
    )}
  </div>
</div>

{/* Row 2: Measurements Card */}
<div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
  {/* ... existing measurements content ... */}
</div>

{/* Row 3: BMI + Body Fat - Full width (existing purple card) */}
<div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-xl p-4 border border-purple-500/20">
  {/* ... existing BMI + Body Fat content ... */}
</div>
```

---

### TASK 4: Calculate Sleep Data from Apple Health

Make sure sleep data is being extracted and calculated:
```javascript
// In the data processing/normalization:
const calculateSleepData = (appleHealth) => {
  const sleepRecords = appleHealth?.sleepRecords || [];
  
  if (sleepRecords.length === 0) {
    return {
      avgHours: 0,
      lastNight: 0,
      debt: 0,
      consistency: 0,
    };
  }
  
  // Sort by date (newest first)
  const sorted = sleepRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // Last 7 days for average
  const last7Days = sorted.slice(0, 7);
  const avgHours = last7Days.reduce((sum, r) => sum + (r.hours || r.value || 0), 0) / last7Days.length;
  
  // Last night
  const lastNight = sorted[0]?.hours || sorted[0]?.value || 0;
  
  // Sleep debt (ideal is 7.5 hours)
  const idealSleep = 7.5;
  const debt = Math.max(0, (idealSleep * 7) - last7Days.reduce((sum, r) => sum + (r.hours || r.value || 0), 0)) / 7;
  
  // Consistency (standard deviation based)
  const mean = avgHours;
  const variance = last7Days.reduce((sum, r) => sum + Math.pow((r.hours || r.value || 0) - mean, 2), 0) / last7Days.length;
  const stdDev = Math.sqrt(variance);
  // Lower stdDev = more consistent. 0 stdDev = 100%, 2+ stdDev = ~50%
  const consistency = Math.max(0, Math.min(1, 1 - (stdDev / 2)));
  
  return {
    avgHours,
    lastNight,
    debt,
    consistency,
  };
};

// Use in component:
const sleepData = useMemo(() => calculateSleepData(data?.appleHealth), [data?.appleHealth]);
```

---

### TASK 5: Import Moon Icon
```jsx
import { Moon } from 'lucide-react';
```

## Task 6 - NEED FIX: Mobile Cardio Data Not Displaying (Desktop Works Fine)



### CRITICAL DIAGNOSTIC: Find why mobile shows different data than desktop



This is a sync/caching issue. Both devices should show identical data from the same API.
```bash
ssh pi@192.168.1.73
cd ~/hit-tracker-pro

# 1. Verify the data exists on the server
docker compose exec backend cat /app/data/fitness-data.json | python3 -c "
import sys, json
d = json.load(sys.stdin)
conditioning = d.get('conditioning', [])
print(f'=== SERVER DATA ===')
print(f'Total conditioning sessions: {len(conditioning)}')
print(f'Total workouts: {len(d.get(\"workouts\", []))}')
if conditioning:
    print(f'First session type: {conditioning[0].get(\"type\")}')
    print(f'First session date: {conditioning[0].get(\"date\")}')
    print(f'Last session type: {conditioning[-1].get(\"type\")}')
"

# 2. Check API response directly
curl -s http://localhost:3001/api/data | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'=== API RESPONSE ===')
print(f'Conditioning sessions in API: {len(d.get(\"conditioning\", []))}')
print(f'Workouts in API: {len(d.get(\"workouts\", []))}')
"

# 3. Check for any CORS or mobile-specific issues
grep -n "cors\|CORS\|Access-Control" backend/server.js

# 4. Check if there are any mobile-specific responsive classes hiding content
grep -n "sm:hidden\|md:hidden\|lg:hidden\|hidden sm:\|hidden md:\|hidden lg:" src/App.jsx | head -20
```

### LIKELY CAUSES & FIXES:

**Cause 1: Mobile Safari/Chrome Caching Old Data**

The mobile browser cached an old version before data was uploaded.

**Fix:** Add cache-busting headers to API responses:
```javascript
// In backend/server.js, update the /api/data endpoint:
app.get('/api/data', (req, res) => {
  // Prevent caching
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  
  const data = readData();
  res.json(data);
});

// Also add to other API endpoints that return data
app.get('/api/sync/status', (req, res) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  // ... rest of handler
});
```

**Cause 2: Service Worker Caching (if PWA)**
```javascript
// In frontend, check if there's a service worker caching responses
// If so, update it to not cache API calls

// In service-worker.js or sw.js (if exists):
// Add API routes to network-first or no-cache list
```

**Cause 3: React State Not Updating on Mobile**

Add explicit logging to debug:
```jsx
// In App.jsx, update the data loading useEffect:
useEffect(() => {
  const loadData = async () => {
    setLoading(true);
    
    try {
      // Add timestamp to bust cache
      const timestamp = Date.now();
      const res = await fetch(`${API_BASE_URL}/data?_t=${timestamp}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (res.ok) {
        const apiData = await res.json();
        
        // DEBUG LOGGING - Remove after fixing
        console.log('=== DATA LOADED ===');
        console.log('Conditioning sessions:', apiData.conditioning?.length || 0);
        console.log('Workouts:', apiData.workouts?.length || 0);
        console.log('Device:', navigator.userAgent.includes('Mobile') ? 'MOBILE' : 'DESKTOP');
        
        const normalizedData = normalizeApiData(apiData);
        
        console.log('Normalized conditioning:', normalizedData.conditioning?.length || 0);
        
        if (normalizedData) {
          setData(normalizedData);
          setLastUpdated(new Date(normalizedData.lastSync || Date.now()));
        }
      } else {
        console.error('API response not OK:', res.status);
      }
    } catch (error) {
      console.error('Data load error:', error);
    }
    
    setLoading(false);
  };
  
  loadData();
  
  // Refresh every 30 seconds to catch updates
  const interval = setInterval(loadData, 30 * 1000);
  return () => clearInterval(interval);
}, []);
```

**Cause 4: Cardio Tab Conditional Rendering Issue**

Check if the Cardio tab has mobile-specific conditional rendering:
```jsx
// Find the Cardio tab content and ensure it renders on all devices:

// WRONG - might hide on mobile:
{!isMobile && <CardioOverview stats={cardioStats} />}

// CORRECT - always render:
<CardioOverview stats={cardioStats} />

// Also check the tab itself:
// Make sure conditioning data is passed correctly to Cardio tab
{activeTab === 'cardio' && (
  <CardioTab 
    conditioning={data.conditioning}  // Verify this is passed
    dateRange={dateRange}
  />
)}
```

**Cause 5: Data Normalization Failing Silently on Mobile**

Add defensive checks:
```jsx
const normalizeConditioning = (raw) => {
  console.log('normalizeConditioning input:', raw?.length || 'undefined');
  
  if (!raw) return [];
  if (!Array.isArray(raw)) {
    console.error('Conditioning is not an array:', typeof raw);
    return [];
  }
  
  const normalized = raw.map(session => ({
    ...session,
    activeCalories: session.activeCalories ?? session.calories ?? 0,
    avgHeartRate: session.avgHeartRate ?? session.averageHeartRate ?? 0,
    maxHeartRate: session.maxHeartRate ?? session.maximumHeartRate ?? 0,
    distance: session.distance ?? 0,
    duration: session.duration ?? 0,
  })).filter(s => s !== null);
  
  console.log('normalizeConditioning output:', normalized.length);
  return normalized;
};
```

---

### MANUAL TEST ON MOBILE

After deploying fixes, on your iPhone:

1. **Clear Safari Cache:**
   - Settings → Safari → Clear History and Website Data

2. **Force Refresh:**
   - Open the dashboard URL
   - Pull down to refresh (or tap refresh button)

3. **Check Console (if possible):**
   - Connect iPhone to Mac
   - Safari → Develop → iPhone → Select the page
   - Check console for the debug logs

4. **Test API Directly:**
   - On iPhone Safari, go to: `http://100.80.30.43:3001/api/data`
   - You should see JSON with conditioning array populated

---

### ADD PULL-TO-REFRESH FOR MOBILE
```jsx
// Add a manual refresh button visible on mobile
const RefreshButton = ({ onRefresh, loading }) => (
  <button 
    onClick={onRefresh}
    disabled={loading}
    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
    title="Refresh data"
  >
    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
  </button>
);

// In header, make sure refresh is accessible:
<header className="flex items-center justify-between p-4">
  <h1>HIT Tracker Pro</h1>
  <div className="flex items-center gap-2">
    <RefreshButton 
      onRefresh={() => {
        // Force reload data
        window.location.reload();
      }}
      loading={loading}
    />
    <MoreMenu />
  </div>
</header>
```


---

### DEPLOYMENT
```bash
git add -A
git commit -m "Feature: Smart recovery with sleep, enhanced rest/sleep card, lean mass display, phone fix"
git push origin main

ssh pi@192.168.1.73 "cd ~/hit-tracker-pro && git pull && docker compose down && docker compose up -d --build"
```

### VERIFICATION

After deployment:
1. [ ] Recovery Score now factors in sleep (check if it changes with sleep data)
2. [ ] Rest Day card is full-width with sleep analysis
3. [ ] Card color changes: Green (ready), Amber (moderate), Red (fatigued)
4. [ ] Weight card shows Lean Mass next to Weight
5. [ ] Composition bar shows Lean vs Fat breakdown
6. [ ] Sleep metrics display: Avg Sleep, Last Night, Sleep Quality, Consistency
7. [ ] Status message shows appropriate workout recommendation



