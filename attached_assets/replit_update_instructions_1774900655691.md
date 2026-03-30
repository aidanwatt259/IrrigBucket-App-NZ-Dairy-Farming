# IrrigBucket — Calculation Accuracy Update Instructions

## Overview

The app's Distribution Uniformity (DU) formula needs to be updated to match the NZ industry standard. The current app uses the **Lower Quarter DU** method, but NZ irrigation professionals use the **Coefficient of Variation (CV) method**: `DU = 1 − (STDEV / MEAN)`.

Additionally, **Christiansen's CU** should be removed (professionals don't use it), and **section-based analysis** should be added for Centre Pivots so users can see per-section DU and depth results (e.g., Inner Span, Outer Span, End Gun).

---

## Changes Required

### 1. [app.js](file:///Users/aidanwatt/Desktop/Anti%20Gravity/irrigbucket/app.js) — Add Utility Functions (insert before the [showDataEntry](file:///Users/aidanwatt/Desktop/Anti%20Gravity/irrigbucket/app.js#701-771) function)

Add these new utility functions just before the existing `// ---- Data Entry ----` section:

```javascript
// ---- Utility: Population Standard Deviation ----
function populationStdDev(values) {
  const n = values.length;
  if (n === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  return Math.sqrt(variance);
}

// ---- Utility: DU using CV method (NZ industry standard) ----
function calcDU(values) {
  if (values.length < 2) return 1;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  return 1 - (populationStdDev(values) / mean);
}

// ---- Utility: DU status rating ----
function duStatusRating(du) {
  return du >= 0.80 ? 'good' : du >= 0.65 ? 'fair' : 'poor';
}

// ---- Utility: Depth status rating ----
function depthStatusRating(depthDiff) {
  return depthDiff <= 10 ? 'good' : depthDiff <= 25 ? 'fair' : 'poor';
}
```

---

### 2. [app.js](file:///Users/aidanwatt/Desktop/Anti%20Gravity/irrigbucket/app.js) — Replace the [showDataEntry](file:///Users/aidanwatt/Desktop/Anti%20Gravity/irrigbucket/app.js#701-771) function

Replace the entire [showDataEntry](file:///Users/aidanwatt/Desktop/Anti%20Gravity/irrigbucket/app.js#701-771) function with this version that adds section definition UI for centre pivots:

```javascript
function showDataEntry() {
  const grid = document.getElementById('volume-grid');
  grid.innerHTML = '';

  // For centre pivots, show section definition UI
  const sectionsContainer = document.getElementById('sections-container');
  if (sectionsContainer) sectionsContainer.remove();

  if (currentSetup.type.id === 'centrePivot') {
    const sectDiv = document.createElement('div');
    sectDiv.id = 'sections-container';
    sectDiv.className = 'card mb-16';
    sectDiv.innerHTML = `
      <h4 class="mb-8">Define Pivot Sections <span style="font-size:0.8em;color:var(--text-muted);">(optional)</span></h4>
      <p class="text-sm mb-12">Break down your pivot into sections for per-section analysis. Specify which bucket numbers belong to each section.</p>
      <div id="section-rows">
        <div class="section-row form-row mb-8">
          <div class="form-group" style="flex:2">
            <label class="form-label">Section Name</label>
            <input type="text" class="form-input section-name" placeholder="e.g. Inner Span" value="Inner Span">
          </div>
          <div class="form-group" style="flex:1">
            <label class="form-label">From Bucket #</label>
            <input type="number" class="form-input section-from" placeholder="1" min="1" max="${currentSetup.numBuckets}" value="1">
          </div>
          <div class="form-group" style="flex:1">
            <label class="form-label">To Bucket #</label>
            <input type="number" class="form-input section-to" placeholder="${Math.floor(currentSetup.numBuckets / 2)}" min="1" max="${currentSetup.numBuckets}">
          </div>
        </div>
        <div class="section-row form-row mb-8">
          <div class="form-group" style="flex:2">
            <label class="form-label">Section Name</label>
            <input type="text" class="form-input section-name" placeholder="e.g. Outer Span" value="Outer Span">
          </div>
          <div class="form-group" style="flex:1">
            <label class="form-label">From Bucket #</label>
            <input type="number" class="form-input section-from" placeholder="${Math.floor(currentSetup.numBuckets / 2) + 1}" min="1" max="${currentSetup.numBuckets}">
          </div>
          <div class="form-group" style="flex:1">
            <label class="form-label">To Bucket #</label>
            <input type="number" class="form-input section-to" placeholder="${currentSetup.numBuckets}" min="1" max="${currentSetup.numBuckets}">
          </div>
        </div>
      </div>
      <button type="button" class="btn btn-secondary mt-8" onclick="addSectionRow()" style="font-size:0.85rem;padding:6px 14px;">
        + Add Section
      </button>
    `;
    // Insert before the volume grid's parent card
    const dataCard = grid.closest('.card');
    dataCard.parentNode.insertBefore(sectDiv, dataCard);
  }

  for (let i = 0; i < currentSetup.numBuckets; i++) {
    const cell = document.createElement('div');
    cell.className = 'volume-cell';
    cell.innerHTML = `
      <label>#${i + 1}</label>
      <input type="number" id="vol-${i}" placeholder="mL" min="0" max="10000" inputmode="decimal">
    `;
    grid.appendChild(cell);
  }

  // Set date to today
  document.getElementById('test-date').value = new Date().toISOString().split('T')[0];

  showScreen('screen-data');
}
```

---

### 3. [app.js](file:///Users/aidanwatt/Desktop/Anti%20Gravity/irrigbucket/app.js) — Add section helper functions (after [showDataEntry](file:///Users/aidanwatt/Desktop/Anti%20Gravity/irrigbucket/app.js#701-771))

Add these new functions right after [showDataEntry](file:///Users/aidanwatt/Desktop/Anti%20Gravity/irrigbucket/app.js#701-771):

```javascript
function addSectionRow() {
  const container = document.getElementById('section-rows');
  const row = document.createElement('div');
  row.className = 'section-row form-row mb-8';
  row.innerHTML = `
    <div class="form-group" style="flex:2">
      <label class="form-label">Section Name</label>
      <input type="text" class="form-input section-name" placeholder="e.g. End Gun">
    </div>
    <div class="form-group" style="flex:1">
      <label class="form-label">From Bucket #</label>
      <input type="number" class="form-input section-from" placeholder="" min="1" max="${currentSetup.numBuckets}">
    </div>
    <div class="form-group" style="flex:1">
      <label class="form-label">To Bucket #</label>
      <input type="number" class="form-input section-to" placeholder="" min="1" max="${currentSetup.numBuckets}">
    </div>
  `;
  container.appendChild(row);
}

function getSectionDefinitions() {
  const sections = [];
  const rows = document.querySelectorAll('.section-row');
  rows.forEach(row => {
    const name = row.querySelector('.section-name').value.trim();
    const from = parseInt(row.querySelector('.section-from').value);
    const to = parseInt(row.querySelector('.section-to').value);
    if (name && !isNaN(from) && !isNaN(to) && from >= 1 && to >= from) {
      sections.push({ name, from: from - 1, to: to }); // convert to 0-indexed start
    }
  });
  return sections;
}
```

---

### 4. [app.js](file:///Users/aidanwatt/Desktop/Anti%20Gravity/irrigbucket/app.js) — Replace the [calculateResults](file:///Users/aidanwatt/Desktop/Anti%20Gravity/irrigbucket/app.js#807-897) function

Replace the entire [calculateResults](file:///Users/aidanwatt/Desktop/Anti%20Gravity/irrigbucket/app.js#807-897) function. Key changes:
- DU now uses [calcDU()](file:///Users/aidanwatt/Desktop/Anti%20Gravity/irrigbucket/app.js#683-690) (CV method) instead of lower quarter
- Christiansen's CU is removed entirely
- Section-based analysis added for centre pivots

```javascript
function calculateResults() {
  const volumes = [];
  let allFilled = true;

  for (let i = 0; i < currentSetup.numBuckets; i++) {
    const el = document.getElementById(`vol-${i}`);
    const val = parseFloat(el.value);
    if (isNaN(val) || val < 0) {
      allFilled = false;
      volumes.push(0);
    } else {
      volumes.push(val);
    }
  }

  if (!allFilled) {
    // Allow partial — fill gaps with 0 but warn
  }

  // Filter out zeros for calculations (but keep them for display)
  const validVolumes = volumes.filter(v => v > 0);
  if (validVolumes.length < 4) {
    alert('Please enter at least 4 bucket measurements to calculate results.');
    return;
  }

  // Bucket area (mm²)
  const diameter = currentSetup.inputs.bucketDiameter || 250;
  const radius = diameter / 2;
  const bucketArea = Math.PI * radius * radius; // mm²

  // Average volume
  const avgVolume = validVolumes.reduce((a, b) => a + b, 0) / validVolumes.length;

  // Application depth (mm) = (volume_mL × 1000) / area_mm²
  const appDepth = (1000 * avgVolume) / bucketArea;

  // Distribution Uniformity — CV method: DU = 1 - (STDEV.P / MEAN)
  // This is the NZ industry standard used by irrigation professionals
  const du = calcDU(validVolumes);

  // Application rate (mm/hr) — only for travelling systems
  let appRate = null;
  if (currentSetup.inputs.travelSpeed && currentSetup.lineLength) {
    const passTimeHrs = currentSetup.lineLength / currentSetup.inputs.travelSpeed;
    appRate = appDepth / passTimeHrs;
  } else if (currentSetup.inputs.runDuration) {
    appRate = appDepth / currentSetup.inputs.runDuration;
  }

  // Target depth comparison
  const targetDepth = currentSetup.inputs.targetDepth || 15;
  const depthDiff = Math.abs(appDepth - targetDepth) / targetDepth * 100;

  // Status ratings
  const duStatus = duStatusRating(du);
  const depthStatus = depthStatusRating(depthDiff);

  // Section-based analysis (for centre pivots)
  let sections = [];
  if (currentSetup.type.id === 'centrePivot') {
    const sectionDefs = getSectionDefinitions();
    sectionDefs.forEach(sec => {
      const sectionVolumes = volumes.slice(sec.from, sec.to).filter(v => v > 0);
      if (sectionVolumes.length >= 2) {
        const secAvgVol = sectionVolumes.reduce((a, b) => a + b, 0) / sectionVolumes.length;
        const secDepth = (1000 * secAvgVol) / bucketArea;
        const secDU = calcDU(sectionVolumes);
        const secDepthDiff = Math.abs(secDepth - targetDepth) / targetDepth * 100;
        sections.push({
          name: sec.name,
          du: secDU,
          duStatus: duStatusRating(secDU),
          appDepth: secDepth,
          depthDiff: secDepthDiff,
          depthStatus: depthStatusRating(secDepthDiff),
          bucketCount: sectionVolumes.length,
        });
      }
    });
  }

  // Store results
  const sorted = [...validVolumes].sort((a, b) => a - b);
  const results = { volumes, validVolumes, avgVolume, appDepth, du, appRate, targetDepth, depthDiff, duStatus, depthStatus, sorted, sections, bucketArea };

  renderResults(results);
  showScreen('screen-results');
}
```

---

### 5. [app.js](file:///Users/aidanwatt/Desktop/Anti%20Gravity/irrigbucket/app.js) — Replace [renderResults](file:///Users/aidanwatt/Desktop/Anti%20Gravity/irrigbucket/app.js#898-946) function

Key changes: removed CU card, changed label from "Lower Quarter" to "1 − CV", changed status labels to Pass/Attention/Fail, added section breakdown call.

```javascript
function renderResults(r) {
  const windSpeed = document.getElementById('wind-speed').value;
  const testDate = document.getElementById('test-date').value;

  document.getElementById('results-summary').textContent =
    `${currentSetup.type.name} • Tested ${testDate || 'today'}${windSpeed ? ` • Wind: ${windSpeed} km/h` : ''}`;

  // Result cards
  const duLabel = r.duStatus === 'good' ? 'Pass' : r.duStatus === 'fair' ? 'Attention' : 'Fail';
  const depthLabel = r.depthStatus === 'good' ? 'On Target' : r.depthStatus === 'fair' ? 'Close' : 'Off Target';

  let cardsHTML = `
    <div class="result-card ${r.duStatus}">
      <div class="result-label">Distribution Uniformity</div>
      <div class="result-value ${r.duStatus}">${(r.du * 100).toFixed(1)}%</div>
      <div class="result-unit">DU (1 − CV)</div>
      <span class="result-badge ${r.duStatus}">${duLabel}</span>
    </div>
    <div class="result-card ${r.depthStatus}">
      <div class="result-label">Application Depth</div>
      <div class="result-value ${r.depthStatus}">${r.appDepth.toFixed(1)}</div>
      <div class="result-unit">mm (target: ${r.targetDepth} mm)</div>
      <span class="result-badge ${r.depthStatus}">${depthLabel}</span>
    </div>
  `;

  if (r.appRate !== null) {
    cardsHTML += `
      <div class="result-card">
        <div class="result-label">Application Rate</div>
        <div class="result-value" style="color: var(--blue-600)">${r.appRate.toFixed(1)}</div>
        <div class="result-unit">mm/hr</div>
      </div>
    `;
  }

  document.getElementById('results-grid').innerHTML = cardsHTML;

  // Section breakdown (centre pivots)
  renderSectionBreakdown(r);

  // Bar chart
  renderBarChart(r);

  // Recommendations
  renderRecommendations(r);
}
```

---

### 6. [app.js](file:///Users/aidanwatt/Desktop/Anti%20Gravity/irrigbucket/app.js) — Add new [renderSectionBreakdown](file:///Users/aidanwatt/Desktop/Anti%20Gravity/irrigbucket/app.js#947-1004) function (after [renderResults](file:///Users/aidanwatt/Desktop/Anti%20Gravity/irrigbucket/app.js#898-946))

This is a brand new function:

```javascript
function renderSectionBreakdown(r) {
  // Remove any existing section breakdown
  const existing = document.getElementById('section-breakdown');
  if (existing) existing.remove();

  if (!r.sections || r.sections.length === 0) return;

  const breakdownDiv = document.createElement('div');
  breakdownDiv.id = 'section-breakdown';
  breakdownDiv.className = 'card mb-16';

  let tableHTML = `
    <h4 class="mb-12">Section Breakdown</h4>
    <table class="section-table">
      <thead>
        <tr>
          <th>Section</th>
          <th>Buckets</th>
          <th>DU</th>
          <th>Status</th>
          <th>Avg Depth</th>
          <th>Depth Status</th>
        </tr>
      </thead>
      <tbody>
  `;

  r.sections.forEach(sec => {
    const duLabel = sec.duStatus === 'good' ? 'Y' : sec.duStatus === 'fair' ? '!' : 'N';
    const depthLabel = sec.depthStatus === 'good' ? 'Y' : sec.depthStatus === 'fair' ? '!' : 'N';
    const duClass = sec.duStatus;
    const depthClass = sec.depthStatus;
    tableHTML += `
      <tr>
        <td><strong>${sec.name}</strong></td>
        <td>${sec.bucketCount}</td>
        <td class="${duClass}">${(sec.du * 100).toFixed(1)}%</td>
        <td><span class="result-badge ${duClass}" style="font-size:0.75rem;padding:2px 8px;">${duLabel}</span></td>
        <td>${sec.appDepth.toFixed(1)} mm</td>
        <td><span class="result-badge ${depthClass}" style="font-size:0.75rem;padding:2px 8px;">${depthLabel}</span></td>
      </tr>
    `;
  });

  tableHTML += `
      </tbody>
    </table>
    <p class="text-sm mt-8" style="color:var(--text-muted);">Y = Pass (≥80%) &nbsp;|&nbsp; ! = Attention (65–79%) &nbsp;|&nbsp; N = Fail (<65%)</p>
  `;

  breakdownDiv.innerHTML = tableHTML;

  // Insert after the results grid card
  const resultsGrid = document.getElementById('results-grid');
  const parentCard = resultsGrid.closest('.card');
  parentCard.parentNode.insertBefore(breakdownDiv, parentCard.nextSibling);
}
```

---

### 7. [app.js](file:///Users/aidanwatt/Desktop/Anti%20Gravity/irrigbucket/app.js) — Replace [renderBarChart](file:///Users/aidanwatt/Desktop/Anti%20Gravity/irrigbucket/app.js#1005-1024) function

Changed from lower-quarter highlighting to outlier (>1 StdDev) highlighting:

```javascript
function renderBarChart(r) {
  const chart = document.getElementById('bar-chart');
  chart.innerHTML = '';

  const maxVol = Math.max(...r.validVolumes);
  const mean = r.avgVolume;
  const stdDev = populationStdDev(r.validVolumes);

  r.volumes.forEach((v, i) => {
    if (v <= 0) return;
    const bar = document.createElement('div');
    // Highlight buckets > 1 StdDev from the mean
    const isOutlier = Math.abs(v - mean) > stdDev;
    bar.className = 'bar' + (isOutlier ? ' outlier' : '');
    bar.style.height = `${(v / maxVol) * 100}%`;
    bar.title = `Bucket #${i + 1}: ${v} mL (${((1000 * v) / r.bucketArea).toFixed(1)} mm)`;
    chart.appendChild(bar);
  });
}
```

---

### 8. [app.js](file:///Users/aidanwatt/Desktop/Anti%20Gravity/irrigbucket/app.js) — Replace [renderRecommendations](file:///Users/aidanwatt/Desktop/Anti%20Gravity/irrigbucket/app.js#1025-1087) function

Updated to include section-specific recommendations and use StdDev-based outlier detection:

```javascript
function renderRecommendations(r) {
  const recs = [];

  // DU recommendations
  if (r.duStatus === 'good') {
    recs.push({ type: 'tip', icon: '✅', text: `Great uniformity (DU ${(r.du * 100).toFixed(1)}%). Your system is distributing water evenly across the tested area.` });
  } else if (r.duStatus === 'fair') {
    recs.push({ type: 'warning', icon: '⚠️', text: `Uniformity needs attention (DU ${(r.du * 100).toFixed(1)}%). Some areas are receiving noticeably less water. Check for worn or partially blocked nozzles.` });
  } else {
    recs.push({ type: 'alert', icon: '🔴', text: `Uniformity test failed (DU ${(r.du * 100).toFixed(1)}%). Water application is very uneven. Inspect all nozzles, check operating pressure, and look for leaks or blockages.` });
  }

  // Section-specific recommendations
  if (r.sections && r.sections.length > 0) {
    const problemSections = r.sections.filter(s => s.duStatus !== 'good');
    problemSections.forEach(sec => {
      const label = sec.duStatus === 'fair' ? 'needs attention' : 'failed';
      recs.push({ type: sec.duStatus === 'fair' ? 'warning' : 'alert', icon: '📍', text: `${sec.name} section ${label} (DU ${(sec.du * 100).toFixed(1)}%). Inspect nozzles in this section specifically.` });
    });

    const depthProblemSections = r.sections.filter(s => s.depthStatus !== 'good');
    depthProblemSections.forEach(sec => {
      recs.push({ type: 'warning', icon: '💧', text: `${sec.name} is applying ${sec.appDepth.toFixed(1)} mm (${sec.depthDiff.toFixed(0)}% off target). Check nozzle sizing or pressure in this section.` });
    });
  }

  // Depth recommendations
  if (r.depthStatus === 'good') {
    recs.push({ type: 'tip', icon: '💧', text: `Application depth (${r.appDepth.toFixed(1)} mm) is within 10% of your target (${r.targetDepth} mm). Well calibrated.` });
  } else if (r.depthStatus === 'fair') {
    recs.push({ type: 'warning', icon: '📏', text: `Application depth (${r.appDepth.toFixed(1)} mm) is ${r.depthDiff.toFixed(0)}% off your target (${r.targetDepth} mm). Consider adjusting travel speed or pressure.` });
  } else {
    recs.push({ type: 'alert', icon: '📏', text: `Application depth (${r.appDepth.toFixed(1)} mm) is ${r.depthDiff.toFixed(0)}% off your target (${r.targetDepth} mm). System needs recalibration — check flow rate, travel speed, and nozzle sizing.` });
  }

  // Find outlier buckets (> 1 StdDev below mean)
  const mean = r.avgVolume;
  const stdDev = populationStdDev(r.validVolumes);
  const lowBuckets = [];
  r.volumes.forEach((v, i) => {
    if (v > 0 && v < mean - stdDev) {
      lowBuckets.push(i + 1);
    }
  });
  if (lowBuckets.length > 0) {
    recs.push({ type: 'warning', icon: '🔍', text: `Buckets ${lowBuckets.join(', ')} collected significantly less water (>1 StdDev below average). Inspect the nozzle(s) nearest these positions for blockages or wear.` });
  }

  // Wind warning
  const windSpeed = parseFloat(document.getElementById('wind-speed').value);
  if (windSpeed && windSpeed > 15) {
    recs.push({ type: 'warning', icon: '💨', text: `Wind was ${windSpeed} km/h — above the recommended 15 km/h limit. Results may be less reliable. Consider re-testing on a calmer day.` });
  }

  const container = document.getElementById('recommendations');
  container.innerHTML = recs.map(r => `
    <div class="recommendation ${r.type}">
      <span class="recommendation-icon">${r.icon}</span>
      <span>${r.text}</span>
    </div>
  `).join('');
}
```

---

### 9. [style.css](file:///Users/aidanwatt/Desktop/Anti%20Gravity/irrigbucket/style.css) — Rename `.lowest-quarter` to `.outlier`

Find this rule:
```css
.bar.lowest-quarter {
  background: var(--status-fair);
}
```

Replace with:
```css
.bar.outlier {
  background: var(--status-fair);
}
```

---

### 10. [style.css](file:///Users/aidanwatt/Desktop/Anti%20Gravity/irrigbucket/style.css) — Add new styles (before `/* --- Progress Steps --- */`)

Insert these styles:

```css
/* --- Section Breakdown Table --- */
.section-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.section-table th {
  text-align: left;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--gray-500);
  padding: 8px 10px;
  border-bottom: 2px solid var(--gray-200);
}

.section-table td {
  padding: 10px;
  border-bottom: 1px solid var(--gray-100);
  color: var(--gray-700);
}

.section-table td.good { color: var(--status-good); font-weight: 700; }
.section-table td.fair { color: var(--status-fair); font-weight: 700; }
.section-table td.poor { color: var(--status-poor); font-weight: 700; }

.section-table tr:last-child td {
  border-bottom: none;
}

.section-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.section-row .form-group {
  margin-bottom: 0;
}

.mt-8 { margin-top: 8px; }
```

---

## Summary of What Changed and Why

| Change | Reason |
|--------|--------|
| DU formula: `1 - (StdDev / Mean)` | Matches NZ industry standard (CV method) |
| Removed Christiansen's CU | Professionals don't use it |
| Added section breakdown for pivots | Professionals analyse inner/outer/gun separately |
| Bar chart highlights outliers (>1 StdDev) | More statistically meaningful than lower quarter |
| Status labels: Pass / Attention / Fail | Matches professional Y / ! / N system |
| Thresholds: ≥80% Pass, 65-79% Attention, <65% Fail | Matches industry thresholds |
