## FIX: Body Composition Layout, Weekly Insights, Mobile Tooltips

### TASK 1: Redesign Body Composition Card Layout

The Body Composition card should have this structure:

┌─────────────────────────────────────────────┐
│ ⚖️ Body Composition                         │
├─────────────────────────────────────────────┤
│ ┌─────────────┐  ┌─────────────────────────┐│
│ │ Weight      │  │ Measurements            ││
│ │ 84 kg       │  │ Waist: 35"    ↓2.1%     ││
│ │ +5.1%       │  │ Chest: 40"    ↑3.2%     ││
│ │ (blue card) │  │ Shoulders: 21" ↑1.5%    ││
│ └─────────────┘  │ (slate/gray card)       ││
│                  └─────────────────────────┘│
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │  BMI: 27.2                 Overweight   │ │
│ │                                         │ │
│ │  (purple card)                          │ │
│ │     _______________________________     │ │
│ │                                         │ │
│ │  Body Fat: 26.5%                        │ │  
│ │  ↓4.0%                                  │ │
│ └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ Weight Trend (30 days)                  │ │
│ │ ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆ (sparkline)     │ │
│ │ 80kg ────────────────────────── 84kg    │ │
│ │ +2.1kg (green if goal is bulk,          │ │
│ │         red if goal is cut)             │ │
│ │ (green/red border based on trend)       │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘

**Implement this layout in src/App.jsx:**
```jsx
const BodyCompositionCard = ({ measurements }) => {
  const current = measurements?.current || {};
  const starting = measurements?.starting || {};
  const history = measurements?.history || [];
  
  const weight = current.weight || 0;
  const bodyFat = current.bodyFat || 0;
  const waist = current.waist || 0;
  const chest = current.chest || 0;
  const shoulders = current.shoulders || 0;
  
  const height = 1.75; // meters - adjust as needed
  const bmi = weight > 0 ? (weight / (height * height)).toFixed(1) : null;
  
  const getBmiCategory = (bmi) => {
    if (!bmi) return { label: 'No data', color: 'text-slate-400' };
    if (bmi < 18.5) return { label: 'Underweight', color: 'text-blue-400' };
    if (bmi < 25) return { label: 'Normal', color: 'text-green-400' };
    if (bmi < 30) return { label: 'Overweight', color: 'text-yellow-400' };
    return { label: 'Obese', color: 'text-red-400' };
  };
  
  const bmiInfo = getBmiCategory(parseFloat(bmi));
  
  // Calculate percentage change - for measurements, DECREASE is good (cutting)
  const calcChange = (current, starting) => {
    if (!current || !starting || starting === 0) return null;
    return ((current - starting) / starting) * 100;
  };
  
  // For waist: decrease is good (green), increase is bad (red)
  // For chest/shoulders: increase is good (green), decrease is bad (red)
  const waistChange = calcChange(waist, starting.waist);
  const chestChange = calcChange(chest, starting.chest);
  const shouldersChange = calcChange(shoulders, starting.shoulders);
  const bodyFatChange = calcChange(bodyFat, starting.bodyFat);
  
  // Weight trend calculation
  const weightData = history.filter(h => h.weight && h.weight > 0).slice(0, 30).reverse();
  const hasWeightTrend = weightData.length >= 2;
  const weightTrendChange = hasWeightTrend ? weightData[weightData.length - 1].weight - weightData[0].weight : 0;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-blue-400" />
          Body Composition
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Row 1: Weight + Measurements */}
        <div className="grid grid-cols-2 gap-3">
          {/* Weight Card - Blue */}
          <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl p-4 border border-blue-500/20">
            <div className="text-xs text-blue-300 mb-1">Weight</div>
            <div className="text-2xl font-bold">{weight}<span className="text-sm text-slate-400 ml-1">kg</span></div>
            {calcChange(weight, starting.weight) !== null && (
              <div className={`text-xs mt-1 ${calcChange(weight, starting.weight) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {calcChange(weight, starting.weight) > 0 ? '+' : ''}{calcChange(weight, starting.weight).toFixed(1)}%
              </div>
            )}
          </div>
          
          {/* Measurements Card - Slate */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="text-xs text-slate-400 mb-2">Measurements</div>
            <div className="space-y-1 text-sm">
              {waist > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Waist</span>
                  <span className="flex items-center gap-1">
                    {waist}"
                    {waistChange !== null && (
                      <span className={`text-xs ${waistChange < 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {waistChange > 0 ? '↑' : '↓'}{Math.abs(waistChange).toFixed(1)}%
                      </span>
                    )}
                  </span>
                </div>
              )}
              {chest > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Chest</span>
                  <span className="flex items-center gap-1">
                    {chest}"
                    {chestChange !== null && (
                      <span className={`text-xs ${chestChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {chestChange > 0 ? '↑' : '↓'}{Math.abs(chestChange).toFixed(1)}%
                      </span>
                    )}
                  </span>
                </div>
              )}
              {shoulders > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Shoulders</span>
                  <span className="flex items-center gap-1">
                    {shoulders}"
                    {shouldersChange !== null && (
                      <span className={`text-xs ${shouldersChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {shouldersChange > 0 ? '↑' : '↓'}{Math.abs(shouldersChange).toFixed(1)}%
                      </span>
                    )}
                  </span>
                </div>
              )}
              {!waist && !chest && !shoulders && (
                <span className="text-slate-500 text-xs">No data</span>
              )}
            </div>
          </div>
        </div>
        
        {/* Row 2: BMI + Body Fat - Purple Card */}
        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-xl p-4 border border-purple-500/20">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs text-purple-300 mb-1">BMI</div>
              <div className="text-2xl font-bold">{bmi || '--'}</div>
              <div className={`text-xs ${bmiInfo.color}`}>{bmiInfo.label}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-purple-300 mb-1">Body Fat</div>
              <div className="text-2xl font-bold">{bodyFat || '--'}<span className="text-sm text-slate-400">%</span></div>
              {bodyFatChange !== null && (
                <div className={`text-xs ${bodyFatChange < 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {bodyFatChange > 0 ? '+' : ''}{bodyFatChange.toFixed(1)}%
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Row 3: Weight Trend - Color coded based on trend */}
        {hasWeightTrend && (
          <WeightTrendSection weightData={weightData} trendChange={weightTrendChange} />
        )}
        
      </CardContent>
    </Card>
  );
};

// Separate component for Weight Trend
const WeightTrendSection = ({ weightData, trendChange }) => {
  const weights = weightData.map(d => d.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  
  // Determine if trend is good or bad (assuming cutting goal - weight loss is good)
  // You can make this configurable based on user's goal
  const isGoodTrend = trendChange < 0; // For cutting: losing weight is good
  const trendColor = isGoodTrend ? 'green' : 'red';
  const borderColor = isGoodTrend ? 'border-green-500/30' : 'border-red-500/30';
  const bgColor = isGoodTrend ? 'from-green-500/10 to-green-600/5' : 'from-red-500/10 to-red-600/5';
  const lineColor = isGoodTrend ? '#22c55e' : '#ef4444';
  
  const width = 280;
  const height = 50;
  const padding = 8;
  
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
          {trendChange > 0 ? '+' : ''}{trendChange.toFixed(1)} kg
        </div>
      </div>
      <svg width={width} height={height} className="w-full">
        <line x1={padding} y1={height/2} x2={width-padding} y2={height/2} stroke="#334155" strokeWidth="1" strokeDasharray="4"/>
        <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx={parseFloat(points[points.length-1]?.split(',')[0]) || 0} cy={parseFloat(points[points.length-1]?.split(',')[1]) || 0} r="4" fill={lineColor}/>
      </svg>
      <div className="flex justify-between text-[10px] text-slate-500 mt-1">
        <span>{min.toFixed(1)} kg</span>
        <span>{max.toFixed(1)} kg</span>
      </div>
    </div>
  );
};
```

---

### TASK 2: Weekly Insights - Replace Calories with Avg Steps

In the WeeklyInsightsCard, replace the Calories card (green) with Avg Steps:
```jsx
{/* Replace the Calories card with Steps */}
{/* OLD - Remove this: */}
{/* <div className="bg-green-500/20 ...">Calories</div> */}

{/* NEW - Avg Steps card (keep it green): */}
<div className="bg-gradient-to-br from-green-500/20 to-green-600/10 rounded-xl p-3 border border-green-500/20">
  <div className="flex items-center gap-1 text-green-300 text-xs mb-1">
    <Footprints className="w-3 h-3" />
    Avg Steps
  </div>
  <div className="text-xl font-bold">
    {avgSteps >= 1000 ? `${(avgSteps / 1000).toFixed(1)}K` : avgSteps || 0}
  </div>
</div>

// Calculate avgSteps from conditioning data:
const avgSteps = useMemo(() => {
  const sessions = data.conditioning || [];
  const withSteps = sessions.filter(s => s.steps && s.steps > 0);
  if (withSteps.length === 0) return 0;
  return Math.round(withSteps.reduce((sum, s) => sum + s.steps, 0) / withSteps.length);
}, [data.conditioning]);
```

Also import Footprints icon:
```jsx
import { Footprints } from 'lucide-react';
```

---

### TASK 3: Fix Mobile Tooltip Cutoff in Key Lifts

The tooltip is being cut off on mobile. Update the Tooltip component to:
1. Detect if near screen edge
2. Adjust position to stay within viewport
3. Use smaller width on mobile
```jsx
const Tooltip = ({ children, content, position = 'top' }) => {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  
  const handleMouseEnter = () => {
    if (!triggerRef.current) return;
    
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const tooltipWidth = Math.min(250, viewportWidth - 20); // Max 250px or viewport - 20px
    const tooltipHeight = 120; // Approximate
    const padding = 10;
    
    let top, left;
    
    // Calculate position
    if (position === 'top' || position === 'bottom') {
      left = rect.left + rect.width / 2;
      
      // Adjust if would go off screen
      if (left - tooltipWidth / 2 < padding) {
        left = tooltipWidth / 2 + padding;
      } else if (left + tooltipWidth / 2 > viewportWidth - padding) {
        left = viewportWidth - tooltipWidth / 2 - padding;
      }
      
      if (position === 'top') {
        top = rect.top - padding;
        // If not enough room above, show below
        if (rect.top < tooltipHeight + padding) {
          top = rect.bottom + padding;
        }
      } else {
        top = rect.bottom + padding;
      }
    } else {
      // Left/right positioning
      top = rect.top + rect.height / 2;
      
      if (position === 'right') {
        left = rect.right + padding;
        // If would go off right edge, show left instead
        if (left + tooltipWidth > viewportWidth - padding) {
          left = rect.left - padding;
        }
      } else {
        left = rect.left - padding;
        // If would go off left edge, show right instead
        if (left - tooltipWidth < padding) {
          left = rect.right + padding;
        }
      }
    }
    
    // Ensure top doesn't go off screen
    if (top < padding) top = padding;
    if (top + tooltipHeight > viewportHeight - padding) {
      top = viewportHeight - tooltipHeight - padding;
    }
    
    setCoords({ top, left });
    setShow(true);
  };
  
  return (
    <>
      <span 
        ref={triggerRef}
        className="inline-block cursor-help"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShow(false)}
        onTouchStart={(e) => { e.preventDefault(); handleMouseEnter(); }}
        onTouchEnd={() => setTimeout(() => setShow(false), 3000)}
      >
        {children}
      </span>
      {show && createPortal(
        <div 
          ref={tooltipRef}
          className="fixed px-3 py-2 text-xs rounded-lg bg-slate-800 border border-white/20 shadow-xl pointer-events-none"
          style={{ 
            top: `${coords.top}px`, 
            left: `${coords.left}px`,
            transform: 'translate(-50%, -100%)',
            maxWidth: 'calc(100vw - 20px)',
            width: '250px',
            zIndex: 99999,
          }}
        >
          {content}
        </div>,
        document.body
      )}
    </>
  );
};
```
### TASK 4: Replacement and removal in push pull legs and cardio tabs

In cardio tab - Replace recent session with resting HR and sleep analysis card
have a card for achievemnts applicable to only cardio section and have a progress bar with it. Add another card for PR's. none of these cards are to be below the activity breakdown card 

in legs tab - remove Exercise breakdown, move recent PRs card to below the Strength Forecasts (1RM) card. Add another card for achievement applicable to legs (if there arent please create some) which have achievemt targets with a progress bar with it 0 -100%

In Pull tab - remove Exercise breakdown, move recent PRs card to below the Strength Forecasts (1RM) card (if there arent any PR's put in there No Pr's hit or put in the last Pr's until a new one is hit). Add another card for achievement applicable to Pull (if there arent please create some) which have achievemt targets with a progress bar with it 0 -100%

In Push tab - remove Exercise breakdown, move recent PRs card to below the Strength Forecasts (1RM) card. Add another card for achievements applicable to Push (if there arent please create some) which have achievemt targets with a progress bar with it 0 -100%
---

### DEPLOYMENT
```bash
git add -A
git commit -m "Redesign: Body comp layout with weight trend, steps in weekly insights, mobile tooltip fix"
git push origin main

ssh pi@192.168.1.73 "cd ~/hit-tracker-pro && git pull && docker compose down && docker compose up -d --build"
```

### VERIFICATION

After deployment:
1. [ ] Body Composition shows: Weight (blue) | Measurements (slate) in top row
2. [ ] BMI + Body Fat in purple card below
3. [ ] Weight Trend in its own section with green/red color coding
4. [ ] Weekly Insights shows "Avg Steps" instead of "Calories"
5. [ ] Mobile tooltips stay within screen bounds
6. [ ] Waist decrease shows green, Chest/Shoulders increase shows green