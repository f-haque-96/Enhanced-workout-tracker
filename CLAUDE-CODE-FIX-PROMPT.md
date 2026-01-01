## FIX: Distance Conversion Bug, Layout Issues, Favicon

### BUG 1: Distance is in METERS, not MILES - Conversion Error

The distance showing 679 miles for an 18 min walk is wrong. The Apple Health data stores distance in METERS, but it's being displayed as if it were miles.

**Fix the distance conversion:**

Find where distance is displayed and fix the conversion:
```javascript
// Apple Health stores distance in METERS
// 679 meters = 0.42 miles (not 679 miles!)

const formatDistance = (meters) => {
  if (!meters || meters === 0) return null;
  
  const km = meters / 1000;
  const miles = meters / 1609.34;
  
  // Display in km or miles based on preference (using miles here)
  if (miles >= 1000) return `${(miles / 1000).toFixed(1)}K mi`;
  if (miles >= 10) return `${Math.round(miles)} mi`;
  if (miles >= 1) return `${miles.toFixed(1)} mi`;
  return `${miles.toFixed(2)} mi`;
};


```

**Check the Apple Health parser** - make sure it's storing distance in meters correctly:
```javascript
// In backend, when parsing Apple Health:
// distance should be in METERS
distance: workout.distance, // This should already be meters from Apple Health

// If it's storing raw value, Apple Health uses meters
// Do NOT multiply or convert when storing
```

**In the frontend, when displaying conditioning sessions:**
```jsx
// WRONG - treating meters as miles:
<span>{session.distance} mi</span>

// CORRECT - convert meters to miles:
<span>{formatDistance(session.distance)}</span>
```

---

### BUG 2: Steps Should Be on Same Row as Other Stats

Move Steps to be inline with Duration, Avg HR, Calories, Distance:
```jsx
{/* Conditioning Session Stats - All in one row */}
<div className="grid grid-cols-5 gap-2 text-center text-sm">
  <div>
    <div className="text-slate-400 text-xs">Duration</div>
    <div className="font-semibold">{Math.round(session.duration / 60)}m</div>
  </div>
  <div>
    <div className="text-slate-400 text-xs">Avg HR</div>
    <div className="font-semibold">{session.avgHeartRate || 0}</div>
  </div>
  <div>
    <div className="text-slate-400 text-xs">Calories</div>
    <div className="font-semibold">{session.activeCalories || 0}</div>
  </div>
  {session.distance > 0 && (
    <div>
      <div className="text-slate-400 text-xs">Distance</div>
      <div className="font-semibold">{formatDistance(session.distance)}</div>
    </div>
  )}
  {session.steps > 0 && (
    <div>
      <div className="text-slate-400 text-xs">Steps</div>
      <div className="font-semibold">{session.steps >= 1000 ? `${(session.steps/1000).toFixed(1)}K` : session.steps}</div>
    </div>
  )}
</div>
```

Use `grid-cols-5` when all 5 stats present, or use `flex flex-wrap justify-center gap-4` for dynamic columns.

---

### BUG 3: Weight Trend Should Be Separate Card Below BMI

Move the WeightSparkline to its own card:
```jsx
{/* Weight Trend Card - Separate card below Body Composition */}
const WeightTrendCard = ({ history }) => {
  if (!history || history.length < 2) return null;
  
  const weightData = history
    .filter(h => h.weight && h.weight > 0)
    .slice(0, 30)
    .reverse();
  
  if (weightData.length < 2) return null;
  
  const weights = weightData.map(d => d.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const latest = weights[weights.length - 1];
  const first = weights[0];
  const change = latest - first;
  
  const width = 280;
  const height = 60;
  const padding = 8;
  
  const points = weights.map((w, i) => {
    const x = padding + (i / (weights.length - 1)) * (width - padding * 2);
    const y = height - padding - ((w - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });
  
  const pathD = `M ${points.join(' L ')}`;
  const trendColor = change > 0 ? '#22c55e' : change < 0 ? '#ef4444' : '#94a3b8';
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-400" />
          Weight Trend
          <span className="text-xs text-slate-500 ml-auto">Last 30 days</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <svg width={width} height={height} className="w-full">
          <line x1={padding} y1={height/2} x2={width-padding} y2={height/2} stroke="#334155" strokeWidth="1" strokeDasharray="4"/>
          <path d={pathD} fill="none" stroke={trendColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx={parseFloat(points[points.length-1]?.split(',')[0])} cy={parseFloat(points[points.length-1]?.split(',')[1])} r="4" fill={trendColor}/>
        </svg>
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>{min.toFixed(1)} kg</span>
          <span className={`font-medium ${change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-slate-400'}`}>
            {change > 0 ? '+' : ''}{change.toFixed(1)} kg
          </span>
          <span>{max.toFixed(1)} kg</span>
        </div>
      </CardContent>
    </Card>
  );
};
```

**Place it in the layout below Body Composition card:**
```jsx
{/* Body Composition */}
<BodyCompositionCard measurements={data.measurements} />

{/* Weight Trend - Separate card */}
<WeightTrendCard history={data.measurements?.history} />
```

---

### BUG 4: Calorie Balance - Remove Decimal Points
```jsx
// WRONG:
<span>{balance.toLocaleString()}</span>
<span>{weeklyWeightChange.toFixed(2)} kg/week</span>

// CORRECT - No decimals for calories:
<span>{Math.round(consumedCalories).toLocaleString()} kcal</span>
<span>{Math.round(burnedCalories).toLocaleString()} kcal</span>
<span>{balance > 0 ? '+' : ''}{Math.round(balance).toLocaleString()} kcal</span>

// Keep 2 decimals only for weight change (small number):
<span>{weeklyWeightChange > 0 ? '+' : ''}{weeklyWeightChange.toFixed(2)} kg/week</span>
```

---

### BUG 5: Favicon 404 Error

Create or fix the favicon:
```bash
# Check if favicon exists
ls -la public/favicon.svg

# If missing, create a simple one:
cat > public/favicon.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#1e293b"/>
  <path d="M30 70 L30 30 L45 30 L45 45 L55 45 L55 30 L70 30 L70 70 L55 70 L55 55 L45 55 L45 70 Z" fill="#3b82f6"/>
</svg>
EOF
```

Also make sure index.html references it correctly:
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

---

### DEPLOYMENT
```bash
git add -A
git commit -m "Fix: distance conversion (meters to miles), steps inline, weight trend card, calorie decimals, favicon"
git push origin main

ssh pi@192.168.1.73 "cd ~/hit-tracker-pro && git pull && docker compose down && docker compose up -d --build"
```

### VERIFICATION

After deployment:
1. [ ] Walk distance shows ~0.4 mi instead of 679 mi
2. [ ] Steps are on same row as Duration, HR, Calories, Distance
3. [ ] Weight Trend is its own card below Body Composition
4. [ ] Calorie numbers have no decimals (2,150 not 2,150.00)
5. [ ] Favicon loads without 404 error