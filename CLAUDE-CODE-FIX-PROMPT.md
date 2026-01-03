## FIX: Tabs Not Switching + Dropdowns Not Opening

The tab system is broken:
1. Cannot switch between tabs (clicking PPL when on Cali doesn't work)
2. Dropdowns don't open when clicking tabs with sub-categories
3. UI appears frozen on selected tab

### STEP 1: Debug Current State
```bash
ssh pi@192.168.1.73
cd ~/hit-tracker-pro

# Check the RoutineTabs component
grep -n "handleTabClick\|setActiveRoutine\|openDropdown" src/App.jsx | head -30

# Check for click handler issues
grep -n "onClick.*handleTabClick\|onClick.*setActive" src/App.jsx | head -20
```

### STEP 2: Fix the Tab Click Handler

The issue is likely in the click handler logic. Replace the RoutineTabs component with this fixed version:
```jsx
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
  
  // Sort routines by order
  const sortedRoutines = useMemo(() => {
    if (!routines) return [];
    return Object.entries(routines)
      .filter(([_, r]) => r && r.enabled !== false)
      .sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
  }, [routines]);
  
  // Count workouts for a routine/subcategory
  const getWorkoutCount = useCallback((routineKey, subCategory = null) => {
    const routine = routines?.[routineKey];
    if (!routine) return 0;
    
    const isCardio = routineKey === 'cardio';
    const data = isCardio ? (conditioning || []) : (workouts || []);
    
    return data.filter(w => {
      const title = (w.title || w.name || w.type || '').toLowerCase();
      
      if (subCategory && subCategory !== 'All') {
        const keywords = routine.keywords?.[subCategory] || [];
        return keywords.some(kw => title.includes(kw.toLowerCase()));
      }
      
      const allKeywords = Object.values(routine.keywords || {}).flat();
      return allKeywords.some(kw => title.includes(kw.toLowerCase()));
    }).length;
  }, [routines, workouts, conditioning]);
  
  // Handle tab click - FIXED VERSION
  const handleTabClick = useCallback((routineKey, event) => {
    event.stopPropagation(); // Prevent event bubbling
    
    const routine = routines?.[routineKey];
    const hasDropdown = routine?.subCategories && routine.subCategories.length > 0;
    
    console.log('Tab clicked:', { routineKey, hasDropdown, currentActive: activeRoutine, currentDropdown: openDropdown });
    
    if (hasDropdown) {
      // Tab has dropdown
      if (activeRoutine === routineKey) {
        // Already on this tab - toggle dropdown
        if (openDropdown === routineKey) {
          setOpenDropdown(null);
        } else {
          // Open dropdown
          const rect = event.currentTarget.getBoundingClientRect();
          setDropdownPosition({
            top: rect.bottom + 4,
            left: rect.left,
          });
          setOpenDropdown(routineKey);
        }
      } else {
        // Switching to this tab
        setActiveRoutine(routineKey);
        setActiveSubCategory('All');
        // Open dropdown immediately
        const rect = event.currentTarget.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 4,
          left: rect.left,
        });
        setOpenDropdown(routineKey);
      }
    } else {
      // Tab without dropdown (like Cali)
      setActiveRoutine(routineKey);
      setActiveSubCategory('All');
      setOpenDropdown(null);
    }
  }, [routines, activeRoutine, openDropdown, setActiveRoutine, setActiveSubCategory]);
  
  // Handle sub-category selection
  const handleSubCategorySelect = useCallback((routineKey, subCat) => {
    console.log('SubCategory selected:', { routineKey, subCat });
    setActiveRoutine(routineKey);
    setActiveSubCategory(subCat);
    setOpenDropdown(null);
  }, [setActiveRoutine, setActiveSubCategory]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Don't close if clicking on a tab button or dropdown
      if (event.target.closest('.routine-tab-btn') || event.target.closest('.routine-dropdown-menu')) {
        return;
      }
      setOpenDropdown(null);
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const ICON_MAP = {
    'dumbbell': Dumbbell,
    'user': User,
    'heart': Heart,
    'person-standing': User, // Fallback if PersonStanding not available
  };
  
  const COLOR_MAP = {
    'orange': { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
    'blue': { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
    'cyan': { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30' },
    'green': { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
    'purple': { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
    'red': { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  };
  
  return (
    <div className="relative">
      {/* Tab Buttons Row */}
      <div className="flex items-center gap-2 flex-wrap">
        {sortedRoutines.map(([key, routine]) => {
          const Icon = ICON_MAP[routine.icon] || Dumbbell;
          const colors = COLOR_MAP[routine.color] || COLOR_MAP.orange;
          const isActive = activeRoutine === key;
          const hasDropdown = routine.subCategories && routine.subCategories.length > 0;
          const count = getWorkoutCount(key);
          const isDropdownOpen = openDropdown === key;
          
          return (
            <div key={key} className="relative">
              {/* Tab Button */}
              <button
                className={`
                  routine-tab-btn
                  flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium
                  transition-all duration-200 whitespace-nowrap cursor-pointer
                  ${isActive 
                    ? `${colors.bg} ${colors.text} ${colors.border} border` 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                  }
                `}
                onClick={(e) => handleTabClick(key, e)}
              >
                <Icon className="w-4 h-4" />
                <span>{routine.name}</span>
                {hasDropdown && (
                  <ChevronDown 
                    className={`w-3 h-3 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} 
                  />
                )}
                {count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ml-1 ${
                    isActive ? 'bg-slate-900/50' : 'bg-slate-700/50'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
              
              {/* Dropdown Menu - Rendered inline with high z-index */}
              {hasDropdown && isDropdownOpen && (
                <div 
                  className="routine-dropdown-menu absolute top-full left-0 mt-1 z-[9999] bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-1 min-w-[160px]"
                  style={{ 
                    position: 'fixed',
                    top: dropdownPosition.top,
                    left: dropdownPosition.left,
                  }}
                >
                  {/* All Option */}
                  <button
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-700/50 flex justify-between items-center transition-colors ${
                      activeSubCategory === 'All' ? `${colors.text} font-medium` : 'text-slate-300'
                    }`}
                    onClick={() => handleSubCategorySelect(key, 'All')}
                  >
                    <span className="flex items-center gap-2">
                      {activeSubCategory === 'All' && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                      All
                    </span>
                    <span className="text-xs text-slate-500">{getWorkoutCount(key)}</span>
                  </button>
                  
                  {/* Divider */}
                  <div className="border-t border-slate-700 my-1" />
                  
                  {/* Sub-categories */}
                  {routine.subCategories.map(subCat => (
                    <button
                      key={subCat}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-700/50 flex justify-between items-center transition-colors ${
                        activeSubCategory === subCat ? `${colors.text} font-medium` : 'text-slate-300'
                      }`}
                      onClick={() => handleSubCategorySelect(key, subCat)}
                    >
                      <span className="flex items-center gap-2">
                        {activeSubCategory === subCat && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                        {subCat}
                      </span>
                      <span className="text-xs text-slate-500">{getWorkoutCount(key, subCat)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        
        {/* Add Routine Button */}
        <button
          className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors border border-transparent"
          onClick={onAddRoutine}
          title="Add new routine"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      
      {/* Active Filter Indicator */}
      {activeSubCategory && activeSubCategory !== 'All' && (
        <div className="flex items-center gap-2 mt-2 text-xs">
          <span className="text-slate-500">Filtering:</span>
          <span className={`px-2 py-1 rounded-full ${COLOR_MAP[routines[activeRoutine]?.color]?.bg || 'bg-slate-700'} ${COLOR_MAP[routines[activeRoutine]?.color]?.text || 'text-slate-300'}`}>
            {activeSubCategory}
          </span>
          <button 
            onClick={() => setActiveSubCategory('All')}
            className="text-slate-500 hover:text-slate-300 ml-1"
          >
            ✕ Clear
          </button>
        </div>
      )}
    </div>
  );
};
```

### STEP 3: Ensure State is Properly Initialized

In the main App component, make sure the state is correctly set up:
```jsx
// At the top of App component
const [activeRoutine, setActiveRoutine] = useState('ppl');
const [activeSubCategory, setActiveSubCategory] = useState('All');
const [showAddRoutineModal, setShowAddRoutineModal] = useState(false);

// Default routines
const defaultRoutines = {
  ppl: {
    name: 'PPL',
    displayName: 'Push/Pull/Legs',
    icon: 'dumbbell',
    color: 'orange',
    subCategories: ['Push', 'Pull', 'Legs'],
    keywords: {
      'Push': ['push', 'chest', 'shoulder', 'tricep', 'bench', 'incline', 'ohp', 'press', 'fly', 'dip'],
      'Pull': ['pull', 'back', 'bicep', 'row', 'pulldown', 'lat', 'curl', 'deadlift'],
      'Legs': ['leg', 'squat', 'lunge', 'calf', 'hamstring', 'quad', 'glute'],
    },
    enabled: true,
    order: 1,
  },
  fullbody: {
    name: 'Full Body',
    displayName: 'Full Body',
    icon: 'user',
    color: 'blue',
    subCategories: ['Workout A', 'Workout B'],
    keywords: {
      'Workout A': ['full body a', 'workout a', 'fba'],
      'Workout B': ['full body b', 'workout b', 'fbb'],
    },
    enabled: true,
    order: 2,
  },
  calisthenics: {
    name: 'Cali',
    displayName: 'Calisthenics',
    icon: 'person-standing',
    color: 'cyan',
    subCategories: [], // NO dropdown for Cali
    keywords: {
      'all': ['calisthenics', 'bodyweight', 'push up', 'pull up', 'dip', 'muscle up'],
    },
    enabled: true,
    order: 3,
  },
  cardio: {
    name: 'Cardio',
    displayName: 'Cardio',
    icon: 'heart',
    color: 'green',
    subCategories: ['Running', 'Walking', 'Swimming', 'Cycling'],
    keywords: {
      'Running': ['run', 'jog', 'sprint'],
      'Walking': ['walk', 'hike', 'outdoor walk'],
      'Swimming': ['swim', 'pool'],
      'Cycling': ['cycle', 'bike'],
    },
    enabled: true,
    order: 4,
  },
};

// Use routines from data or defaults
const routines = data?.routines || defaultRoutines;
```

### STEP 4: Verify the Component is Rendered Correctly
```jsx
// In the main render, ensure RoutineTabs has all props:
<div className="mb-6">
  <RoutineTabs
    routines={routines}
    workouts={data?.workouts || []}
    conditioning={data?.conditioning || []}
    activeRoutine={activeRoutine}
    setActiveRoutine={setActiveRoutine}
    activeSubCategory={activeSubCategory}
    setActiveSubCategory={setActiveSubCategory}
    onAddRoutine={() => setShowAddRoutineModal(true)}
  />
</div>
```

### STEP 5: Add Console Logging for Debugging

Add temporary debug logs to see what's happening:
```jsx
// In handleTabClick:
console.log('🔵 Tab Click:', {
  key: routineKey,
  hasDropdown,
  wasActive: activeRoutine === routineKey,
  wasDropdownOpen: openDropdown === routineKey,
});

// After state changes:
useEffect(() => {
  console.log('📊 Tab State:', { activeRoutine, activeSubCategory, openDropdown });
}, [activeRoutine, activeSubCategory, openDropdown]);
```

### DEPLOYMENT
```bash
git add -A
git commit -m "Fix: Tab switching and dropdown functionality"
git push origin main

ssh pi@192.168.1.73 "cd ~/hit-tracker-pro && git pull && docker compose down && docker compose up -d --build"
```

### VERIFICATION

After fix:
1. [ ] Click PPL tab → dropdown opens showing All/Push/Pull/Legs
2. [ ] Click Cali tab → switches to Cali (no dropdown, just selects)
3. [ ] Click back on PPL → switches back, dropdown opens
4. [ ] Select "Push" from dropdown → filter indicator shows, data filters
5. [ ] Click outside dropdown → dropdown closes
6. [ ] Console shows state changes correctly