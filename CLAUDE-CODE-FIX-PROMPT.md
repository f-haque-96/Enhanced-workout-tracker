## TASK 4: Tab Redesigns + Waist from Apple Health

### PRIORITY: Check Apple Health for Waist Circumference First

Before the tab redesigns, check if Apple Health export contains waist data:
```bash
ssh pi@192.168.1.73
cd ~/hit-tracker-pro

# Check if waist circumference exists in Apple Health
docker compose logs backend --tail=500 | grep -i "waist\|circumference\|HKQuantityTypeIdentifierWaistCircumference"

# Check what body measurement types Apple Health has
grep -n "HKQuantityTypeIdentifier" backend/apple-health-parser.js 2>/dev/null | head -30
grep -n "HKQuantityTypeIdentifier" backend/server.js | head -30
```

**If waist exists in Apple Health, add extraction:**
```javascript
// In apple-health-parser.js or server.js, add:

// Waist Circumference (Apple Health stores in cm)
if (line.includes('HKQuantityTypeIdentifierWaistCircumference') && line.includes('value=')) {
  const record = parseHealthRecord(line, 'waist');
  if (record) {
    results.waistRecords = results.waistRecords || [];
    results.waistRecords.push(record);
    results.stats.waistRecordsFound = (results.stats.waistRecordsFound || 0) + 1;
  }
}

// When processing, convert cm to inches if needed:
const latestWaist = results.waistRecords?.length > 0 
  ? results.waistRecords.sort((a, b) => new Date(b.date) - new Date(a.date))[0].value
  : null;

// Apple Health priority for waist:
data.measurements.current.waist = latestWaist ?? hevyWaist ?? existingWaist;
data.measurements.sources.waist = latestWaist ? 'Apple Health' : 'Hevy';
```

---

### CARDIO TAB REDESIGN

**Remove:** Recent Sessions card (or move below Activity Breakdown)

**Add:** 
1. Resting HR & Sleep Analysis Card
2. Cardio Achievements Card with progress bars
3. Cardio PRs Card
```jsx
// Cardio-specific components

const CardioHealthCard = ({ appleHealth, conditioning }) => {
  const restingHR = appleHealth?.restingHeartRate || 0;
  const sleepAvg = appleHealth?.sleepAvg || 0;
  
  // Calculate HR zones from conditioning
  const avgSessionHR = conditioning?.length > 0
    ? Math.round(conditioning.reduce((sum, c) => sum + (c.avgHeartRate || 0), 0) / conditioning.filter(c => c.avgHeartRate > 0).length)
    : 0;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Heart className="w-4 h-4 text-red-400" />
          Health Metrics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
            <div className="text-xs text-red-300">Resting HR</div>
            <div className="text-xl font-bold">{restingHR} <span className="text-sm text-slate-400">bpm</span></div>
            <div className="text-xs text-slate-500">{restingHR < 60 ? 'Excellent' : restingHR < 70 ? 'Good' : 'Average'}</div>
          </div>
          <div className="bg-indigo-500/10 rounded-lg p-3 border border-indigo-500/20">
            <div className="text-xs text-indigo-300">Avg Sleep</div>
            <div className="text-xl font-bold">{sleepAvg.toFixed(1)} <span className="text-sm text-slate-400">hrs</span></div>
            <div className="text-xs text-slate-500">{sleepAvg >= 7 ? 'Optimal' : sleepAvg >= 6 ? 'Adequate' : 'Low'}</div>
          </div>
        </div>
        {avgSessionHR > 0 && (
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-xs text-slate-400">Avg Workout HR</div>
            <div className="text-lg font-bold">{avgSessionHR} bpm</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const CardioAchievementsCard = ({ conditioning }) => {
  // Calculate cardio achievements
  const totalDistance = conditioning?.reduce((sum, c) => sum + (c.distance || 0), 0) / 1000 || 0; // km
  const totalSessions = conditioning?.length || 0;
  const totalCalories = conditioning?.reduce((sum, c) => sum + (c.activeCalories || c.calories || 0), 0) || 0;
  const longestSession = Math.max(...(conditioning?.map(c => c.duration || 0) || [0])) / 60; // minutes
  
  const achievements = [
    { 
      name: 'Marathon Distance', 
      target: 42.2, 
      current: totalDistance, 
      unit: 'km',
      icon: '🏃'
    },
    { 
      name: '100 Sessions', 
      target: 100, 
      current: totalSessions, 
      unit: 'sessions',
      icon: '🎯'
    },
    { 
      name: '10K Calories Burned', 
      target: 10000, 
      current: totalCalories, 
      unit: 'kcal',
      icon: '🔥'
    },
    { 
      name: '60 Min Session', 
      target: 60, 
      current: longestSession, 
      unit: 'min',
      icon: '⏱️'
    },
  ];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Trophy className="w-4 h-4 text-amber-400" />
          Cardio Achievements
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
                </span>
                <span className="text-slate-400">
                  {ach.current.toFixed(1)}/{ach.target} {ach.unit}
                </span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${isComplete ? 'bg-amber-400' : 'bg-blue-500'}`}
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

const CardioPRsCard = ({ conditioning }) => {
  // Calculate PRs from conditioning data
  const prs = {
    longestRun: conditioning?.filter(c => c.category === 'running').sort((a, b) => (b.distance || 0) - (a.distance || 0))[0],
    fastestPace: conditioning?.filter(c => c.pace && c.pace > 0).sort((a, b) => a.pace - b.pace)[0],
    mostCalories: conditioning?.sort((a, b) => (b.activeCalories || b.calories || 0) - (a.activeCalories || a.calories || 0))[0],
    longestSwim: conditioning?.filter(c => c.category === 'swimming').sort((a, b) => (b.distance || 0) - (a.distance || 0))[0],
  };
  
  const formatPace = (seconds) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Medal className="w-4 h-4 text-yellow-400" />
          Personal Records
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {prs.longestRun && (
          <div className="flex justify-between text-sm py-1 border-b border-slate-700/50">
            <span className="text-slate-400">🏃 Longest Run</span>
            <span className="font-medium">{((prs.longestRun.distance || 0) / 1000).toFixed(2)} km</span>
          </div>
        )}
        {prs.fastestPace && (
          <div className="flex justify-between text-sm py-1 border-b border-slate-700/50">
            <span className="text-slate-400">⚡ Fastest Pace</span>
            <span className="font-medium">{formatPace(prs.fastestPace.pace)} /km</span>
          </div>
        )}
        {prs.mostCalories && (
          <div className="flex justify-between text-sm py-1 border-b border-slate-700/50">
            <span className="text-slate-400">🔥 Most Calories</span>
            <span className="font-medium">{prs.mostCalories.activeCalories || prs.mostCalories.calories} kcal</span>
          </div>
        )}
        {prs.longestSwim && (
          <div className="flex justify-between text-sm py-1">
            <span className="text-slate-400">🏊 Longest Swim</span>
            <span className="font-medium">{((prs.longestSwim.distance || 0)).toFixed(0)} m</span>
          </div>
        )}
        {!prs.longestRun && !prs.fastestPace && !prs.mostCalories && (
          <div className="text-slate-500 text-sm text-center py-2">No PRs recorded yet</div>
        )}
      </CardContent>
    </Card>
  );
};
```

**Cardio Tab Layout Order:**
1. Overview
2. CardioHealthCard (Resting HR + Sleep)
3. CardioAchievementsCard
4. CardioPRsCard
5. Activity Breakdown
6. Heart Rate Trend
7. Workout Log (Recent Sessions moved here)

---

### PUSH/PULL/LEGS TAB REDESIGN

**Remove:** Exercise Breakdown card from all three tabs

**Add:** Category-specific achievements with progress bars

**Reorder:** Recent PRs below Strength Forecasts
```jsx
// Strength Achievement Card - Reusable for Push/Pull/Legs
const StrengthAchievementsCard = ({ category, workouts, keyLifts }) => {
  // Define achievements per category
  const achievementsByCategory = {
    push: [
      { name: '1x BW Bench Press', targetMultiplier: 1.0, lift: 'Incline Bench Press', icon: '🏋️' },
      { name: '0.75x BW OHP', targetMultiplier: 0.75, lift: 'Shoulder Press', icon: '💪' },
      { name: '100 Push Workouts', target: 100, type: 'workouts', icon: '📈' },
      { name: '1000 Working Sets', target: 1000, type: 'sets', icon: '🎯' },
    ],
    pull: [
      { name: '1.5x BW Deadlift', targetMultiplier: 1.5, lift: 'Deadlift', icon: '🏋️' },
      { name: '1x BW Lat Pulldown', targetMultiplier: 1.0, lift: 'Lat Pulldown', icon: '💪' },
      { name: '50 Pull Workouts', target: 50, type: 'workouts', icon: '📈' },
      { name: '10 Pull-up Reps', target: 10, type: 'pullups', icon: '🎯' },
    ],
    legs: [
      { name: '2x BW Squat', targetMultiplier: 2.0, lift: 'Squat', icon: '🏋️' },
      { name: '2.5x BW Deadlift', targetMultiplier: 2.5, lift: 'Deadlift', icon: '💪' },
      { name: '50 Leg Workouts', target: 50, type: 'workouts', icon: '📈' },
      { name: '500kg Total', target: 500, type: 'total', icon: '🎯' },
    ],
  };
  
  const achievements = achievementsByCategory[category] || [];
  const bodyweight = 84; // Get from measurements or default
  
  // Calculate progress for each achievement
  const calculateProgress = (ach) => {
    if (ach.type === 'workouts') {
      const count = workouts?.filter(w => w.category?.toLowerCase() === category).length || 0;
      return { current: count, target: ach.target };
    }
    if (ach.type === 'sets') {
      const sets = workouts?.reduce((sum, w) => sum + (w.totalSets || 0), 0) || 0;
      return { current: sets, target: ach.target };
    }
    if (ach.type === 'total') {
      const total = keyLifts?.reduce((sum, l) => sum + (l.estimated1RM || 0), 0) || 0;
      return { current: total, target: ach.target };
    }
    if (ach.targetMultiplier && ach.lift) {
      const lift = keyLifts?.find(l => l.name?.includes(ach.lift));
      const current1RM = lift?.estimated1RM || 0;
      const target1RM = bodyweight * ach.targetMultiplier;
      return { current: current1RM, target: target1RM };
    }
    return { current: 0, target: 100 };
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Trophy className="w-4 h-4 text-amber-400" />
          {category.charAt(0).toUpperCase() + category.slice(1)} Achievements
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {achievements.map((ach, idx) => {
          const { current, target } = calculateProgress(ach);
          const progress = Math.min((current / target) * 100, 100);
          const isComplete = progress >= 100;
          return (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span>{ach.icon}</span>
                  <span className={isComplete ? 'text-amber-400' : 'text-slate-300'}>{ach.name}</span>
                  {isComplete && <span className="text-green-400">✓</span>}
                </span>
                <span className="text-slate-400 text-xs">
                  {current.toFixed(0)}/{target.toFixed(0)}
                </span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${isComplete ? 'bg-amber-400' : category === 'push' ? 'bg-orange-500' : category === 'pull' ? 'bg-blue-500' : 'bg-purple-500'}`}
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

// Recent PRs Card - Show "No PRs" if empty
const RecentPRsCard = ({ prs, category }) => {
  const categoryPRs = prs?.filter(pr => pr.category?.toLowerCase() === category) || [];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Medal className="w-4 h-4 text-yellow-400" />
          Recent PRs
        </CardTitle>
      </CardHeader>
      <CardContent>
        {categoryPRs.length > 0 ? (
          <div className="space-y-2">
            {categoryPRs.slice(0, 5).map((pr, idx) => (
              <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-700/50 last:border-0">
                <div>
                  <div className="text-sm font-medium">{pr.exercise}</div>
                  <div className="text-xs text-slate-500">{pr.date}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-amber-400">{pr.weight}kg × {pr.reps}</div>
                  <div className="text-xs text-slate-500">1RM: {pr.estimated1RM?.toFixed(1)}kg</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="text-slate-500 text-sm">No PRs hit yet</div>
            <div className="text-slate-600 text-xs mt-1">Keep pushing to set new records!</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

**Push/Pull/Legs Tab Layout Order:**
1. Overview (with Calories, Avg HR from Apple Health)
2. Volume Trend
3. Strength Forecasts (1RM)
4. RecentPRsCard (moved here, below Strength Forecasts)
5. StrengthAchievementsCard (new)
6. Muscle Distribution
7. Workout Log

**REMOVE from all three tabs:** Exercise Breakdown card

---

### DEPLOYMENT
```bash
git add -A
git commit -m "Redesign: Tab layouts, cardio health/achievements/PRs, strength achievements, waist from Apple Health"
git push origin main

ssh pi@192.168.1.73 "cd ~/hit-tracker-pro && git pull && docker compose down && docker compose up -d --build"
```

### VERIFICATION

After deployment:
1. [ ] Cardio tab: Shows Resting HR + Sleep card, Achievements with progress, PRs
2. [ ] Push tab: No Exercise Breakdown, PRs below Strength Forecasts, Push Achievements
3. [ ] Pull tab: No Exercise Breakdown, PRs below Strength Forecasts, Pull Achievements  
4. [ ] Legs tab: No Exercise Breakdown, PRs below Strength Forecasts, Legs Achievements
5. [ ] All achievement progress bars work 0-100%
6. [ ] Waist measurement uses Apple Health if available
7. [ ] "No PRs hit yet" shows if no PRs exist