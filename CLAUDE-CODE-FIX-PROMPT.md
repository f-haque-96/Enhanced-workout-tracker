## FIX: Workout Log Details, Missing Cards, Tab Filtering Not Working

### ISSUE 1: Workout Log Missing Details

The workout log should show:
- Exercise names with sets, reps, weight
- Duration
- Apple Health data (HR, Calories)
- Expandable/collapsible workout details

**Replace the Workout Log section in RoutineContent:**
```jsx
// Enhanced Workout Log Item Component
const WorkoutLogItem = ({ workout, isExpanded, onToggle }) => {
  const appleHealth = workout.appleHealth || {};
  const exercises = workout.exercises || [];
  const duration = workout.duration || appleHealth.duration || 0;
  const calories = appleHealth.activeCalories || workout.calories || 0;
  const avgHR = appleHealth.avgHeartRate || workout.avgHeartRate || 0;
  const maxHR = appleHealth.maxHeartRate || workout.maxHeartRate || 0;
  
  // Calculate totals
  const totalSets = exercises.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0);
  const totalVolume = exercises.reduce((sum, ex) => 
    sum + (ex.sets?.reduce((s, set) => s + ((set.weight_kg || set.weight || 0) * (set.reps || 0)), 0) || 0), 0
  );
  
  const formatDuration = (seconds) => {
    if (!seconds) return '--';
    const mins = Math.floor(seconds / 60);
    return `${mins}m`;
  };
  
  return (
    <div className="border-b border-slate-700/50 last:border-0">
      {/* Workout Header - Clickable */}
      <div 
        className="py-3 px-2 cursor-pointer hover:bg-slate-700/20 rounded-lg transition-colors"
        onClick={onToggle}
      >
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="font-medium text-slate-200">{workout.title || workout.name || workout.type}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {new Date(workout.start_time || workout.date).toLocaleDateString('en-GB', {
                weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
              })}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {totalSets > 0 && (
              <span className="text-slate-400">{totalSets} sets</span>
            )}
            {duration > 0 && (
              <span className="text-slate-400">{formatDuration(duration)}</span>
            )}
            {calories > 0 && (
              <span className="text-orange-400">{calories} kcal</span>
            )}
            {avgHR > 0 && (
              <span className="text-red-400">❤️ {avgHR}</span>
            )}
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
        </div>
        
        {/* Apple Health Badge */}
        {(calories > 0 || avgHR > 0) && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full flex items-center gap-1">
              <Heart className="w-3 h-3" /> Apple Health
            </span>
            {avgHR > 0 && maxHR > 0 && (
              <span className="text-[10px] text-slate-500">
                HR: {avgHR} avg / {maxHR} max
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* Expanded Exercise Details */}
      {isExpanded && exercises.length > 0 && (
        <div className="pb-3 px-2 space-y-2">
          {exercises.map((exercise, exIdx) => (
            <div key={exIdx} className="bg-slate-800/50 rounded-lg p-3">
              <div className="font-medium text-sm text-slate-300 mb-2">{exercise.name || exercise.title}</div>
              <div className="space-y-1">
                {(exercise.sets || []).map((set, setIdx) => {
                  const setType = set.set_type || set.type || 'working';
                  const isWarmup = setType === 'warmup';
                  const isFailure = setType === 'failure' || set.rpe >= 10;
                  
                  return (
                    <div 
                      key={setIdx} 
                      className={`flex items-center gap-3 text-sm py-1 px-2 rounded ${
                        isWarmup ? 'bg-yellow-500/10 text-yellow-300' :
                        isFailure ? 'bg-red-500/10 text-red-300' :
                        'text-slate-300'
                      }`}
                    >
                      <span className="w-6 text-xs text-slate-500">#{setIdx + 1}</span>
                      <span className="font-medium">{set.weight_kg || set.weight || 0} kg</span>
                      <span>×</span>
                      <span>{set.reps || 0} reps</span>
                      {set.rpe && <span className="text-xs text-slate-500">RPE {set.rpe}</span>}
                      {isWarmup && <span className="text-xs bg-yellow-500/20 px-1.5 rounded">Warmup</span>}
                      {isFailure && <span className="text-xs bg-red-500/20 px-1.5 rounded">Failure</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          
          {/* Workout Summary */}
          <div className="flex gap-4 text-xs text-slate-500 pt-2 border-t border-slate-700/50">
            <span>Total: {totalSets} sets</span>
            <span>Volume: {(totalVolume / 1000).toFixed(1)}t</span>
            {duration > 0 && <span>Duration: {formatDuration(duration)}</span>}
          </div>
        </div>
      )}
    </div>
  );
};

// In RoutineContent, update the Workout Log card:
const [expandedWorkouts, setExpandedWorkouts] = useState({});

const toggleWorkout = (workoutId) => {
  setExpandedWorkouts(prev => ({
    ...prev,
    [workoutId]: !prev[workoutId]
  }));
};

// Render:
<div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
  <div className="flex justify-between items-center mb-3">
    <div className="text-sm font-medium text-slate-300">
      Workout Log
    </div>
    <span className="text-xs text-slate-500">({filteredWorkouts.length})</span>
  </div>
  
  {filteredWorkouts.length > 0 ? (
    <div className="divide-y divide-slate-700/50">
      {filteredWorkouts.slice(0, 10).map((workout, idx) => (
        <WorkoutLogItem 
          key={workout.id || idx} 
          workout={workout}
          isExpanded={expandedWorkouts[workout.id || idx]}
          onToggle={() => toggleWorkout(workout.id || idx)}
        />
      ))}
    </div>
  ) : (
    <div className="text-center text-slate-500 py-8">
      No workouts found for this filter.
    </div>
  )}
</div>
```

---

### ISSUE 2: Add Missing Cards (Achievements, PRs, Strength Forecast, 1RM)

Add these cards to the RoutineContent component:
```jsx
const RoutineContent = ({ 
  routine, 
  subCategory, 
  workouts, 
  conditioning,
  dateRange,
  bodyWeight,
}) => {
  // ... existing filtering logic ...
  
  // Calculate Key Lifts / 1RM for this routine
  const keyLifts = useMemo(() => {
    const exerciseMaxes = {};
    
    filteredWorkouts.forEach(workout => {
      (workout.exercises || []).forEach(exercise => {
        const name = exercise.name || exercise.title;
        if (!name) return;
        
        (exercise.sets || []).forEach(set => {
          const weight = set.weight_kg || set.weight || 0;
          const reps = set.reps || 0;
          if (weight <= 0 || reps <= 0) return;
          
          // Estimate 1RM using Epley formula
          const estimated1RM = weight * (1 + reps / 30);
          
          if (!exerciseMaxes[name] || estimated1RM > exerciseMaxes[name].estimated1RM) {
            exerciseMaxes[name] = {
              name,
              weight,
              reps,
              estimated1RM,
              date: workout.start_time || workout.date,
            };
          }
        });
      });
    });
    
    return Object.values(exerciseMaxes)
      .sort((a, b) => b.estimated1RM - a.estimated1RM)
      .slice(0, 5);
  }, [filteredWorkouts]);
  
  // Calculate Recent PRs
  const recentPRs = useMemo(() => {
    const prs = [];
    const exerciseBests = {};
    
    // Sort workouts by date (oldest first)
    const sortedWorkouts = [...filteredWorkouts].sort((a, b) => 
      new Date(a.start_time || a.date) - new Date(b.start_time || b.date)
    );
    
    sortedWorkouts.forEach(workout => {
      (workout.exercises || []).forEach(exercise => {
        const name = exercise.name || exercise.title;
        if (!name) return;
        
        (exercise.sets || []).forEach(set => {
          const weight = set.weight_kg || set.weight || 0;
          const reps = set.reps || 0;
          if (weight <= 0) return;
          
          const key = `${name}-${reps}`;
          const prevBest = exerciseBests[key];
          
          if (!prevBest || weight > prevBest.weight) {
            if (prevBest) {
              // This is a PR!
              prs.push({
                exercise: name,
                weight,
                reps,
                date: workout.start_time || workout.date,
                improvement: weight - prevBest.weight,
              });
            }
            exerciseBests[key] = { weight, reps };
          }
        });
      });
    });
    
    return prs.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  }, [filteredWorkouts]);
  
  // Calculate Strength Forecast (10% improvement targets)
  const strengthForecast = useMemo(() => {
    return keyLifts.slice(0, 3).map(lift => ({
      ...lift,
      target1RM: Math.ceil(lift.estimated1RM * 1.1), // 10% improvement
      targetWeight: Math.ceil(lift.weight * 1.1),
    }));
  }, [keyLifts]);
  
  // Calculate Achievements for this routine
  const achievements = useMemo(() => {
    if (!bodyWeight || bodyWeight <= 0) return { earned: [], inProgress: [] };
    
    const earned = [];
    const inProgress = [];
    
    keyLifts.forEach(lift => {
      const ratio = lift.estimated1RM / bodyWeight;
      const liftName = lift.name.toLowerCase();
      
      // Define achievement thresholds based on exercise type
      let thresholds = [];
      
      if (liftName.includes('bench') || liftName.includes('incline')) {
        thresholds = [
          { mult: 1.0, name: `1x BW ${lift.name.split(' ').slice(0, 2).join(' ')}` },
          { mult: 1.5, name: `1.5x BW ${lift.name.split(' ').slice(0, 2).join(' ')}` },
        ];
      } else if (liftName.includes('squat')) {
        thresholds = [
          { mult: 1.5, name: '1.5x BW Squat' },
          { mult: 2.0, name: '2x BW Squat' },
        ];
      } else if (liftName.includes('deadlift')) {
        thresholds = [
          { mult: 2.0, name: '2x BW Deadlift' },
          { mult: 2.5, name: '2.5x BW Deadlift' },
        ];
      } else if (liftName.includes('press') || liftName.includes('ohp')) {
        thresholds = [
          { mult: 0.7, name: '0.7x BW OHP' },
          { mult: 1.0, name: '1x BW OHP' },
        ];
      } else if (liftName.includes('row') || liftName.includes('pulldown')) {
        thresholds = [
          { mult: 1.0, name: `1x BW ${lift.name.split(' ').slice(0, 2).join(' ')}` },
        ];
      }
      
      thresholds.forEach(threshold => {
        const progress = Math.min(100, Math.round((ratio / threshold.mult) * 100));
        if (progress >= 100) {
          earned.push({ name: threshold.name, icon: '🏆' });
        } else {
          inProgress.push({ 
            name: threshold.name, 
            progress,
            current: lift.estimated1RM.toFixed(1),
            target: (bodyWeight * threshold.mult).toFixed(1),
          });
        }
      });
    });
    
    return { earned, inProgress: inProgress.slice(0, 3) };
  }, [keyLifts, bodyWeight]);
  
  // Determine if this is a cardio routine
  const isCardio = routine?.name?.toLowerCase() === 'cardio';
  const displayData = isCardio ? filteredConditioning : filteredWorkouts;
  
  return (
    <div className="space-y-4">
      
      {/* Key Lifts (1RM) - Only for strength routines */}
      {!isCardio && keyLifts.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="text-sm font-medium text-slate-300 mb-3">Key Lifts (Est. 1RM)</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {keyLifts.map((lift, idx) => (
              <div key={idx} className="bg-slate-900/50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-white">
                  {lift.estimated1RM.toFixed(1)}
                  <span className="text-xs text-slate-400 ml-1">kg</span>
                </div>
                <div className="text-xs text-slate-400 truncate mt-1" title={lift.name}>
                  {lift.name.split(' ').slice(0, 2).join(' ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Achievements - Only for strength routines */}
      {!isCardio && (achievements.earned.length > 0 || achievements.inProgress.length > 0) && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="flex justify-between items-center mb-3">
            <div className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Achievements
            </div>
            {achievements.earned.length > 0 && (
              <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full">
                {achievements.earned.length} Earned
              </span>
            )}
          </div>
          
          {/* Earned */}
          {achievements.earned.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {achievements.earned.map((ach, idx) => (
                <div key={idx} className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 px-3 py-1.5 rounded-lg text-sm">
                  <span>{ach.icon}</span>
                  <span>{ach.name}</span>
                </div>
              ))}
            </div>
          )}
          
          {/* In Progress */}
          {achievements.inProgress.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-slate-500">In Progress</div>
              {achievements.inProgress.map((ach, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">{ach.name}</span>
                    <span className="text-slate-500 text-xs">{ach.current}/{ach.target} kg</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{ width: `${ach.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Recent PRs */}
      {!isCardio && recentPRs.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            Recent PRs
          </div>
          <div className="space-y-2">
            {recentPRs.map((pr, idx) => (
              <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-700/50 last:border-0">
                <div>
                  <div className="font-medium text-sm">{pr.exercise}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(pr.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-400">{pr.weight} kg × {pr.reps}</div>
                  <div className="text-xs text-green-500">+{pr.improvement} kg</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Strength Forecast */}
      {!isCardio && strengthForecast.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-400" />
            Strength Forecast (+10%)
          </div>
          <div className="space-y-3">
            {strengthForecast.map((lift, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <div className="text-sm text-slate-400">{lift.name.split(' ').slice(0, 2).join(' ')}</div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500">{lift.estimated1RM.toFixed(1)} kg</span>
                  <span className="text-slate-600">→</span>
                  <span className="text-blue-400 font-medium">{lift.target1RM} kg</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Overview Card */}
      {/* ... existing overview card ... */}
      
      {/* Muscle Distribution */}
      {/* ... existing muscle distribution ... */}
      
      {/* Workout Log */}
      {/* ... updated workout log with expandable items ... */}
      
    </div>
  );
};
```

---

### ISSUE 3: Fix Tab Filtering for Cardio and Other Tabs

The filtering is not working for Cardio because it uses `conditioning` data, not `workouts`. Fix the filtering logic:
```jsx
const RoutineContent = ({ 
  routine, 
  subCategory, 
  workouts, 
  conditioning,
  dateRange,
  bodyWeight,
}) => {
  // Determine if this is a cardio routine
  const isCardio = routine?.name?.toLowerCase() === 'cardio';
  
  // Filter WORKOUTS for strength routines
  const filteredWorkouts = useMemo(() => {
    if (!routine || isCardio) return [];
    if (!workouts || !Array.isArray(workouts)) return [];
    
    return workouts.filter(workout => {
      const title = (workout.title || workout.name || '').toLowerCase();
      
      // If sub-category is selected (not "All"), filter by sub-category keywords
      if (subCategory && subCategory !== 'All') {
        const keywords = routine.keywords?.[subCategory] || [];
        return keywords.some(kw => title.includes(kw.toLowerCase()));
      }
      
      // If "All" selected, match any keyword in this routine
      const allKeywords = Object.values(routine.keywords || {}).flat();
      if (allKeywords.length === 0) return true; // No keywords = show all
      return allKeywords.some(kw => title.includes(kw.toLowerCase()));
    });
  }, [routine, subCategory, workouts, isCardio]);
  
  // Filter CONDITIONING for cardio
  const filteredConditioning = useMemo(() => {
    if (!routine || !isCardio) return [];
    if (!conditioning || !Array.isArray(conditioning)) return [];
    
    console.log('Filtering conditioning:', {
      total: conditioning.length,
      subCategory,
      keywords: routine.keywords,
    });
    
    return conditioning.filter(session => {
      const type = (session.type || session.category || session.name || '').toLowerCase();
      
      // If sub-category is selected (not "All"), filter by sub-category keywords
      if (subCategory && subCategory !== 'All') {
        const keywords = routine.keywords?.[subCategory] || [];
        return keywords.some(kw => type.includes(kw.toLowerCase()));
      }
      
      // If "All" selected for cardio, show ALL conditioning
      return true; // Show all conditioning for cardio
    });
  }, [routine, subCategory, conditioning, isCardio]);
  
  // Use the appropriate data based on routine type
  const displayData = isCardio ? filteredConditioning : filteredWorkouts;
  
  console.log('RoutineContent:', {
    routineName: routine?.name,
    isCardio,
    subCategory,
    filteredWorkouts: filteredWorkouts.length,
    filteredConditioning: filteredConditioning.length,
    displayData: displayData.length,
  });
  
  // Calculate stats from the correct data source
  const stats = useMemo(() => {
    if (isCardio) {
      // Cardio stats from conditioning
      let totalDuration = 0;
      let totalCalories = 0;
      let totalDistance = 0;
      let totalHR = 0;
      let hrCount = 0;
      
      filteredConditioning.forEach(session => {
        totalDuration += session.duration || 0;
        totalCalories += session.activeCalories || session.calories || 0;
        totalDistance += session.distance || 0;
        if (session.avgHeartRate) {
          totalHR += session.avgHeartRate;
          hrCount++;
        }
      });
      
      return {
        workouts: filteredConditioning.length,
        duration: totalDuration,
        calories: totalCalories,
        distance: totalDistance,
        avgHR: hrCount > 0 ? Math.round(totalHR / hrCount) : 0,
        // Not applicable for cardio
        workingSets: 0,
        warmupSets: 0,
        failureSets: 0,
        totalReps: 0,
        totalVolume: 0,
        muscleDistribution: [],
      };
    }
    
    // Strength stats (existing logic)
    // ... keep existing strength stats calculation ...
  }, [isCardio, filteredWorkouts, filteredConditioning]);
  
  return (
    <div className="space-y-4">
      {/* Cardio-specific Overview */}
      {isCardio && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="text-sm font-medium text-slate-300 mb-3">Cardio Overview</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-white">{stats.workouts}</div>
              <div className="text-xs text-slate-400">Sessions</div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-400">
                {(stats.distance / 1000).toFixed(1)}
                <span className="text-sm">km</span>
              </div>
              <div className="text-xs text-slate-400">Distance</div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-orange-400">{stats.calories}</div>
              <div className="text-xs text-slate-400">Calories</div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-400">{stats.avgHR}</div>
              <div className="text-xs text-slate-400">Avg HR</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Strength Overview - only for non-cardio */}
      {!isCardio && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          {/* ... existing strength overview ... */}
        </div>
      )}
      
      {/* Key Lifts, Achievements, PRs - only for strength */}
      {!isCardio && (
        <>
          {/* ... key lifts, achievements, PRs cards ... */}
        </>
      )}
      
      {/* Cardio Session Log */}
      {isCardio && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="flex justify-between items-center mb-3">
            <div className="text-sm font-medium text-slate-300">Session Log</div>
            <span className="text-xs text-slate-500">({filteredConditioning.length})</span>
          </div>
          
          {filteredConditioning.length > 0 ? (
            <div className="space-y-2">
              {filteredConditioning.slice(0, 10).map((session, idx) => (
                <div key={session.id || idx} className="flex justify-between items-center py-2 border-b border-slate-700/50 last:border-0">
                  <div>
                    <div className="font-medium text-sm">{session.type || 'Workout'}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(session.date).toLocaleDateString('en-GB', {
                        weekday: 'short', day: 'numeric', month: 'short'
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    {session.duration > 0 && (
                      <span className="text-slate-400">{Math.round(session.duration / 60)}m</span>
                    )}
                    {session.distance > 0 && (
                      <span className="text-green-400">{(session.distance / 1000).toFixed(1)} km</span>
                    )}
                    {(session.activeCalories || session.calories) > 0 && (
                      <span className="text-orange-400">{session.activeCalories || session.calories} kcal</span>
                    )}
                    {session.avgHeartRate > 0 && (
                      <span className="text-red-400">❤️ {session.avgHeartRate}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-slate-500 py-8">
              No cardio sessions found for this filter.
            </div>
          )}
        </div>
      )}
      
      {/* Strength Workout Log - only for non-cardio */}
      {!isCardio && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          {/* ... existing workout log ... */}
        </div>
      )}
    </div>
  );
};
```

---

### ISSUE 4: Ensure Calisthenics Tab Works

For Calisthenics, we need to match workouts that contain bodyweight exercises:
```jsx
// Update default routines to have better calisthenics keywords:
const defaultRoutines = {
  // ... other routines ...
  calisthenics: {
    name: 'Cali',
    displayName: 'Calisthenics',
    icon: 'person-standing',
    color: 'cyan',
    subCategories: [], // No dropdown
    keywords: {
      'all': [
        'calisthenics', 
        'bodyweight', 
        'push up', 'push-up', 'pushup',
        'pull up', 'pull-up', 'pullup',
        'dip', 'dips',
        'muscle up', 'muscle-up',
        'handstand',
        'plank',
        'burpee',
        'cali', // Match "Cali" in workout title
      ],
    },
    enabled: true,
    order: 3,
  },
  // ... other routines ...
};
```

---

### DEPLOYMENT
```bash
git add -A
git commit -m "Fix: Workout log details, add missing cards, fix cardio/cali tab filtering"
git push origin main

ssh pi@192.168.1.73 "cd ~/hit-tracker-pro && git pull && docker compose down && docker compose up -d --build"
```

### VERIFICATION

After fix:
1. [ ] PPL tab shows Key Lifts, Achievements, PRs, Strength Forecast
2. [ ] Workout Log items are expandable with sets/reps/weight
3. [ ] Apple Health data (HR, calories) shows on workouts
4. [ ] Cardio tab shows 24 sessions with correct stats
5. [ ] Cali tab shows calisthenics workouts (if any exist)
6. [ ] Full Body tab shows workouts
7. [ ] Filtering by subcategory works correctly