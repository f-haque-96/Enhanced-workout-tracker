## FIX: Mobile Cardio Data Not Displaying + Tooltip Cutoff

### ISSUE 1: Cardio Tab Shows Data on Desktop but NOT on Mobile

This is likely one of these issues:
1. Mobile browser caching old version
2. JavaScript error on mobile only
3. Data normalization failing on mobile
4. Responsive CSS hiding elements

**Diagnostic Steps:**
```bash
ssh pi@192.168.1.73
cd ~/hit-tracker-pro

# Check if there are any mobile-specific CSS issues
grep -n "hidden\|md:block\|lg:block\|sm:hidden" src/App.jsx | head -20

# Check if conditioning data exists
docker compose exec backend cat /app/data/fitness-data.json | python3 -c "
import sys, json
d = json.load(sys.stdin)
conditioning = d.get('conditioning', [])
print(f'Total conditioning sessions: {len(conditioning)}')
if conditioning:
    print('First session:')
    print(json.dumps(conditioning[0], indent=2))
    print(f'\\nLast session:')
    print(json.dumps(conditioning[-1], indent=2))
"

# Check if there are any console errors being logged
docker compose logs frontend --tail=50
```

**Likely Fix - Data Not Reaching Mobile:**

The issue is probably that mobile Safari/Chrome handles the API response differently, OR there's a responsive class hiding content.

Check for responsive visibility issues:
```jsx
// WRONG - This would hide on mobile:
<div className="hidden md:block">
  {/* Cardio stats */}
</div>

// CORRECT - Should be visible on all screens:
<div className="block">
  {/* Cardio stats */}
</div>
```

**Add explicit mobile visibility to Cardio Overview:**

Find the Cardio tab Overview section and ensure NO hiding classes:
```jsx
{/* Cardio Overview - Must be visible on ALL screen sizes */}
<div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
  <div className="text-sm font-medium text-slate-300 mb-3">Overview</div>
  <div className="space-y-2">
    {/* These must NOT have sm:hidden or hidden md:block classes */}
    <div className="flex justify-between">
      <span className="text-slate-400">Sessions</span>
      <span className="font-semibold">{cardioStats.sessions}</span>
    </div>
    <div className="flex justify-between">
      <span className="text-slate-400">Total Time</span>
      <span className="font-semibold">{formatDuration(cardioStats.totalTime)}</span>
    </div>
    <div className="flex justify-between">
      <span className="text-slate-400">Avg HR</span>
      <span className="font-semibold">{cardioStats.avgHR} bpm</span>
    </div>
    <div className="flex justify-between">
      <span className="text-slate-400">Max HR</span>
      <span className="font-semibold text-red-400">{cardioStats.maxHR} bpm</span>
    </div>
    <div className="flex justify-between">
      <span className="text-slate-400">Calories</span>
      <span className="font-semibold">{cardioStats.calories}</span>
    </div>
    {cardioStats.distance > 0 && (
      <div className="flex justify-between">
        <span className="text-slate-400">Distance</span>
        <span className="font-semibold">{formatDistance(cardioStats.distance)}</span>
      </div>
    )}
  </div>
</div>
```

**Also check the cardioStats calculation exists:**
```jsx
// Make sure this useMemo exists and calculates correctly
const cardioStats = useMemo(() => {
  const sessions = data?.conditioning || [];
  
  // Filter by date range
  const now = new Date();
  const daysMap = { '7D': 7, '30D': 30, '90D': 90, '1Y': 365, 'All': 9999 };
  const days = daysMap[dateRange] || 90;
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  
  const filtered = sessions.filter(s => {
    const sessionDate = new Date(s.date);
    return sessionDate >= startDate;
  });
  
  console.log('Cardio stats calculation:', { 
    totalSessions: sessions.length, 
    filteredSessions: filtered.length,
    dateRange 
  }); // Debug log
  
  const withHR = filtered.filter(s => (s.avgHeartRate || 0) > 0);
  
  return {
    sessions: filtered.length,
    totalTime: filtered.reduce((sum, s) => sum + (s.duration || 0), 0),
    avgHR: withHR.length > 0 
      ? Math.round(withHR.reduce((sum, s) => sum + s.avgHeartRate, 0) / withHR.length) 
      : 0,
    maxHR: Math.max(...filtered.map(s => s.maxHeartRate || 0), 0),
    calories: Math.round(filtered.reduce((sum, s) => sum + (s.activeCalories || s.calories || 0), 0)),
    distance: filtered.reduce((sum, s) => sum + (s.distance || 0), 0),
  };
}, [data?.conditioning, dateRange]);
```

---

### ISSUE 2: Tooltip Still Being Cut Off on Mobile

The tooltip fix from before isn't working. Let's use a completely different approach - a **modal/popover** style that's centered on mobile:
```jsx
const Tooltip = ({ children, content, position = 'top' }) => {
  const [show, setShow] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  
  useEffect(() => {
    // Detect mobile
    setIsMobile(window.innerWidth < 640);
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const handleOpen = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      if (isMobile) {
        // Center on screen for mobile
        setCoords({
          top: viewportHeight / 2,
          left: viewportWidth / 2,
        });
      } else {
        // Position near element for desktop
        let top = rect.top - 10;
        let left = rect.left + rect.width / 2;
        
        // Keep within viewport
        const tooltipWidth = 250;
        if (left - tooltipWidth/2 < 10) left = tooltipWidth/2 + 10;
        if (left + tooltipWidth/2 > viewportWidth - 10) left = viewportWidth - tooltipWidth/2 - 10;
        if (top < 100) top = rect.bottom + 10;
        
        setCoords({ top, left });
      }
    }
    setShow(true);
  };
  
  const handleClose = () => setShow(false);
  
  return (
    <>
      <span 
        ref={triggerRef}
        className="inline-block cursor-help"
        onMouseEnter={!isMobile ? handleOpen : undefined}
        onMouseLeave={!isMobile ? handleClose : undefined}
        onClick={isMobile ? handleOpen : undefined}
      >
        {children}
      </span>
      
      {show && createPortal(
        <>
          {/* Backdrop for mobile */}
          {isMobile && (
            <div 
              className="fixed inset-0 bg-black/50 z-[99998]"
              onClick={handleClose}
            />
          )}
          
          {/* Tooltip content */}
          <div 
            className={`fixed z-[99999] bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-4 ${
              isMobile 
                ? 'w-[90vw] max-w-[320px] -translate-x-1/2 -translate-y-1/2' 
                : 'w-[250px] -translate-x-1/2 -translate-y-full'
            }`}
            style={{ 
              top: `${coords.top}px`, 
              left: `${coords.left}px`,
            }}
            onClick={isMobile ? handleClose : undefined}
          >
            {/* Close button for mobile */}
            {isMobile && (
              <button 
                className="absolute top-2 right-2 text-slate-400 hover:text-white"
                onClick={handleClose}
              >
                <X className="w-4 h-4" />
              </button>
            )}
            
            <div className="text-sm">{content}</div>
            
            {isMobile && (
              <div className="text-xs text-slate-500 mt-2 text-center">Tap to close</div>
            )}
          </div>
        </>,
        document.body
      )}
    </>
  );
};
```

**Import X icon:**
```jsx
import { X } from 'lucide-react';
```

This approach:
- On **desktop**: Works like normal tooltip (hover to show)
- On **mobile**: Tap to open, shows centered modal with backdrop, tap anywhere to close
- **Never gets cut off** because it's centered on mobile

---
### Task 3: Achievement adjustment

Implement rolling achievement milestones across ALL sections (Cardio + Push/Pull/Legs) so that when a milestone is achieved, it is recorded and the next target automatically increases.

Requirements:
1) Achievement targets must not “stop” after being reached. When currentValue >= target:
   - mark milestone as earned
   - append it to milestone history with {achievementId, target, achievedAt, valueAtAchieve}
   - advance target to the next milestone (use a milestone ladder where defined; otherwise use a scaling function that generates clean “nice” values).

2) Marathon example:
   - Marathon distance milestone = 26 mi.
   - Once reached, next milestone should become 40mi and continue increasing afterward.
   - Define a sensible ladder for cardio distance (e.g. 5k, 10k, half, marathon, 60k, 80k, 100k...), and then optionally scale further always round numbers no decimal points.

3) Unit handling:
   - Display cardio distances in MILES by default (with correct conversion: miles = meters / 1609.344).
   - Ensure the same values render on PC and iPhone; avoid any device-specific local calculations causing drift.

4) UI changes:
   - Apply rolling milestone logic to every achievement card (Cardio + Push/Pull/Legs).
   - Add a “Personal Records” card to Push, Pull, and Legs (Cardio already has one).
   - Personal Records must include a section listing milestone history (at least last 3 milestones earned + total count, with dates) and other achievements/ records.

5) Achievements top panel improvements:
   - Keep the existing Key Lifts (1RM) row.
   - Update “Earned” to show the most recent earned achievements (last 3).
   - Add a “Next Up” spotlight for the closest upcoming achievement or integrate this with "in progress".
   - Optionally add small trend deltas (e.g. 30d change) to key lifts.

6) Consistency and data source:
   - Achievements calculations should be derived from a single source-of-truth (preferably backend API), not local-only state.
   - The same achievements and cardio stats must appear consistently across desktop and iPhone.
   - Avoid relying on localStorage-only state for computed achievements.


### DEPLOYMENT
```bash
git add -A
git commit -m "Fix: Mobile cardio data sync, tooltip modal for mobile"
git push origin main

ssh pi@192.168.1.73 "cd ~/hit-tracker-pro && git pull && docker compose down && docker compose up -d --build"
```

### VERIFICATION

After deployment, on your iPhone:
1. [ ] Hard refresh Safari: Hold refresh button → "Request Desktop Site" then back to mobile
2. [ ] Or clear Safari cache: Settings → Safari → Clear History and Website Data
3. [ ] Check Cardio tab shows: Sessions, Total Time, Avg HR, Max HR, Calories
4. [ ] Tap on a Key Lift info icon → Tooltip should appear centered as modal
5. [ ] Tap backdrop or tooltip to close

**If still not working on mobile**, open Safari Developer Tools (connect iPhone to Mac) and check for JavaScript errors in the console.