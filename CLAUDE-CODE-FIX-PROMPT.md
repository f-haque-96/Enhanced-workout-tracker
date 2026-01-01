## FIX: Weight Trend Bad Data + Measurements Still Wrong Columns

### BUG 1: Weight Trend Shows -58kg with Min 26.1kg

The weight trend is showing invalid data:
- Min: 26.1 kg (this is likely body fat % being parsed as weight!)
- Max: 86.6 kg
- Change: -58.0 kg (wrong calculation)

**Root Cause:** Body fat percentage (26.1%) or other values are being stored as weight records.

**Fix: Filter out invalid weight values:**
```javascript
// In WeightTrendSection or wherever weight history is processed:
const getValidWeightData = (history) => {
  return history
    .filter(h => {
      const weight = h.weight;
      // Valid adult weight range: 40-200 kg
      // This filters out body fat % and other bad data
      return weight && weight >= 40 && weight <= 200;
    })
    .slice(0, 30)
    .reverse();
};

// Also fix the trend change calculation:
const WeightTrendSection = ({ history }) => {
  // Filter to valid weights only
  const weightData = history
    .filter(h => h.weight && h.weight >= 40 && h.weight <= 200)
    .slice(0, 30)
    .reverse();
  
  if (weightData.length < 2) return null;
  
  const weights = weightData.map(d => d.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const first = weights[0]; // Oldest in range
  const latest = weights[weights.length - 1]; // Most recent
  const change = latest - first; // Should be positive if gaining, negative if losing
  
  // ... rest of component
  
  return (
    <div>
      {/* Show change from first to latest, not min to max */}
      <div className={change > 0 ? 'text-green-400' : 'text-red-400'}>
        {change > 0 ? '+' : ''}{change.toFixed(1)} kg
      </div>
    </div>
  );
};
```

**Also check the Apple Health parser** - make sure body fat isn't being added to weight records:
```javascript
// In apple-health-parser.js or server.js
// When parsing HKQuantityTypeIdentifierBodyMass:
if (line.includes('HKQuantityTypeIdentifierBodyMass') && line.includes('value=')) {
  const valueMatch = line.match(/value="([^"]+)"/);
  if (valueMatch) {
    const weight = parseFloat(valueMatch[1]);
    // Only store if valid weight (not body fat %)
    if (weight >= 40 && weight <= 200) {
      results.weightRecords.push({ date, value: weight });
    }
  }
}

// Body fat should be separate:
if (line.includes('HKQuantityTypeIdentifierBodyFatPercentage') && line.includes('value=')) {
  const valueMatch = line.match(/value="([^"]+)"/);
  if (valueMatch) {
    const bodyFat = parseFloat(valueMatch[1]);
    // Body fat is 0-1 in Apple Health, convert to percentage
    const percentage = bodyFat < 1 ? bodyFat * 100 : bodyFat;
    if (percentage > 0 && percentage < 50) {
      results.bodyFatRecords.push({ date, value: percentage });
    }
  }
}
```

---

### BUG 2: Measurements STILL Reading Wrong Columns

Current display:
- Chest: 21" (WRONG - this is shoulders from column 4)
- Shoulders: 15.5" (WRONG - this is neck from column 3)

CSV columns:
Column 0: date
Column 1: weight_kg
Column 2: fat_percent
Column 3: neck_in = 15.5
Column 4: shoulder_in = 21
Column 5: chest_in = 40
Column 6: left_bicep_in = 14

**The parser is STILL off by one or reading wrong indices.**

**COMPLETE REWRITE of measurement parsing with explicit debugging:**
```javascript
app.post('/api/hevy/measurements/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    const lines = fileContent.trim().split('\n');
    
    // Parse header row
    const headerLine = lines[0];
    const headers = headerLine.split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
    
    console.log('=== HEVY CSV DEBUG ===');
    console.log('Header line:', headerLine);
    console.log('Parsed headers:', headers);
    
    // Create explicit index map
    const idx = {
      date: headers.indexOf('date'),
      weight_kg: headers.indexOf('weight_kg'),
      fat_percent: headers.indexOf('fat_percent'),
      neck_in: headers.indexOf('neck_in'),
      shoulder_in: headers.indexOf('shoulder_in'),
      chest_in: headers.indexOf('chest_in'),
      left_bicep_in: headers.indexOf('left_bicep_in'),
      right_bicep_in: headers.indexOf('right_bicep_in'),
      waist_in: headers.indexOf('waist_in'),
      abdomen_in: headers.indexOf('abdomen_in'),
      hips_in: headers.indexOf('hips_in'),
      left_thigh_in: headers.indexOf('left_thigh_in'),
      right_thigh_in: headers.indexOf('right_thigh_in'),
    };
    
    console.log('Column indices:', idx);
    
    // Find the row with body measurements (last row with chest/shoulders data)
    let measurementRow = null;
    
    for (let i = lines.length - 1; i >= 1; i--) {
      const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
      
      // Check if this row has body measurements (not just weight)
      const hasChest = idx.chest_in >= 0 && values[idx.chest_in] && values[idx.chest_in] !== '';
      const hasShoulders = idx.shoulder_in >= 0 && values[idx.shoulder_in] && values[idx.shoulder_in] !== '';
      const hasWaist = idx.waist_in >= 0 && values[idx.waist_in] && values[idx.waist_in] !== '';
      
      if (hasChest || hasShoulders || hasWaist) {
        measurementRow = values;
        console.log(`Found measurement row at line ${i}:`, values);
        break;
      }
    }
    
    if (!measurementRow) {
      console.log('No body measurement row found, using last row');
      measurementRow = lines[lines.length - 1].split(',').map(v => v.replace(/"/g, '').trim());
    }
    
    // Extract values using explicit indices
    const getValue = (colIdx) => {
      if (colIdx < 0 || colIdx >= measurementRow.length) return null;
      const val = measurementRow[colIdx];
      if (!val || val === '') return null;
      const num = parseFloat(val);
      return isNaN(num) ? null : num;
    };
    
    const measurements = {
      neck: getValue(idx.neck_in),
      shoulders: getValue(idx.shoulder_in),
      chest: getValue(idx.chest_in),
      leftBicep: getValue(idx.left_bicep_in),
      rightBicep: getValue(idx.right_bicep_in),
      waist: getValue(idx.waist_in) || getValue(idx.abdomen_in),
      hips: getValue(idx.hips_in),
      leftThigh: getValue(idx.left_thigh_in),
      rightThigh: getValue(idx.right_thigh_in),
    };
    
    measurements.biceps = measurements.leftBicep || measurements.rightBicep;
    measurements.thighs = measurements.leftThigh || measurements.rightThigh;
    
    console.log('=== EXTRACTED MEASUREMENTS ===');
    console.log('Neck:', measurements.neck, '(from column', idx.neck_in, ')');
    console.log('Shoulders:', measurements.shoulders, '(from column', idx.shoulder_in, ')');
    console.log('Chest:', measurements.chest, '(from column', idx.chest_in, ')');
    console.log('Waist:', measurements.waist);
    console.log('Biceps:', measurements.biceps);
    
    // Verify the values make sense
    if (measurements.chest && measurements.chest < 30) {
      console.warn('WARNING: Chest value seems too low:', measurements.chest);
      console.warn('This might be reading from wrong column!');
      console.warn('Row values:', measurementRow);
    }
    
    // Update data
    const data = readData();
    
    data.measurements = data.measurements || { current: {}, starting: {}, history: [] };
    data.measurements.current = {
      ...data.measurements.current,
      neck: measurements.neck,
      shoulders: measurements.shoulders,
      chest: measurements.chest,
      biceps: measurements.biceps,
      leftBicep: measurements.leftBicep,
      rightBicep: measurements.rightBicep,
      waist: measurements.waist,
      hips: measurements.hips,
      thighs: measurements.thighs,
      leftThigh: measurements.leftThigh,
      rightThigh: measurements.rightThigh,
    };
    
    data.lastSync = new Date().toISOString();
    
    fs.unlinkSync(req.file.path);
    
    if (writeData(data)) {
      console.log('=== SAVED MEASUREMENTS ===');
      console.log('Chest:', data.measurements.current.chest);
      console.log('Shoulders:', data.measurements.current.shoulders);
      console.log('Neck:', data.measurements.current.neck);
      
      res.json({ 
        success: true, 
        measurements: {
          chest: data.measurements.current.chest,
          shoulders: data.measurements.current.shoulders,
          waist: data.measurements.current.waist,
          neck: data.measurements.current.neck,
        }
      });
    } else {
      res.status(500).json({ error: 'Failed to save' });
    }
    
  } catch (error) {
    console.error('Measurement upload error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

---

### DEPLOYMENT
```bash
git add -A
git commit -m "Fix: Weight trend filter invalid data, measurement column parsing debug"
git push origin main

ssh pi@192.168.1.73 "cd ~/hit-tracker-pro && git pull && docker compose down && docker compose up -d --build"

# After deployment, re-upload measurement_data.csv and check logs:
ssh pi@192.168.1.73 "cd ~/hit-tracker-pro && docker compose logs backend --tail=100 | grep -A 20 'HEVY CSV DEBUG'"
```

### VERIFICATION

After re-uploading measurements CSV:
1. [ ] Check logs show correct column indices (chest_in should be 5)
2. [ ] Chest should show 40" (not 21")
3. [ ] Shoulders should show 21" (not 15.5")
4. [ ] Weight trend min should be ~78kg (not 26kg)
5. [ ] Weight trend change should be reasonable (±5kg, not -58kg)