## FIX: Dropdown Cut Off + Wrong Workout Data Filtering

### ISSUE 1: Dropdown Being Cut Off

The dropdown is still being hidden. This is usually caused by:
- Parent element has `overflow: hidden` or `overflow-x: auto`
- z-index not high enough
- Dropdown rendered inside a container that clips it

**Find and fix the overflow issue:**
```bash
ssh pi@192.168.1.73
cd ~/hit-tracker-pro

# Search for overflow settings that might clip the dropdown
grep -n "overflow" src/App.jsx | head -20
```

**Fix: Move dropdown to use a Portal (renders outside parent container):**
```jsx
import { createPortal } from 'react-dom';

// In RoutineTabs component, use a Portal for the dropdown:

const RoutineTabs = ({ 
  routines, 
  workouts, 
  conditioning,
  activeRoutine, 
  setActiveRoutine,
  activeSubCategory,
  setActiveSubCategory,
  onAddRoutine,
}) => {
  const [openDropdown, setOpenDropdown] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRefs = useRef({});
  
  const handleTabClick = (routineKey, event) => {
    const routine = routines[routineKey];
    const hasDropdown = routine?.subCategories?.length > 0;
    
    if (hasDropdown) {
      if (openDropdown === routineKey) {
        setOpenDropdown(null);
      } else {
        // Get button position for dropdown placement
        const rect = event.currentTarget.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
        });
        setOpenDropdown(routineKey);
      }
    } else {
      // No dropdown, just select
      setActiveRoutine(routineKey);
      setActiveSubCategory('All');
      setOpenDropdown(null);
    }
  };
  
  const handleSubCategorySelect = (routineKey, subCat) => {
    setActiveRoutine(routineKey);
    setActiveSubCategory(subCat);
    setOpenDropdown(null);
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openDropdown && !e.target.closest('.routine-dropdown')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openDropdown]);
  
  const sortedRoutines = useMemo(() => {
    return Object.entries(routines || {})
      .filter(([_, r]) => r.enabled !== false)
      .sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
  }, [routines]);
  
  // Dropdown Portal Component
  const DropdownPortal = ({ routineKey, routine }) => {
    if (openDropdown !== routineKey) return null;
    
    const colors = COLOR_MAP[routine.color] || COLOR_MAP.orange;
    
    return createPortal(
      <div 
        className="routine-dropdown fixed bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-1 min-w-[160px] z-[9999]"
        style={{ 
          top: dropdownPosition.top, 
          left: dropdownPosition.left,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* All option */}
        <button
          onClick={() => handleSubCategorySelect(routineKey, 'All')}
          className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700/50 flex justify-between items-center ${
            activeRoutine === routineKey && activeSubCategory === 'All' ? colors.text : 'text-slate-300'
          }`}
        >
          <span>All</span>
          <span className="text-xs text-slate-500">({getWorkoutCount(routineKey)})</span>
        </button>
        
        {/* Sub-categories */}
        {routine.subCategories?.map(subCat => (
          <button
            key={subCat}
            onClick={() => handleSubCategorySelect(routineKey, subCat)}
            className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700/50 flex justify-between items-center ${
              activeRoutine === routineKey && activeSubCategory === subCat ? colors.text : 'text-slate-300'
            }`}
          >
            <span>{subCat}</span>
            <span className="text-xs text-slate-500">({getWorkoutCount(routineKey, subCat)})</span>
          </button>
        ))}
      </div>,
      document.body
    );
  };
  
  return (
    <>
      <div className="flex items-center gap-1">
        {sortedRoutines.map(([key, routine]) => {
          const Icon = ICON_MAP[routine.icon] || Dumbbell;
          const colors = COLOR_MAP[routine.color] || COLOR_MAP.orange;
          const isActive = activeRoutine === key;
          const hasDropdown = routine.subCategories?.length > 0;
          const count = getWorkoutCount(key);
          
          return (
            <div key={key} className="relative routine-dropdown">
              <button
                onClick={(e) => handleTabClick(key, e)}
                className={`
                  flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium
                  transition-all duration-200 whitespace-nowrap
                  ${isActive 
                    ? `${colors.bg} ${colors.text} ${colors.border} border` 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span>{routine.name}</span>
                {hasDropdown && (
                  <ChevronDown className={`w-3 h-3 transition-transform ${openDropdown === key ? 'rotate-180' : ''}`} />
                )}
                {count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-slate-900/50' : 'bg-slate-700/50'}`}>
                    {count}
                  </span>
                )}
              </button>
              
              {/* Dropdown rendered via Portal */}
              <DropdownPortal routineKey={key} routine={routine} />
            </div>
          );
        })}
        
        {/* Add button */}
        <button
          onClick={onAddRoutine}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </>
  );
};
```

---

### ISSUE 2: Wrong Workout Data Showing (Chest when Legs selected)

The filtering logic is not working correctly. The Overview and Muscle Distribution cards are showing data from ALL workouts instead of just the filtered ones.

**Find where the data is being passed to the cards:**
```bash
grep -n "Muscle Distribution\|filteredWorkouts\|activeSubCategory" src/App.jsx | head -30
```

**Fix: Ensure filtered data is passed to ALL cards:**
```jsx
// The filtering should happen ONCE and pass filtered data to all child components

const RoutineContent = ({ 
  routine, 
  subCategory, 
  workouts, 
  conditioning,
  dateRange,
  bodyWeight,
}) => {
  // CRITICAL: Filter workouts based on routine AND sub-category
  const filteredWorkouts = useMemo(() => {
    if (!routine || !workouts) return [];
    
    const isCardio = routine.name === 'Cardio' || routine.name === 'cardio';
    if (isCardio) return []; // Cardio uses conditioning, not workouts
    
    return workouts.filter(workout => {
      const title = (workout.title || workout.name || '').toLowerCase();
      
      // If sub-category is selected (not "All"), filter by sub-category keywords
      if (subCategory && subCategory !== 'All') {
        const keywords = routine.keywords?.[subCategory] || [];
        return keywords.some(kw => title.includes(kw.toLowerCase()));
      }
      
      // If "All" selected, match any keyword in this routine
      const allKeywords = Object.values(routine.keywords || {}).flat();
      return allKeywords.some(kw => title.includes(kw.toLowerCase()));
    });
  }, [routine, subCategory, workouts]);
  
  // Filter conditioning for cardio
  const filteredConditioning = useMemo(() => {
    if (!routine || !conditioning) return [];
    
    const isCardio = routine.name === 'Cardio' || routine.name === 'cardio';
    if (!isCardio) return [];
    
    return conditioning.filter(session => {
      const type = (session.type || session.category || '').toLowerCase();
      
      if (subCategory && subCategory !== 'All') {
        const keywords = routine.keywords?.[subCategory] || [];
        return keywords.some(kw => type.includes(kw.toLowerCase()));
      }
      
      const allKeywords = Object.values(routine.keywords || {}).flat();
      return allKeywords.some(kw => type.includes(kw.toLowerCase()));
    });
  }, [routine, subCategory, conditioning]);
  
  // Calculate stats from FILTERED data only
  const stats = useMemo(() => {
    const data = filteredWorkouts;
    
    let totalSets = 0;
    let workingSets = 0;
    let warmupSets = 0;
    let failureSets = 0;
    let totalReps = 0;
    let totalVolume = 0;
    let totalCalories = 0;
    let totalHR = 0;
    let hrCount = 0;
    
    // Muscle distribution
    const muscleVolume = {};
    
    data.forEach(workout => {
      // Calories and HR from Apple Health
      if (workout.appleHealth) {
        totalCalories += workout.appleHealth.activeCalories || 0;
        if (workout.appleHealth.avgHeartRate) {
          totalHR += workout.appleHealth.avgHeartRate;
          hrCount++;
        }
      }
      
      // Process exercises
      (workout.exercises || []).forEach(exercise => {
        const exerciseName = (exercise.name || exercise.title || '').toLowerCase();
        
        // Determine muscle group
        let muscleGroup = 'Other';
        if (exerciseName.includes('chest') || exerciseName.includes('bench') || exerciseName.includes('fly') || exerciseName.includes('press') && !exerciseName.includes('shoulder')) {
          muscleGroup = 'Chest';
        } else if (exerciseName.includes('shoulder') || exerciseName.includes('delt') || exerciseName.includes('lateral') || exerciseName.includes('ohp')) {
          muscleGroup = 'Shoulders';
        } else if (exerciseName.includes('tricep')) {
          muscleGroup = 'Triceps';
        } else if (exerciseName.includes('back') || exerciseName.includes('row') || exerciseName.includes('lat') || exerciseName.includes('pull')) {
          muscleGroup = 'Back';
        } else if (exerciseName.includes('bicep') || exerciseName.includes('curl')) {
          muscleGroup = 'Biceps';
        } else if (exerciseName.includes('leg') || exerciseName.includes('squat') || exerciseName.includes('lunge') || exerciseName.includes('quad') || exerciseName.includes('hamstring') || exerciseName.includes('calf') || exerciseName.includes('glute')) {
          muscleGroup = 'Legs';
        } else if (exerciseName.includes('deadlift')) {
          muscleGroup = 'Back'; // or could be Legs
        }
        
        (exercise.sets || []).forEach(set => {
          totalSets++;
          const reps = set.reps || 0;
          const weight = set.weight_kg || set.weight || 0;
          const volume = reps * weight;
          
          totalReps += reps;
          totalVolume += volume;
          
          // Set type
          if (set.set_type === 'warmup' || set.type === 'warmup') {
            warmupSets++;
          } else if (set.set_type === 'failure' || set.type === 'failure' || set.rpe >= 10) {
            failureSets++;
            workingSets++;
          } else {
            workingSets++;
          }
          
          // Add to muscle volume
          muscleVolume[muscleGroup] = (muscleVolume[muscleGroup] || 0) + volume;
        });
      });
    });
    
    // Calculate muscle distribution percentages
    const totalMuscleVolume = Object.values(muscleVolume).reduce((a, b) => a + b, 0) || 1;
    const muscleDistribution = Object.entries(muscleVolume)
      .map(([muscle, volume]) => ({
        muscle,
        volume,
        percentage: Math.round((volume / totalMuscleVolume) * 100),
      }))
      .sort((a, b) => b.percentage - a.percentage);
    
    return {
      workouts: data.length,
      totalSets,
      workingSets,
      warmupSets,
      failureSets,
      totalReps,
      totalVolume,
      totalCalories,
      avgHR: hrCount > 0 ? Math.round(totalHR / hrCount) : 0,
      muscleDistribution,
    };
  }, [filteredWorkouts]);
  
  console.log('RoutineContent filter:', {
    routine: routine?.name,
    subCategory,
    totalWorkouts: workouts?.length,
    filteredWorkouts: filteredWorkouts.length,
    stats: stats,
  });
  
  return (
    <div className="space-y-4">
      {/* Overview Card - uses FILTERED stats */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
        <div className="text-sm font-medium text-slate-300 mb-3">Overview</div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-400">Workouts</span>
            <span className="font-medium">{stats.workouts}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Working Sets</span>
            <span className="font-medium">{stats.workingSets}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Failure Sets</span>
            <span className="font-medium text-red-400">{stats.failureSets}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Total Reps</span>
            <span className="font-medium">{stats.totalReps}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Volume</span>
            <span className="font-medium">{(stats.totalVolume / 1000).toFixed(1)}t</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Calories</span>
            <span className="font-medium">{stats.totalCalories || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Avg HR</span>
            <span className="font-medium">{stats.avgHR || 0} bpm</span>
          </div>
        </div>
        
        {/* Set Breakdown */}
        <div className="mt-4 pt-3 border-t border-slate-700/50">
          <div className="text-xs text-slate-500 mb-2">Set Breakdown</div>
          <div className="flex gap-2">
            <div className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-lg text-center">
              <div className="font-bold">{stats.warmupSets}</div>
              <div className="text-xs">Warmup</div>
            </div>
            <div className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-lg text-center">
              <div className="font-bold">{stats.workingSets}</div>
              <div className="text-xs">Working</div>
            </div>
            <div className="bg-red-500/20 text-red-400 px-3 py-1 rounded-lg text-center">
              <div className="font-bold">{stats.failureSets}</div>
              <div className="text-xs">Failure</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Muscle Distribution - uses FILTERED stats */}
      {stats.muscleDistribution.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="text-sm font-medium text-slate-300 mb-3">Muscle Distribution</div>
          <div className="space-y-2">
            {stats.muscleDistribution.map(({ muscle, percentage }) => (
              <div key={muscle}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">{muscle}</span>
                  <span className="text-slate-300">{percentage}%</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Workout Log - uses FILTERED workouts */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
        <div className="text-sm font-medium text-slate-300 mb-3">
          Workout Log ({filteredWorkouts.length})
        </div>
        {filteredWorkouts.slice(0, 10).map((workout, idx) => (
          <div key={workout.id || idx} className="py-2 border-b border-slate-700/50 last:border-0">
            <div className="font-medium">{workout.title || workout.name}</div>
            <div className="text-xs text-slate-500">
              {new Date(workout.start_time || workout.date).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric'
              })}
            </div>
          </div>
        ))}
        {filteredWorkouts.length === 0 && (
          <div className="text-center text-slate-500 py-4">
            No workouts found for this filter.
          </div>
        )}
      </div>
    </div>
  );
};
```

**Also ensure the keywords are correct for matching:**
```javascript
// Default routines should have proper keywords
const defaultRoutines = {
  ppl: {
    name: 'PPL',
    displayName: 'Push/Pull/Legs',
    icon: 'dumbbell',
    color: 'orange',
    subCategories: ['Push', 'Pull', 'Legs'],
    keywords: {
      'Push': ['push', 'chest', 'shoulder', 'tricep', 'bench', 'incline', 'ohp', 'overhead press', 'fly', 'dip'],
      'Pull': ['pull', 'back', 'bicep', 'row', 'pulldown', 'lat', 'curl', 'deadlift', 'chin'],
      'Legs': ['leg', 'squat', 'lunge', 'calf', 'hamstring', 'quad', 'glute', 'leg press', 'leg curl', 'leg extension'],
    },
    enabled: true,
    order: 1,
  },
  // ... other routines
};
```

**Debug: Add console log to see what's being filtered:**
```jsx
// In RoutineContent, add this debug log:
useEffect(() => {
  console.log('🔍 Filter Debug:', {
    routineName: routine?.name,
    subCategory,
    keywords: subCategory !== 'All' ? routine?.keywords?.[subCategory] : 'ALL',
    totalWorkouts: workouts?.length,
    filteredCount: filteredWorkouts.length,
    filteredTitles: filteredWorkouts.map(w => w.title || w.name),
  });
}, [routine, subCategory, workouts, filteredWorkouts]);
```

---

### DEPLOYMENT
```bash
git add -A
git commit -m "Fix: Dropdown portal for z-index, correct workout filtering"
git push origin main

ssh pi@192.168.1.73 "cd ~/hit-tracker-pro && git pull && docker compose down && docker compose up -d --build"
```

### VERIFICATION

After fix:
1. [ ] Click PPL dropdown - dropdown appears ABOVE the cards (not cut off)
2. [ ] Select "Legs" - Overview shows ONLY leg workout data
3. [ ] Muscle Distribution shows "Legs: 100%" (not Chest)
4. [ ] Workout Log shows only Leg Day workouts
5. [ ] Select "Push" - data changes to Push workouts
6. [ ] Calories and Avg HR show actual values (if Apple Health data exists)