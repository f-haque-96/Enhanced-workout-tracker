## DIAGNOSTIC: Check Available Data for Smart Insights Features

Before implementing new features, I need to verify what data is available.

DO NOT MAKE ANY CHANGES - just show me the data.

### 1. Check Weight History Data (for trend graph)
```bash
ssh pi@192.168.1.73
cd ~/hit-tracker-pro

# Show weight records from Apple Health
docker compose exec backend cat /app/data/fitness-data.json | python3 -c "
import sys, json
d = json.load(sys.stdin)

# Check measurements history
history = d.get('measurements', {}).get('history', [])
print('=== WEIGHT HISTORY ===')
print(f'Total records: {len(history)}')

# Show last 10 weight entries
weights = [h for h in history if h.get('weight')]
print(f'Records with weight: {len(weights)}')
if weights:
    print('Last 10 weight records:')
    for w in weights[:10]:
        print(f\"  {w.get('date', 'no date')}: {w.get('weight')} kg\")
"
```

### 2. Check if Apple Health has Dietary/Calorie Data
```bash
# Check conditioning data structure
docker compose exec backend cat /app/data/fitness-data.json | python3 -c "
import sys, json
d = json.load(sys.stdin)

print('=== CONDITIONING DATA ===')
conditioning = d.get('conditioning', [])
print(f'Total sessions: {len(conditioning)}')

if conditioning:
    print('First session structure:')
    print(json.dumps(conditioning[0], indent=2))
"

# Check appleHealth section
docker compose exec backend cat /app/data/fitness-data.json | python3 -c "
import sys, json
d = json.load(sys.stdin)

print('=== APPLE HEALTH SECTION ===')
ah = d.get('appleHealth', {})
print(json.dumps(ah, indent=2))
"
```

### 3. Check Apple Health XML for Dietary/Nutrition Data

We need to see if MacroFactor syncs calorie intake to Apple Health:
```bash
# Check if there are any dietary records in the raw data
# This checks the Apple Health parser output
docker compose logs backend --tail=200 | grep -i "dietary\|calorie\|energy\|nutrition\|macrofactor" | head -20
```

### 4. Show Current Measurements Structure
```bash
docker compose exec backend cat /app/data/fitness-data.json | python3 -c "
import sys, json
d = json.load(sys.stdin)

print('=== CURRENT MEASUREMENTS ===')
current = d.get('measurements', {}).get('current', {})
print(json.dumps(current, indent=2))

print('\n=== STARTING MEASUREMENTS ===')
starting = d.get('measurements', {}).get('starting', {})
print(json.dumps(starting, indent=2))
"
```
### 5. remove the decimal points from miles 


### 5. Check What Apple Health Record Types Exist

To see if MacroFactor data is in the export, search for dietary energy:
```bash
# If you still have the uploaded XML, check for dietary records
# Common Apple Health types from MacroFactor:
# - HKQuantityTypeIdentifierDietaryEnergyConsumed (calories eaten)
# - HKQuantityTypeIdentifierBasalEnergyBurned (BMR/TDEE)
# - HKQuantityTypeIdentifierActiveEnergyBurned (exercise calories)

echo "Checking Apple Health parser for available record types..."
grep -n "HKQuantityTypeIdentifier" backend/apple-health-parser.js 2>/dev/null || grep -n "HKQuantityTypeIdentifier" backend/server.js | head -30
```

Show me ALL the output from these commands so I can see:
1. How much weight history we have (for trend graph)
2. If dietary/calorie intake data exists (for TDEE comparison)
3. What data structure we're working with