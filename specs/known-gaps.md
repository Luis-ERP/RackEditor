# RACK CONFIGURATION SYSTEM
## LOGICAL FLAWS AND VALIDATION GAPS
**Version:** Analysis Draft
**Based on:** `business_rules_racks.md` + `model_schema.md`
**Purpose:** Enumerate configurations that are **physically impossible or operationally invalid** yet pass every stated validation rule `[V1]–[V9]` and all business-rule constraints as written.

---

## HOW TO READ THIS DOCUMENT

Each finding follows this structure:

- **What is the flaw?** — the concrete configuration
- **Why does it pass?** — which rule(s) are absent or incomplete
- **Physical consequence** — what breaks in the real world
- **Source of truth gap** — which document is missing or contradicts the other

Severity labels:
- `[CRITICAL]` — silently produces an impossible or dangerous rack
- `[HIGH]` — produces an incorrect BOM, pricing, or uninstallable rack
- `[MEDIUM]` — produces an ambiguous or operationally useless rack
- `[LOW]` — edge case; unlikely in practice but the model allows it

---

## CATEGORY 1 — MISSING VALIDATION RULES

### FLAW-01 · Beams at floor level (holeIndex = 0) `[CRITICAL]`

**What is the flaw?**
A `BeamLevelConfig` with `holeIndex = 0` is structurally valid under rule `[V3]`, which requires only that `holeIndex` is a non-negative integer.

`elevationOf(level) = 0 × 2 = 0"` — beams seated at floor level.

**Why does it pass?**
Business rules Section 8 defines a `minimum_floor_clearance` constraint:
```
first_beam_elevation ≥ minimum_floor_clearance
```
This rule does **not exist** in the schema's validation catalogue (`[V1]–[V9]`). It is described as varying "by system or installation standard" and was apparently never promoted to a hard `[V]` check.

**Physical consequence**
The fork truck cannot operate under the first pallet position. The rack is installed but functionally useless from the first level up. Operators cannot lift pallets onto the beams from a floor-level position.

**Source of truth gap**
business_rules_racks.md §8 vs. model_schema.md §8 — rule stated in one document, absent in the other.

---

### FLAW-02 · Beam connector assembly below the floor `[CRITICAL]`

**What is the flaw?**
Even without holeIndex = 0, a beam at `holeIndex = 1` (elevation = 2") with `verticalEnvelopeIn = 10"` has its connector hanging at:
```
2" − 10" = −8"  (below floor level)
```

**Why does it pass?**
`[V5]` computes minimum gap **between adjacent levels** using `verticalEnvelopeIn`, but it only applies between two existing levels. There is no rule checking that the *lowest* level's connector does not descend below grade (elevation 0").

`[V3]` permits `holeIndex = 1`.

**Physical consequence**
The connector assembly would need to be embedded in the concrete floor to be physically installed. The frame's base plate and anchor bolts would also conflict with the connector.

**Source of truth gap**
Neither document defines a concrete rule: `first_beam_elevation ≥ verticalEnvelopeIn_of_first_level`. This is a direct gap — the envelope math used in §5 of business_rules_racks.md is never applied downward toward the floor.

---

### FLAW-03 · No connector-type compatibility check in `[V1]` `[CRITICAL]`

**What is the flaw?**
`[V1]` defines compatibility as:
```
isBeamCompatible(level, frame) =
  level.spec.compatibleUprightSeries.includes(frame.spec.uprightSeries)
```
`BeamSpec` also carries a `connectorType` field. `FrameSpec` has no corresponding `compatibleConnectorTypes` list. No validation rule compares `beam.connectorType` against the frame's slot pattern.

**Why does it pass?**
Business rules Section 12 explicitly states:
> "Connector type must match frame slot pattern"

This constraint produces **no validation rule** in the schema. `[V1]` only checks series compatibility.

**Physical consequence**
A teardrop-slot beam connector installed on a round-hole upright (or vice versa) physically cannot be seated. The beam would be uninstallable, fall off under load, or require field modifications that void manufacturer warranties. The BOM would list a combination that cannot be assembled.

**Source of truth gap**
business_rules_racks.md §12 states the rule; model_schema.md §8 `[V1]` does not implement it. `BeamSpec.connectorType` is a dead field — it is stored but never used by any validator.

---

### FLAW-04 · Beam and frame capacity class cross-check is only a warning `[HIGH]`

**What is the flaw?**
Business rules Section 12 states:
> "Beam capacity must be within frame allowable limits"

The only capacity rule in the schema is `[W1]` (a WARNING for near-capacity usage). There is no `[V]` rule that flags a beam whose `capacityClass` exceeds the frame's `capacityClass` as **INVALID**.

**Why does it pass?**
If a heavy-duty beam is placed on a light-duty frame, all `[V1]–[V9]` checks pass as long as the beam's `compatibleUprightSeries` includes the frame's series. Structural overloading is at most flagged as a warning, not blocked.

**Physical consequence**
The frame uprights are specified and priced for light loads. Under heavy loads they will buckle or fail. The BOM is cost-mismatched and the structure is unsafe.

---

### FLAW-05 · Top clearance rule is absent from the schema `[MEDIUM]`

**What is the flaw?**
A beam placed at the highest legal hole (`holeIndex = frameHoleCount`) passes `[V6]`:
```
frameHoleCount = floor(heightIn / HOLE_STEP_IN)
```
For a 144" frame: `floor(144/2) = 72 holes`. A beam at hole 72 is seated at 144" — the exact top of the frame.

**Why does it pass?**
Business rules Section 7 mentions:
> "top clearance between the highest beam and frame top **may** be required by safety rules"

The word "may" was not hardened into a `[V]` rule. No minimum top clearance exists in the schema.

**Physical consequence**
There is no space for beam installation hardware above the topmost beam. Row-tie plates and overhead bracing, which typically attach above the highest beam level, have no room. In many jurisdictions and manufacturer specs, a minimum top clearance (e.g., 6"–12") is mandated. A beam flush with the frame top also means the pallet and load overhang the frame top, creating a tip-over risk.

---

### FLAW-06 · No minimum practical bay width `[MEDIUM]`

**What is the flaw?**
`BayConfig.widthIn > 0` is the only constraint. A bay width of `0.001"` satisfies it.

**Why does it pass?**
No minimum bay width rule exists in either document beyond `> 0`.

**Physical consequence**
A bay 0.001" wide cannot accommodate any real beam. No catalog beam would have `lengthIn = 0.001"`, so `[V2]` would prevent adding beam levels — the bay would be permanently INCOMPLETE. But the bay itself is structurally modeled, included in frame count, BOM, and canvas geometry, producing corrupted output.

---

### FLAW-07 · Bay with no beam levels is never INVALID, only INCOMPLETE `[MEDIUM]`

**What is the flaw?**
`BayConfig.beamLevels` may be empty. An empty bay has validation state INCOMPLETE, not INVALID. The schema does not define a transition rule from INCOMPLETE to INVALID for "permanently empty" bays.

**Why does it pass?**
Business rules Section 11 sets minimum bay count ≥ 1 (number of bays), but sets no minimum beam level count per bay. The schema allows `beamLevels: []` and classifies it as INCOMPLETE.

**Physical consequence**
A rack line with bays containing no beams cannot store pallets. It consists only of upright frames with no horizontal members — structurally equivalent to an array of freestanding columns. The BOM omits all beams and derived accessories (safety pins, beam locks, wire decking supports) for those bays. The generated quote would be incomplete and the assembled structure would fail inspection.

---

### FLAW-08 · `widthIn` has no catalog SKU validation `[HIGH]`

**What is the flaw?**
`BayConfig.widthIn` is a raw `number`. An empty bay can be set to any positive value — for example `97.5"` — for which no catalog `BeamSpec` exists (`BeamSpec.lengthIn` values are discrete catalog entries).

**Why does it pass?**
`[V2]` checks `level.spec.lengthIn === bay.widthIn`, but only for existing beam levels. An empty bay with `widthIn = 97.5"` has no levels, so `[V2]` is never evaluated. The bay sits as INCOMPLETE indefinitely.

**Physical consequence**
No valid beam can ever be added to this bay: every catalog beam will fail `[V2]`. The configuration is permanently incomplete but never flagged as INVALID or unresolvable.

---

## CATEGORY 2 — BACK-TO-BACK REPRESENTATION AMBIGUITY

### FLAW-09 · `rowConfiguration` and `backToBackConfig.rowCount` can contradict each other `[HIGH]`

**What is the flaw?**
`RackLine` stores `rowConfiguration` (e.g., `BACK_TO_BACK_3`) and `BackToBackConfig.rowCount` (e.g., `2`) as two independent fields. Neither field is derived from the other. No validation rule checks their agreement.

Example of a silently invalid state:
```json
{
  "rowConfiguration": "BACK_TO_BACK_3",
  "backToBackConfig": { "rowSpacerSizeIn": 6, "rowCount": 2 }
}
```

**Why does it pass?**
The schema constraint is:
> `rowConfiguration ≠ SINGLE → backToBackConfig ≠ null`

It only checks that `backToBackConfig` is present — not that `rowCount` matches the row count implied by `rowConfiguration`. Both fields survive independently.

**Physical consequence**
BOM derivation for row spacers, tie plates, and anchors is based on `rowCount`. A mismatch produces a structurally incorrect BOM (e.g., spacers calculated for 2 rows on a 3-row structure). The accessory count will be wrong. The rack will be under-specified.

---

### FLAW-10 · Frame array has no row-membership annotation for back-to-back `[CRITICAL]`

**What is the flaw?**
In a back-to-back rack, Row A and Row B are physically separate structures. The schema places ALL frames for ALL rows into a single `RackLine.frames[]` array. `FrameConfig` has no `rowIndex` field.

**Why does it pass?**
The schema says back-to-back rows are represented in the same `RackLine`. But no rule defines which frames belong to Row A vs Row B. The BOM cannot derive "row spacers are needed between row A position k and row B position k" without knowing which frame belongs to which row.

**Physical consequence**
- The BOM cannot correctly count row spacers (which span between paired frames of row A and row B).
- The canvas renderer cannot place the two rows on opposite sides of the shared back line.
- The geometry of the back-to-back structure (total depth = `depth_A + spacer + depth_B`) is underivable because `depth_A` and `depth_B` are the same value (enforced by `[V9]`).
- Accessory derivation rules for tie plates and row bracing cannot be applied without row membership.

---

### FLAW-11 · `[V9]` contradicts business rules §9.2 on different row depths `[HIGH]`

**What is the flaw?**
Business rules Section 9.2 explicitly models two depth values:
```
frame_depth_A
frame_depth_B
row_spacer_size
```
This implies rows A and B can have different depths. However, `[V9]` mandates:
```
∀ i, j ∈ [0, frames.length−1]: frames[i].spec.depthIn === frames[j].spec.depthIn
```
Since all frames (both rows) are in the same array, `[V9]` forces `depth_A = depth_B` always.

**Why does it pass?**
The contradiction is silent. A rack line with row A depth = 42" and row B depth = 36" is flagged as INVALID by `[V9]`, not VALID. But the business rules say this should be a valid and common configuration (e.g., a 42" deep row facing a 36" deep row).

**Physical consequence**
Real-world back-to-back installations routinely pair different frame depths. A warehouse with mixed-product storage often uses deep back rows (48") for heavy pallets and shallow front rows (36") for picking. This entire class of configurations cannot be represented in the model without violating `[V9]`.

---

### FLAW-12 · A module can span across the physical row boundary in a back-to-back line `[HIGH]`

**What is the flaw?**
Suppose a back-to-back line has 10 frames: positions 0–4 are Row A, positions 5–9 are Row B (conceptually — but the schema doesn't mark this). A `ModuleConfig` with `startFrameIndex = 3` and 4 bays spans positions 3–7, crossing the row boundary at position 4/5.

**Why does it pass?**
`[V7]` and `[V8]` only check that module frame ranges are within bounds and contiguous. They have no concept of "row boundary." A cross-boundary module passes all checks.

**Physical consequence**
The BOM would count beam levels across two physically separate row structures as a single bay. The canvas would draw beams spanning the aisle — connecting Row A frames to Row B frames. The structure described does not exist physically.

---

### FLAW-13 · Minimum row spacer size has no physical lower bound `[MEDIUM]`

**What is the flaw?**
`BackToBackConfig.rowSpacerSizeIn > 0` is the only constraint. A spacer of `0.001"` satisfies it.

**Why does it pass?**
Neither the business rules nor the schema define a minimum practical spacer size (typically 3"–6" in real installations, plus a code-required minimum back-to-back clearance).

**Physical consequence**
A spacer of 0.001" means the back faces of the two row frames are essentially touching. There is no room for row ties, no aisle behind the rack, and no access for maintenance. The total rack depth would be calculated as `42 + 0.001 + 42 = 84.001"` — generating a meaningless geometry.

---

## CATEGORY 3 — UNDERDEFINED STRUCTURAL RULES

### FLAW-14 · `levelIndex` need not be sequential `[MEDIUM]`

**What is the flaw?**
`BeamLevelConfig.levelIndex` is required to be a non-negative integer, strictly increasing within a bay. But it need not be sequential from 0. A valid bay can have levels with `levelIndex = {0, 50, 100}`.

**Why does it pass?**
`[V3]`: `levelIndex ≥ 0, integer`. `[V4]`: strictly increasing. Neither requires consecutive integers.

**Physical consequence**
No direct structural consequence. But:
- `isModuleBeamLevelsUniform()` compares levelIndex values across bays. Two bays with the same physical placement could have `{0, 1}` vs `{0, 50}` and be reported as non-uniform, when they are physically identical.
- BOM-level counting of beam levels (e.g., "find the 3rd level") depends on `levelIndex` as a semantic identifier. Gaps make this non-deterministic without a secondary sort.
- Factory patterns produce sequential indices. Manual construction can produce non-sequential ones. The inconsistency is undetected.

---

### FLAW-15 · Beam physical height above the seat is not modeled `[HIGH]`

**What is the flaw?**
`BeamSpec.verticalEnvelopeIn` models only the connector depth **below** the beam seat. The beam's structural depth **above** the seat (the actual beam profile height, typically 3"–6") is not a field in `BeamSpec` and plays no role in any `[V]` rule.

**Why does it pass?**
`[V5]` minimum gap formula:
```
minimumGapSteps = ceil((HOLE_STEP_IN + max(lower.verticalEnvelopeIn, upper.verticalEnvelopeIn)) / HOLE_STEP_IN)
```
This calculates the gap between adjacent beam **seats** (hole positions). It accounts for the upper beam's connector reaching down toward the lower beam's seat. It does NOT account for the lower beam's profile height reaching UP toward the upper beam's connector.

**Physical consequence**
The gap between a lower beam's top surface and an upper beam's bottom connector is:
```
actual_clear_gap = (holeIndex_diff × 2") − upper.verticalEnvelopeIn − lower_beam_profile_height
```
The formula omits `lower_beam_profile_height`. Two levels placed at the minimum gap allowed by `[V5]` may still have their physical beam bodies overlapping if the lower beam is deep (e.g., a 6" structural channel). The BOM would list two beams that cannot physically coexist at those positions.

---

### FLAW-16 · A VALID rack can have zero accessories, including mandatory floor anchors `[HIGH]`

**What is the flaw?**
A `RackLine` with `validationState = VALID` and `accessoryIds = []` satisfies all `[V1]–[V9]` rules. Floor anchors, safety pins, and beam locks are entirely absent.

**Why does it pass?**
Business rules Section 10.1 labels floor anchors as "derived accessories" with:
> `anchors_per_frame = 2 or 4 depending on base plate type`

But the schema's `[V1]–[V9]` rules check only structural geometry. They do not verify that derived accessories are present in `accessoryIds`. The BOM `bomSnapshot` is allowed to be `null` on a VALID rack.

**Physical consequence**
A rack without floor anchors is unstable under seismic and forklift impact loads. Most building codes and rack manufacturer installation requirements mandate anchoring. Generating a quote from this VALID design would omit mandatory components and produce a legally non-compliant installation spec.

---

### FLAW-17 · Overlapping rack lines in a DesignRevision are not detected `[MEDIUM]`

**What is the flaw?**
`DesignRevision.rackLines[]` can contain any number of `RackLine` objects. No spatial coordinate system is defined for the design floor plan, and no validation rule checks for physical overlap between lines.

**Why does it pass?**
Neither document defines frame absolute coordinates. Frame positions are implicit (accumulated bay widths) but there is no absolute $(x, y)$ origin stored on `RackLine`. Two rack lines that would physically occupy the same floor area are indistinguishable from two spatially separate lines.

**Physical consequence**
Two rack lines occupying the same coordinates in a warehouse would literally occupy the same physical space. The canvas renderer would draw them superimposed. A quote generated from the collision would produce double the frames, beams, and accessories for the overlapping area.

---

### FLAW-18 · `holeIndex` is checked to be an integer, but not protected against floating-point representation errors `[LOW]`

**What is the flaw?**
In JavaScript, `Number.isInteger(27.0)` returns `true`. A `holeIndex` of `27.000000000001` (from floating-point arithmetic) would fail the integer check, but `26.999999999999` would appear to pass `Number.isInteger()` silently if coerced.

More importantly: `holeIndex` could be set to `Infinity` or `NaN` — both are `number` type in JavaScript. `NaN ≥ 0` is `false`, so `[V3]` would catch `NaN`. But `Infinity ≥ 0` is `true`, `Number.isInteger(Infinity)` is `false` — so Infinity is caught. However, this only holds if the validator explicitly checks `Number.isInteger`, which is not specified in the schema.

**Why does it pass (potentially)?**
The schema says "non-negative integer" but does not specify the exact integer check mechanism. If the implementation uses `Math.floor(holeIndex) === holeIndex`, a `holeIndex = 3.0` would pass (correct), but the contract leaves room for implementation variance.

---

## CATEGORY 4 — RULE CONTRADICTIONS BETWEEN DOCUMENTS

### FLAW-19 · Summary of cross-document rule contradictions

| # | Rule in `business_rules_racks.md` | Status in `model_schema.md` | Consequence |
|---|---|---|---|
| 4-A | §8: first beam elevation ≥ minimum floor clearance | **Absent** — not in `[V1]–[V9]` | Floor-level beams pass as VALID |
| 4-B | §12: connector type must match frame slot | **Absent** — `[V1]` only checks uprightSeries | Incompatible connectors pass as VALID |
| 4-C | §7: optional top clearance rule | **Absent** — no mention in schema validation | Beams at frame top pass as VALID |
| 4-D | §9.2: frame_depth_A and frame_depth_B may differ | **Contradicted** — `[V9]` forces all frames same depth | Different-depth back-to-back is INVALID not VALID |
| 4-E | §10.1: anchors are always derived from base plate type | **Not enforced** — no `[V]` rule checks accessory presence | VALID rack with zero anchors |
| 4-F | §12: beam capacity within frame allowable limits | **Downgraded** — only a `[W1]` warning, not INVALID | Overloaded frames pass as VALID_WITH_WARNINGS |

---

## CATEGORY 5 — EXTREME EDGE CASES

### FLAW-20 · A rack line with exactly 2 frames and 1 bay: trivially valid but operationally marginal

A single-bay rack with one beam level at `holeIndex = 1` (2") is fully valid under all rules. Physically, this installs a rack that holds pallets 2" off the ground with no ability to reach them with a fork truck. Every rule passes. No warning is issued.

This is a combination of FLAW-01 (no floor clearance check) and the absence of any rule requiring a minimum number of functional beam levels to constitute a "complete" rack.

---

### FLAW-21 · Two bays in the same module with different `widthIn` produce a valid but unequal-bay-width module

**What is the flaw?**
A `ModuleConfig` can contain bays with `widthIn = 96"` and `widthIn = 48"`, all satisfying `[V2]` independently. The module's `isModuleBeamLevelsUniform()` query would compare only `holeIndex` and `spec.id`, not `widthIn`. Two bays with different widths but the same beam levels would be reported as uniform — but they cannot share the same beam SKU because `spec.lengthIn` differs.

Wait — actually [V2] would prevent this: if bay[0].widthIn = 96 and bay[1].widthIn = 48, they must have different beam specs. `isModuleBeamLevelsUniform` would return false because `spec.id` differs. So uniformity is correctly derived. This is not a flaw in the uniformity query.

However: the `buildUniformModule(frameSpec, beamSpec, holeIndices, bayCount, bayWidthIn)` factory creates all bays with the same `widthIn`. There is no factory guard preventing a post-factory mutation that sets different `widthIn` values on individual bays. The factory is safe; direct construction is not.

---

### FLAW-22 · `frameHoleCount` using `floor()` creates a silent 1-inch dead zone

For a frame with `heightIn = 145"`:
```
frameHoleCount = floor(145 / 2) = 72 holes
top hole elevation = 72 × 2 = 144"
dead zone above = 145" − 144" = 1"
```
`[V6]` permits a beam at hole 72 (seated at 144"). The frame physically extends 1" above the beam seat. This 1" cannot be used for any hole (no hole exists at 144.5" or 145"). The frame top 1" is structurally present but topologically invisible to the model.

This is not a flaw per se, but it means the BOM and canvas representation silently ignore up to `HOLE_STEP_IN − 1 = 1"` of frame height at the top. A frame specified as 145" is always modeled and rendered as effectively 144".

---

## SUMMARY TABLE

| ID | Category | Severity | Root Gap |
|---|---|---|---|
| FLAW-01 | Missing validation | `[CRITICAL]` | No floor clearance rule in `[V]` |
| FLAW-02 | Missing validation | `[CRITICAL]` | Connector below floor not checked |
| FLAW-03 | Missing validation | `[CRITICAL]` | connectorType not in `[V1]` |
| FLAW-04 | Missing validation | `[HIGH]` | Capacity cross-check is only warning |
| FLAW-05 | Missing validation | `[MEDIUM]` | No top clearance `[V]` rule |
| FLAW-06 | Missing validation | `[MEDIUM]` | No minimum practical bay width |
| FLAW-07 | Missing validation | `[MEDIUM]` | No minimum beam level count per bay |
| FLAW-08 | Missing validation | `[HIGH]` | widthIn not catalog-validated on empty bays |
| FLAW-09 | Back-to-back | `[HIGH]` | rowConfiguration vs rowCount can diverge |
| FLAW-10 | Back-to-back | `[CRITICAL]` | No row membership on FrameConfig |
| FLAW-11 | Back-to-back | `[HIGH]` | [V9] contradicts biz rule §9.2 |
| FLAW-12 | Back-to-back | `[HIGH]` | Modules can span row boundary |
| FLAW-13 | Back-to-back | `[MEDIUM]` | No minimum spacer size |
| FLAW-14 | Underdefined rules | `[MEDIUM]` | Non-sequential levelIndex |
| FLAW-15 | Underdefined rules | `[HIGH]` | Beam height above seat not modeled |
| FLAW-16 | Underdefined rules | `[HIGH]` | VALID rack with zero anchors |
| FLAW-17 | Underdefined rules | `[MEDIUM]` | No spatial overlap check between lines |
| FLAW-18 | Edge case | `[LOW]` | Integer validation implementation gap |
| FLAW-19 | Contradictions | — | Cross-document rule conflict table |
| FLAW-20 | Extreme edge | `[MEDIUM]` | Fork-truck-unreachable VALID rack |
| FLAW-21 | Extreme edge | `[LOW]` | Factory-safe but direct-construction unsafe |
| FLAW-22 | Extreme edge | `[LOW]` | floor() dead zone at frame top |

---

## RECOMMENDED ADDITIONS TO VALIDATION RULES

The following new rules, directly derived from the gaps above, would close the most critical flaws:

```
[V10] First-level floor clearance
      IF bay.beamLevels.length > 0:
        bay.beamLevels[0].holeIndex × HOLE_STEP_IN ≥ MINIMUM_FLOOR_CLEARANCE_IN
        AND bay.beamLevels[0].holeIndex × HOLE_STEP_IN ≥ bay.beamLevels[0].spec.verticalEnvelopeIn

[V11] Connector type compatibility
      ∀ level in bay: level.spec.connectorType ∈ leftFrame.spec.compatibleConnectorTypes
                      level.spec.connectorType ∈ rightFrame.spec.compatibleConnectorTypes
      (Requires adding compatibleConnectorTypes to FrameSpec)

[V12] rowConfiguration matches backToBackConfig.rowCount
      IF rowConfiguration = BACK_TO_BACK_N:
        backToBackConfig.rowCount = N

[V13] Row membership annotation
      FrameConfig must carry rowIndex: number when rowConfiguration ≠ SINGLE
      (Requires adding rowIndex field to FrameConfig)

[V14] Minimum row spacer size
      IF backToBackConfig ≠ null:
        backToBackConfig.rowSpacerSizeIn ≥ MINIMUM_ROW_SPACER_IN   (catalog-defined)

[V15] Mandatory derived accessories present in BOM
      When validationState transitions to VALID:
        derived BOM must include ≥ 1 anchor entry per frame
        derived BOM must include safety pin entries for all beams

[V16] Bay widthIn must correspond to a catalog BeamSpec
      bay.widthIn ∈ { spec.lengthIn | spec ∈ Catalog.beams }
```

---

*End of analysis*
