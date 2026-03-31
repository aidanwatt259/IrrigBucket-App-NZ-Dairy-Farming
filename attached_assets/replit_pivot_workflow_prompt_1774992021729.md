# IrrigBucket — Centre Pivot Workflow Redesign

## Prompt for Replit

---

### Context

I'm building **IrrigBucket**, a mobile-first irrigation bucket test calculator for NZ dairy farmers (HTML/CSS/JS, no framework). The app already supports multiple irrigator types (K-Line, Travelling Gun, Rotary Boom, Fixed Grid, Centre Pivot, Linear Move). Each type follows a multi-step flow: select type → enter system specs → get bucket test plan → enter data → see results.

**I need to completely redesign the Centre Pivot flow** to match how NZ irrigation professionals actually test pivots in the field. An industry professional has provided detailed guidance about the correct process.

The app uses:
- **Vanilla HTML/CSS/JS** (single `index.html`, `style.css`, `app.js`)
- **DU formula:** `DU = 1 − (STDEV.P / MEAN)` (CV method — already implemented)
- **Status thresholds:** ≥80% Pass, 65–79% Attention, <65% Fail
- **CSS design system** with custom properties (greens, blues, earth tones, Inter font)
- **Mobile-first design** at max-width 640px

---

### What needs to change (Centre Pivot only)

The current centre pivot flow treats it like every other irrigator — uniform bucket spacing across the whole length. **This is wrong.** Industry professionals split the pivot into distinct sections with different bucket spacings. Here is the correct 5-step process:

---

## Step 1: Enter Pivot Specifications

The user enters 3 key specs:
1. **Pivot Length** (radius in metres, e.g. 590m)
2. **Target Depth** (mm, e.g. 10mm)
3. **Bucket Diameter** (mm, e.g. 245mm)

And these optional operational fields (keep existing):
- Number of Spans
- Operating Pressure (bar)
- Total Number of Sprinklers
- System Flow Rate (L/s)
- Full Revolution Time (hours)
- **Has End Gun** (Yes/No toggle — NEW)

**On clicking "Calculate"**, the app should **automatically** compute the section breakdown and bucket placement using this industry-standard logic:

### Automatic Section Calculation Logic

The pivot is split into sections based on distance from the centre:

| Section | Range | Buckets | Spacing | Rationale |
|---------|-------|---------|---------|-----------|
| **Section A (Inner)** | 0 to ¼ of pivot length | **0 buckets** | N/A | Water application is extremely high near the centre because ground speed is almost zero. Testing here would massively distort the DU calculation. |
| **Section B (Mid)** | ¼ to ¾ of pivot length | Calculated | ~21m apart | Standard sprinkler spacing zone. The middle 50% of the pivot. |
| **Section C (Outer)** | ¾ to end of pivot length | Calculated | ~11m apart | Higher resolution testing needed because sprinkler density increases and wetted width is narrower in the outer spans. Spacing is approximately half of Section B. |
| **End Gun** (if present) | Beyond pivot length | 3 buckets | ~5m apart | End guns throw water beyond the main pivot arm. Always 3 buckets at ~5m spacing. |

**Example calculation for a 590m pivot with end gun:**
- Section A: 0–148m → 0 buckets
- Section B: 148–443m (295m span) → ⌈295 / 21⌉ = 15 buckets at 21m apart (first bucket at 148m mark)
- Section C: 443–590m (147m span) → ⌈147 / 11⌉ = 14 buckets at 11m apart
- End Gun: 3 buckets at 5m apart (starting just beyond 590m)
- **Total: 32 buckets**

This should match the reference report which had 32 buckets for a 590m pivot.

The **bucket spacing within each section should adjust slightly** so that buckets are evenly distributed across the section span. For example, if Section B is 295m and needs 15 buckets: actual spacing = 295 / (15 − 1) = 21.07m ≈ 21m.

---

## Step 2: Arrange the Buckets (Bucket Test Plan)

After calculation, show a **clear section-by-section breakdown** that the farmer can take to the field.

Display:

### Summary Stats
- Total number of buckets needed
- Number of sections
- Pivot length

### Section-by-Section Layout Table

| Section | Distance Range | No. Buckets | Spacing | First Bucket Position |
|---------|---------------|-------------|---------|----------------------|
| Section A (Inner) | 0 – 148m | 0 | — | N/A (no testing) |
| Section B (Mid spans) | 148 – 443m | 15 buckets | 21m apart | 148m from centre |
| Section C (Outer spans) | 443 – 590m | 14 buckets | 11m apart | 443m from centre |
| End Gun | Beyond 590m | 3 buckets | 5m apart | 595m from centre |

Include a visual callout/info box explaining:
> *"The inner ¼ of the pivot is excluded from testing. Near the pivot point, ground speed approaches zero, causing extremely high application depths that would distort the DU calculation. Industry practice is to begin testing from the ¼-point outward."*

### Placement Diagram
Update the canvas diagram to show the sectioned layout:
- Draw the pivot arm as a horizontal line from centre to tip
- **Section A** (inner ¼): shown as a greyed-out/hatched zone with "No Testing" label
- **Section B** (middle ½): shown with blue bucket dots at wider spacing
- **Section C** (outer ¼): shown with blue bucket dots at tighter spacing
- **End Gun** (if present): shown extending slightly beyond the pivot tip with 3 dots

Use different colours or shading for each section so the farmer can visually understand the layout.

### Pre-Test Checklist
Keep the existing checklist items but add:
- "Place all buckets in a straight RADIAL line from the ¼-point to beyond the tip"
- "Keep all buckets at least 15m from any wheel tracks"
- "Number buckets sequentially starting from the inner-most position"

---

## Step 3: Record Machine Operation (NEW STEP)

**This is a brand new step** that doesn't exist in the current app. After the farmer has placed buckets, they need to record what the machine is actually doing during the test.

Create a new screen/step with these input fields:

| Field | Type | Unit | Placeholder | Notes |
|-------|------|------|-------------|-------|
| Actual Speed | number | m/min | e.g. 1.15 | Speed at the outer tower |
| Inlet Pressure | number | kPa | e.g. 399 | Pressure at the pivot point |
| Speed Test Time | text | — | e.g. 4m 22s | Time to travel the reference distance |
| Speed Test Distance | number | m | e.g. 5 | Reference distance for speed test |
| Wetted Width | number | m | e.g. 14 | How wide the spray pattern is |
| Corner Arm | number | m | — | Length of corner arm if present (optional) |
| Percent Timer Setting | number | % | e.g. 80 | The speed dial setting |
| Weather Conditions | text | — | e.g. Calm, 12°C | General conditions during test |
| Wind Speed | number | km/h | e.g. 5 | Wind speed during test |
| Wind Direction | text | — | e.g. NW | |
| Test Date | date | — | Today | Pre-filled to today |
| Test Start Time | time | — | — | When the pivot started its pass |
| Test End Time | time | — | — | When collection was complete |

Group these logically with headings:
- **Speed & Pressure**: speed, pressure, speed test time/distance, percent timer
- **Spray Pattern**: wetted width, corner arm
- **Conditions**: weather, wind speed/direction, date, start/end times

This data is recorded for the report but does NOT affect DU calculations.

Button: **"Continue to Data Entry →"**

---

## Step 4: Record Sample (Bucket) Data

The bucket volume entry screen should be **grouped by section**, not just a flat numbered grid.

### Section-Grouped Data Entry

Show section headers above each group of bucket inputs:

```
📍 Section B — Mid Spans (148–443m)
   15 buckets at 21m spacing

   [#1 ___mL] [#2 ___mL] [#3 ___mL] [#4 ___mL]
   [#5 ___mL] [#6 ___mL] [#7 ___mL] [#8 ___mL]
   [#9 ___mL] [#10 __mL] [#11 __mL] [#12 __mL]
   [#13 __mL] [#14 __mL] [#15 __mL]

📍 Section C — Outer Spans (443–590m)
   14 buckets at 11m spacing

   [#16 __mL] [#17 __mL] [#18 __mL] [#19 __mL]
   [#20 __mL] [#21 __mL] [#22 __mL] [#23 __mL]
   [#24 __mL] [#25 __mL] [#26 __mL] [#27 __mL]
   [#28 __mL] [#29 __mL]

📍 End Gun (beyond 590m)
   3 buckets at 5m spacing

   [#30 __mL] [#31 __mL] [#32 __mL]
```

Bucket numbering is **sequential across all sections** (the farmer numbers them 1 through N in the field, starting from the innermost bucket in Section B). The section headers make it clear which section each bucket belongs to.

Button: **"Calculate Results →"**

---

## Step 5: Report

The results screen should produce a **professional report** matching the format of industry standard reports. Here's the structure (based on the reference "Wiper FarmRd.pdf" report from the old app):

### Results Summary Header
Show key identifiers:
- Date, Assessor/Farmer name (could add a name field in Step 1 or Step 3)
- Farm name, Irrigator name
- Irrigation Type: "Center Pivot"

### Overall DU Results Card
- **Overall Pivot DU**: Calculate DU across ALL sections combined (Section B + C + End Gun volumes merged)
- **Overall Application Depth**: Average across all sections
- **Overall Intensity** (mm/hour): If revolution time was provided
- Status badge: Pass / Attention / Fail

### Section Breakdown Table
This is the key output — a table with per-section results:

| Section | Distribution Uniformity (DU) | Status | Applied Depth Avg (mm) | Depth Status | Intensity (mm/hr) |
|---------|------------------------------|--------|------------------------|--------------|-------------------|
| Pivot (overall) | 0.63 | N | 8.76 | ! | — |
| Inner Span (B) | 0.63 | N | 9.41 | Y | — |
| End Span (C) | 0.68 | ! | 8.38 | ! | — |
| End Gun | — | — | 5.23 | N | 40.37 |

**Status key:** Y = Pass (≥80%) | ! = Attention (65–79%) | N = Fail (<65%)

Note: For the End Gun section, DU may not be meaningful with only 3 buckets — show the average depth but consider whether to show/hide DU for sections with fewer than 4 buckets.

### Logged Data Summary
Display all the operational data from Step 3 in a clean two-column layout:

| Parameter | Value |
|-----------|-------|
| Pivot Length | 590 m |
| Inlet Pressure | 399 kPa |
| Speed | 1.15 m/min |
| Wetted Width | 14 m |
| Speed Test | 5m in 4m 22s |
| Bucket Diameter | 245 mm |
| Bucket Open Area | 0.047 m² |
| Target Depth | 10.4 mm |
| With End Gun | Yes |

### Recorded Bucket Volumes Table
Show all individual bucket readings grouped by section:

```
Inner Span
#1: 270mL  #2: 400mL  #3: 300mL  ...

End Span
#16: 510mL  #17: 370mL  ...

End Gun
#30: 350mL  #31: 300mL  #32: 90mL
```

### Water Distribution Bar Chart
Keep the existing bar chart but colour-code bars by section:
- Section B bars: blue
- Section C bars: teal/cyan
- End Gun bars: orange
- Outlier bars (>1 StdDev from section mean): highlighted in a warning colour

### Recommendations
Keep the existing recommendation engine but make section-specific recommendations:
- If a particular section fails, tell the farmer which nozzle positions to inspect
- If the end gun section is performing poorly, recommend end gun adjustment
- Include application rate assessment against target depth

### Export/Print
The "Export Report" button should format the report for printing in a professional layout similar to the reference PDF report.

---

## Important Technical Details

### Updated Progress Bar
The centre pivot flow now has **5 steps** instead of 4. Update the progress indicator accordingly:
1. Specs → 2. Arrange → 3. Operation → 4. Data → 5. Report

The other irrigator types should keep their existing 4-step flow. Only centre pivot gets the 5-step flow.

### Data Flow
The section definitions created in Step 1 need to persist through all subsequent steps. Store them in the `currentSetup` object:

```javascript
currentSetup.sections = [
  { name: 'Section A (Inner)', startM: 0, endM: 148, numBuckets: 0, spacing: null, label: 'No testing zone' },
  { name: 'Section B (Mid spans)', startM: 148, endM: 443, numBuckets: 15, spacing: 21, label: 'Standard spacing' },
  { name: 'Section C (Outer spans)', startM: 443, endM: 590, numBuckets: 14, spacing: 11, label: 'High-resolution zone' },
  { name: 'End Gun', startM: 590, endM: 605, numBuckets: 3, spacing: 5, label: 'End gun throw' },
];
currentSetup.totalBuckets = 32;
currentSetup.operationData = {}; // filled in Step 3
```

### Section splitting when auto-calculating

The bucket count per section should be calculated as:
```javascript
// Section B: middle half of pivot (¼ to ¾)
const sectionBLength = pivotLength * 0.5; // ¾ - ¼ = 0.5
const sectionBBuckets = Math.ceil(sectionBLength / 21);
const sectionBActualSpacing = sectionBLength / (sectionBBuckets - 1);

// Section C: outer quarter (¾ to end)
const sectionCLength = pivotLength * 0.25;
const sectionCBuckets = Math.ceil(sectionCLength / 11);
const sectionCActualSpacing = sectionCLength / (sectionCBuckets - 1);

// End Gun: always 3 at 5m
const endGunBuckets = hasEndGun ? 3 : 0;
```

### Keep all other irrigator types unchanged
This redesign ONLY affects the Centre Pivot flow. K-Line, Travelling Gun, Rotary Boom, Fixed Grid, and Linear Move should continue working exactly as they do now.

### Reference Data (to validate your implementation)
The reference "Wiper FarmRd" test had:
- **Pivot length:** 590m
- **32 total buckets** (no buckets in inner zone, rest split across sections + end gun)
- **Bucket diameter:** 245mm
- **Bucket open area:** 0.047 m² (π × 0.1225² = 0.04714 m²)
- **Target depth:** 10.4mm
- **Inlet pressure:** 399 kPa
- **Speed:** 1.15 m/min
- **Wetted width:** 14m
- **Overall DU:** 0.63 (N = Fail)
- **Inner Span DU:** 0.63 (N)
- **End Span DU:** 0.68 (!)
- **End Gun average depth:** 5.23mm

If you enter the same specs, your app should produce the same section breakdown and, given the same bucket volumes, the same DU results.

---

## Summary of changes:
1. **Step 1**: Add "Has End Gun" toggle. Auto-calculate section breakdown (A/B/C/EndGun) from pivot length.
2. **Step 2**: Show section-by-section bucket arrangement table + updated sectioned diagram. Remove the old "Define Sections" manual input (sections are now auto-calculated from specs).
3. **Step 3**: NEW screen for recording machine operational data (speed, pressure, wetted width, etc.)
4. **Step 4**: Group bucket data entry by section with clear headers showing section name, distance range, and spacing.
5. **Step 5**: Professional report with section breakdown table, operational logged data summary, section-coloured bar chart, and section-specific recommendations.
6. **Progress bar**: 5 dots for centre pivot flow, 4 dots for all other types.
7. **All other irrigator types**: NO changes whatsoever.
