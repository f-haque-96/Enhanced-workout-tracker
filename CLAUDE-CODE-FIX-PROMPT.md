## RESTORE MISSING FEATURES from older version

The current deployed version is missing features that were working in a previous version. I need to restore:

### 1. Apple Health Data on Workout Log Cards

Each workout (Push Day, Pull Day, etc.) should show Apple Health data below the workout info:
- "❤️ Apple Health  HR: 119 avg / 151 max  Calories: 337"

Find the workout log card component and verify that it is still there and if so why it isnt being displayed.

check if this would be suitable:
```jsx
{/* Apple Health data for strength workouts */}
{workout.appleHealth && (
  <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-700/50 text-xs">
    <span className="text-pink-400 flex items-center gap-1">
      <Heart className="w-3 h-3" /> Apple Health
    </span>
    <span className="text-slate-300">
      HR: {workout.appleHealth.avgHeartRate || 0} avg / {workout.appleHealth.maxHeartRate || 0} max
    </span>
    <span className="text-slate-300">
      Calories: {workout.appleHealth.activeCalories || workout.appleHealth.calories || 0}
    </span>
  </div>
)}
```

### 2. Overview Stats from Apple Health (Push/Pull/Legs tabs)

Find out why the overview are not being populated when uploading apple health data

it is not showing:
- Avg HR
- Max HR
- Distance
- Calories
- Distance
- Avg Pace


### 3. Ensure Data Normalization Uses Correct Fields

Make sure the normalizeConditioningSession function handles both field names:
```jsx
const normalizeConditioningSession = (session) => {
  if (!session) return null;
  return {
    ...session,
    activeCalories: session.activeCalories ?? session.calories ?? 0,
    avgHeartRate: session.avgHeartRate ?? session.averageHeartRate ?? session.hr_avg ?? 0,
    maxHeartRate: session.maxHeartRate ?? session.maximumHeartRate ?? session.hr_max ?? 0,
  };
};
```

### VERIFICATION

After deploying, check:
1. Upload Apple Health XML
2. Go to Push tab → Overview should show Calories and Avg HR
3. Go to Cardio tab → Overview should show Avg HR, Max HR, Calories
4. Workout Log → Each workout should show Apple Health HR and Calories below it
5. Achievements → Key Lifts 1RM values should be properly spaced

### DEPLOYMENT
```bash
git add -A
git commit -m "Restore: Apple Health stats in overview, workout log HR/calories, fix achievements spacing"
git push origin main

ssh pi@192.168.1.73 "cd ~/hit-tracker-pro && git pull && docker compose down && docker compose up -d --build"
```