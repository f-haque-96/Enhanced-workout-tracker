I see two critical errors:

"Card is not defined" - A component is using Card but it's not imported
"CONDITIONING DATA LOST" - The normalization bug is still there

## CRITICAL FIX: "Card is not defined" Error + Conditioning Data Loss

The dashboard is broken with these errors:
1. "ReferenceError: Card is not defined" - Component using Card without import
2. "CONDITIONING DATA LOST DURING NORMALIZATION" - Data being filtered out

### STEP 1: Find and Fix Missing Card Import
```bash
ssh pi@192.168.1.73
cd ~/hit-tracker-pro

# Find which component uses Card without importing it
grep -n "const.*Card\|<Card" src/App.jsx | head -50

# Check if Card is imported at the top
head -100 src/App.jsx | grep -i "import.*card\|Card.*="

# Find the HealthScoreBodyStatsCard or similar component that's broken
grep -n "HealthScore\|BodyStats" src/App.jsx
```

**Fix Option A: If Card is a custom component, ensure it's defined:**
```jsx
// At the top of App.jsx, add or verify Card component exists:
const Card = ({ children, className = '' }) => (
  <div className={`bg-slate-800/50 rounded-xl border border-slate-700/50 ${className}`}>
    {children}
  </div>
);

const CardHeader = ({ children, className = '' }) => (
  <div className={`p-4 pb-2 ${className}`}>
    {children}
  </div>
);

const CardTitle = ({ children, className = '' }) => (
  <h3 className={`text-sm font-medium text-slate-200 ${className}`}>
    {children}
  </h3>
);

const CardContent = ({ children, className = '' }) => (
  <div className={`p-4 pt-0 ${className}`}>
    {children}
  </div>
);
```

**Fix Option B: If using shadcn/ui, add the import:**
```jsx
// At the top of App.jsx
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/card';
```

---

### STEP 2: Fix Conditioning Data Loss Bug

Find and fix the normalizeApiData function:
```bash
# Find the normalization function
grep -n "normalizeApiData\|normalizeConditioning\|conditioning.*filter\|conditioning.*map" src/App.jsx
```

**Replace the problematic normalization with this fixed version:**
```jsx
// Find normalizeApiData and replace it entirely with:

const normalizeApiData = (raw) => {
  if (!raw) {
    console.error('normalizeApiData: received null/undefined');
    return {
      workouts: [],
      conditioning: [],
      measurements: { current: {}, starting: {}, history: [] },
      appleHealth: {},
      nutrition: { dailyCalorieIntake: {} },
      routines: null,
    };
  }
  
  console.log('📥 Raw API data received:', {
    workouts: raw.workouts?.length || 0,
    conditioning: raw.conditioning?.length || 0,
    measurements: !!raw.measurements,
    appleHealth: !!raw.appleHealth,
    nutrition: !!raw.nutrition,
  });
  
  // CRITICAL: Simply pass through the data, don't over-process it!
  const result = {
    workouts: raw.workouts || [],
    conditioning: raw.conditioning || [], // DON'T filter or transform!
    measurements: raw.measurements || { current: {}, starting: {}, history: [] },
    appleHealth: raw.appleHealth || {},
    nutrition: raw.nutrition || { dailyCalorieIntake: {} },
    routines: raw.routines || null,
    lastSync: raw.lastSync,
    lastWebhook: raw.lastWebhook,
  };
  
  console.log('📤 Normalized result:', {
    workouts: result.workouts.length,
    conditioning: result.conditioning.length,
  });
  
  // REMOVE any warning about lost data since we're not transforming
  
  return result;
};
```

**Also check for any other place conditioning might be filtered:**
```bash
# Search for any conditioning filtering
grep -n "conditioning\\.filter\|conditioning\\.map\|setConditioning" src/App.jsx
```

If there's filtering elsewhere, ensure it's not removing valid data.

---

### STEP 3: Check Backend is Returning Conditioning Data
```bash
# Test the API directly
curl -s http://localhost:3001/api/data | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('Workouts:', len(d.get('workouts', [])))
print('Conditioning:', len(d.get('conditioning', [])))
if d.get('conditioning'):
    print('First conditioning:', d['conditioning'][0] if d['conditioning'] else 'None')
"
```

If conditioning is empty in the API response, the issue is in the backend data file:
```bash
# Check the data file directly
cat /app/data/fitness-data.json | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('Conditioning in file:', len(d.get('conditioning', [])))
"
```

---

### STEP 4: Quick Fix - Revert to Working State

If the above doesn't work, let's revert the problematic changes:
```bash
# Check recent commits
git log --oneline -10

# If needed, revert to last working state
git diff HEAD~1 src/App.jsx | head -200

# Or reset specific file
git checkout HEAD~1 -- src/App.jsx
git add src/App.jsx
git commit -m "Revert: Restore working App.jsx"
git push origin main
```

---

### STEP 5: Rebuild and Test
```bash
# Rebuild
docker compose down
docker compose up -d --build

# Wait for build
sleep 30

# Check logs for errors
docker compose logs frontend --tail=50
docker compose logs backend --tail=50

# Test in browser
echo "Test at: http://100.80.30.43:8080"
```

---

### VERIFICATION

After fix:
1. [ ] Page loads without errors
2. [ ] Console shows no "Card is not defined" error
3. [ ] Console shows no "CONDITIONING DATA LOST" error
4. [ ] Cardio tab shows conditioning sessions
5. [ ] All other tabs work correctly

Quick Diagnostic
Can you run these commands and share the output?
bashssh pi@192.168.1.73
cd ~/hit-tracker-pro

# 1. Check if Card is defined
grep -n "^const Card\|^function Card\|Card.*=.*(" src/App.jsx | head -5

# 2. Check what's in the API response
curl -s http://localhost:3001/api/data | python3 -c "import sys,json; d=json.load(sys.stdin); print('workouts:', len(d.get('workouts',[])), 'conditioning:', len(d.get('conditioning',[])))"

# 3. Check recent git changes
git log --oneline -5

# 4. Check for syntax errors in App.jsx
head -50 src/App.jsx