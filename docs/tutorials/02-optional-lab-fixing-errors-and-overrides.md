# Lab 2 — Fix and Refine (Optional)

**Audience:** Users who have completed Lab 1
**Estimated time:** 10 minutes
**Prerequisites:** [Lab 1 — Layout to Quote](./01-core-lab-layout-to-quote.md) completed
**Completion artifact:** A rack line that moved from INVALID → VALID after a deliberate fix, plus an override that remains auditable

---

## Scenario

A colleague shared a project with a rack line that has two problems: an incompatible beam/frame combination and a level placed too close to the frame top. You will reproduce these errors intentionally, read the validation panel to understand them, and apply the correct fixes. You will also make one controlled override and verify it remains visible in the validation state.

---

## Starter state

- **Project:** The project from Lab 1, or any project with at least one rack line in VALID state.
- **Quoter:** Not needed for this lab.

---

## Steps

---

### Step 2.1 — Deliberately break the rack

**Action:** Select your existing rack. In the EditorPanel, open the frame spec selector and change the capacity class to **Light**. Confirm the change.

**Expected result:** The rack status badge changes to **INVALID**. The validation panel lists at least one error: `CAPACITY_CLASS_EXCEEDED`.

> **Business logic:** `CAPACITY_CLASS_EXCEEDED` fires when the beam capacity rank exceeds the frame capacity rank. Capacity class ranks from lowest to highest: Light (0) → Standard (1) → Medium (2) → Heavy (3) → Extra Heavy (4). A Standard beam in a Light frame violates this rule. The rule prevents overloaded assemblies from passing design review.

---

### Step 2.2 — Read the validation panel

**Action:** In the EditorPanel, click "Validation" or expand the validation section. Read all listed errors.

**Expected result:** You see `CAPACITY_CLASS_EXCEEDED` with a short description. Hover or expand any error to see the affected entities (which bay, which level, which frame).

> **Business logic:** Validation errors are entity-scoped: they point back to the specific bay, module, or level that caused them. This traceability is what makes the validation panel actionable rather than generic. An INVALID line blocks the design from producing a clean BOM.

---

### Step 2.3 — Fix the capacity mismatch

**Action:** Change the frame capacity class back to **Standard** (or higher). Confirm.

**Expected result:** The `CAPACITY_CLASS_EXCEEDED` error disappears. If no other errors remain, the status returns to **VALID**.

> **Business logic:** Validation is re-run immediately on every configuration change — there is no separate "re-validate" button. The state is always derived from current configuration.

---

### Step 2.4 — Create a near-top warning

**Action:** Select the rack. Add a third beam level at elevation **136 in** (hole index 68) in a 144-inch-tall frame.

**Expected result:** The rack status changes to **VALID_WITH_WARNINGS**. The validation panel shows `NEAR_FRAME_TOP` as a warning (not a blocking error).

> **Business logic:** `NEAR_FRAME_TOP` fires when the highest beam level is within 4 inches of the frame top but not above it. It is a warning, not a blocking error. The design is still valid and can produce a BOM, but the operator should confirm this is intentional (e.g., flush-top installation).

---

### Step 2.5 — Create a blocking clearance error

**Action:** Move the third level up to elevation **140 in** (hole index 70). This should exceed the `minimumTopClearanceIn` of 6 inches from the 144-inch frame top.

**Expected result:** The status changes to **INVALID**. The validation panel shows `INSUFFICIENT_TOP_CLEARANCE`.

> **Business logic:** `INSUFFICIENT_TOP_CLEARANCE` fires when `elevationIn > frameHeightIn − minimumTopClearanceIn` (e.g., `140 > 144 − 6 = 138`). The minimum top clearance is hard-coded to 6 inches in the catalog registry. This rule ensures adequate space for the pallet load above the top beam.

---

### Step 2.6 — Fix the clearance error

**Action:** Move the third level down to **132 in** (hole index 66) — safely below the clearance boundary.

**Expected result:** `INSUFFICIENT_TOP_CLEARANCE` clears. The status returns to **VALID** (or **VALID_WITH_WARNINGS** if the level remains close to the top).

> **Business logic:** 132 in elevation in a 144 in frame gives 12 inches of top clearance, satisfying the 6-inch minimum. The boundary is `elevationIn ≤ frameHeightIn − minimumTopClearanceIn`.

---

### Step 2.7 — Apply a per-bay beam spec override

**Action:** Select one specific bay in the rack (click the bay, not the whole rack). In the bay detail panel, override the beam spec to a **Heavy** beam at the same length.

**Expected result:** The overridden bay shows a different beam spec than the other bays. The rack status re-evaluates. If the frame supports Heavy beams, the status remains VALID.

> **Business logic:** Bay-level overrides are marked `isBeamSpecCustomized = true`. Override-specific validation rules (`CAPACITY_CLASS_EXCEEDED_OVERRIDE`, `CONNECTOR_TYPE_MISMATCH_OVERRIDE`, etc.) also run against every frame override spec on the module. This ensures that a shared level that is VALID for the default frame spec is also VALID for every per-frame override spec in the module.

---

### Step 2.8 — Confirm the override is auditable

**Action:** Look at the bay panel or module detail. Confirm that the overridden bay is visually distinguished (different color, badge, or label) from unoverridden bays.

**Expected result:** The overridden bay shows a clear visual indicator that it uses a non-default spec.

> **Business logic:** Overrides must stay explicit and auditable. The design document serializes `isBeamSpecCustomized` and the override spec alongside the default spec, so anyone loading the project can see which bays diverge from the module default.

---

## Checkpoint

**Question:** After completing all steps, does the rack line show **VALID** or **VALID_WITH_WARNINGS** status (not INVALID), and is the overridden bay visually distinct from the others?

**Pass condition:** Yes — the status is at most VALID_WITH_WARNINGS, and the override is visible in the UI.

---

## Completion artifact

- [x] A rack line that was deliberately broken and then fixed back to VALID
- [x] A per-bay beam spec override that is visually auditable in the editor

---

## Sidebars

> **User takeaway:** Validation errors are self-describing and entity-scoped. You do not need to guess which bay or level caused the error — the panel tells you. Always fix INVALID lines before sending to Quoter.

> **Internal logic:** Override-specific rules (`*_OVERRIDE` error codes) exist because a module's shared beam levels must be valid for every per-frame override spec, not just the module's default spec. A level that fits the default 144-in Standard frame might not fit a per-frame 96-in Light override. The validation engine checks both paths separately.

---

## What to do next

This lab completes the standard user curriculum. For advanced scenarios (back-to-back layouts, deep BOM traceability, export differences), refer to the internal documentation track:

- [Internal docs →](./internal/)
