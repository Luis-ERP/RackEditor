# Lab 1 — Layout to Quote

**Audience:** First-time users
**Estimated time:** 10–15 minutes
**Prerequisites:** Read [Quick Start](./00-quick-start.md) first
**Completion artifact:** A saved project with one VALID rack module + a BOM snapshot in Quoter

---

## Scenario

A client needs a selective rack line for a small aisle. You will draw a rack module on the canvas, configure its frame and beam specs, add two beam levels, validate the design, and send the BOM to Quoter.

---

## Starter state

- **Project:** blank canvas (start from `/`)
- **Quoter:** empty

---

## Steps

---

### Step 1.1 — Create a new project

**Action:** Click the **folder icon** at the top of the left navigation rail and create a new project. Name it `Lab 1 — First Rack`.

**Expected result:** The canvas clears and the project name appears in the navigator. The canvas is empty.

> **Business logic:** Projects are stored locally in your browser. Each project holds a canvas snapshot (entity layout) plus the rack domain semantics (frame specs, beam levels, validation states). The drawing and the configuration travel together.

---

### Step 1.2 — Activate the Rack drawing tool

**Action:** At the **bottom-center of the canvas** there is a floating **DrawingToolbar**:

```
[Select]  |  [Rack]  |  [Wall-Rectangle]  [Wall-Line]  |  [Column]  |  [Note]
```

Click the **Rack** icon to activate drawing mode. The cursor changes to a crosshair.

**Expected result:** The Rack button in the DrawingToolbar appears highlighted/active.

> **Business logic:** There is no rack-creation dialog. You place bays by drawing directly on the canvas grid. The orientation toggle (horizontal / vertical) appears in the EditorPanel while the drawing tool is active.

---

### Step 1.3 — Draw the rack on the canvas

**Action:** With the Rack tool active, **click and drag** on the canvas over 2–4 grid cells. Release the mouse.

**Expected result:** A rack module appears on the canvas immediately. Each cell you covered became one bay. The rack is auto-selected and the **EditorPanel** on the left shows **INCOMPLETE** status.

> **Business logic:** INCOMPLETE means the rack has no beam levels yet. Clicking a cell adjacent to an existing rack extends it by one bay. Clicking between two rack modules merges them. Bay count is set by how many cells you draw — it is not a form field.

---

### Step 1.4 — Exit drawing mode and select the rack

**Action:** Press **Escape** or click the **Select** tool in the DrawingToolbar to leave drawing mode. Then click the rack on the canvas to select it.

**Expected result:** The **RackModuleEditor** appears in the left panel (Edition tab) with collapsible sections: Frame, Beam, Beam Levels.

---

### Step 1.5 — Configure the frame

**Action:** In the **Frame** section of the RackModuleEditor, use the segmented controls to set:

| Control | Suggested value |
|---------|----------------|
| Height | 144 in |
| Depth | 42 in |
| Capacity | Std |

**Expected result:** The canvas updates the rack graphic to reflect the new frame spec immediately.

> **Business logic:** Every change commits immediately — there is no "Save" button inside the editor. Frame depth must be uniform across all bays in the same module.

---

### Step 1.6 — Configure the beam length

**Action:** In the **Beam** section, use the segmented control to select a beam length (e.g. **96 in**).

**Expected result:** The beam spec updates on the canvas.

> **Business logic:** Beam capacity is set per-level in the Beam Levels section, not here.

---

### Step 1.7 — Add two beam levels

**Action:** In the **Beam Levels** section, click **"+ Add Beam Level"** twice.

**Expected result:** Two levels appear in the SVG front-view diagram and in the level list below it. The rack status changes from **INCOMPLETE** to **VALID** (or **VALID_WITH_WARNINGS**).

> **Business logic:** Levels auto-position above each other. You can drag beam handles in the SVG diagram to reposition them, or edit the hole-index field directly. Levels must be strictly ordered bottom to top; the app enforces minimum gap between adjacent levels.

---

### Step 1.8 — Save the project

**Action:** Press `Cmd+S` (Mac) or `Ctrl+S` (Windows), or click the save button in the project navigator.

**Expected result:** The dirty indicator (orange dot on the folder icon) disappears.

> **Business logic:** Saving serializes both the canvas layout and the rack domain state into one project document stored in the browser's local storage.

---

### Step 1.9 — Send to Quoter

**Action:** In the EditorPanel, click the **third tab** (the gear / Settings icon — the **Project** tab). Scroll to the **Quoter** subsection and click **"Send to Quoter →"**.

**Expected result:** The browser navigates to `/quoter`. The Quoter page loads with a BOM snapshot already populated: line items for frames, beams, and related hardware.

> **Business logic:** The CAD page serializes the project and writes a BOM snapshot to `sessionStorage` (key: `quoter:pendingCadImport`). The Quoter reads and clears that entry on load. The BOM quantities are derived from the rack's semantic configuration — they are not entered manually.

---

### Step 1.10 — Review the BOM in Quoter

**Action:** In the Quoter, review the line items. Confirm the quantities match your design (frames = bays + 1, beams = bays × levels × 2, etc.).

**Expected result:** The BOM quantities match your rack. Each line item shows the SKU, catalog cost, and quantity.

---

## Checkpoint

**Pass condition:** The Quoter shows line items derived from your rack module (frames, beams, hardware) with quantities that match the bay and level counts you drew.

---

## Completion artifact

- [x] A saved project named "Lab 1 — First Rack" with a rack module in **VALID** or **VALID_WITH_WARNINGS** state
- [x] A BOM snapshot in the Quoter pre-populated from the CAD design

---

## Next step

- [Lab 2 → Fix and Refine (optional)](./02-optional-lab-fixing-errors-and-overrides.md)
