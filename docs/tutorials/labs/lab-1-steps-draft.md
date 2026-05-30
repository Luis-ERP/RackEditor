# Lab 1 — Actual steps (draft for review)

This file documents the real UI flow as read from the source code.
Please correct any step that is still wrong, missing, or mis-described.

---

## What actually happens when you create a rack

### 1. Select the Rack drawing tool

At the bottom center of the canvas there is a floating **DrawingToolbar** with these tools:

```
[Select]  |  [Rack]  |  [Wall-Rectangle]  [Wall-Line]  |  [Column]  |  [Note]
```

Click the **Rack** icon to activate drawing mode.
The cursor changes to a crosshair/cell cursor.

---

### 2. Draw bays on the canvas

While drawing mode is active, **click and drag** on the canvas.

Each click places a single bay. Dragging extends the run.
The canvas is divided into a grid of bay-sized cells. Each occupied cell
becomes one bay in a rack module.

- Clicking a cell adjacent to an existing rack extends that rack by one bay.
- Clicking a cell between two existing rack modules merges them.
- Each new bay starts with the DEFAULT specs from `catalog.js`.
- At the right panel, orientation can be modified for the bays direction (vertical or horizontal)

The rack is placed immediately — there is **no configuration dialog**.

---

### 3. Exit drawing mode

Press **Escape** or click the **Select** tool in the DrawingToolbar
to return to selection mode.

---

### 4. Click the rack to select it

Click the rack on the canvas to select it.

When a single `RACK_MODULE` entity is selected, the left **EditorPanel**
(Edition tab) shows the **RackModuleEditor** below the Position section.

The editor has collapsible configuration sections:
- Frame
- Per-frame overrides
- Beam
- Beam levels
- Back to Back

---

### 5. Configure the frame (left panel — Frame section)

The **Frame** section shows three segmented controls:

| Control | Options |
|---------|---------|
| Height | 96 / 120 / 144 / 168 / 192 (inches) |
| Depth | 36 / 42 (inches) |
| Capacity | Light / Std / Med / Heavy |

Pick the desired combination. Every change is committed to the canvas immediately.

---

### 6. Configure the beam (left panel — Beam section)

The **Beam** section shows one segmented control:

| Control | Options |
|---------|---------|
| Length | 48 / 92 / 96 / 102 / 108 / 120 / 144 (inches) |

Beam capacity is set per-level (see step 7).

---

### 7. Add / edit beam levels (left panel — Beam Levels section)

The **Beam Levels** section shows:
- A front-view diagram of the rack with draggable beam handles.
- A list of current levels with their hole-index (elevation) and beam capacity (Light, Standard, Medium, Heavy).
- A **"+ Add Beam Level"** button at the bottom.

To add a level: click **"+ Add Beam Level"**.
The level is auto-positioned above the existing ones.

To move a level: drag the beam handle in the diagram above, or edit the hole-index field in the list.
To remove a level: click the close icon next to it.

---

### 8. Read the validation banner

The **ValidationBanner** appears at the top of the RackModuleEditor
whenever the current configuration has errors or warnings.

States:
- No banner → INCOMPLETE (no levels) or VALID
- Yellow banner → VALID_WITH_WARNINGS
- Red banner → INVALID (lists error codes)

---

### 9. Change bay count (canvas drawing, not a field)

Bay count is **not a field in the editor**.
To increase bays: reactivate the Rack tool and draw more cells adjacent to the existing rack.
To decrease bays: double-click to select a bay (sub-select on canvas) and delete it via the canvas toolbar or the backspace key.

---

### 10. Send to Quoter

"Send to Quoter" is **not in a toolbar at the top**.
It is in the **third tab** ("Project" tab, Settings icon) of the EditorPanel.

Steps:
1. Click the "Project" tab (gear/Settings icon) in the EditorPanel tab row.
2. Under the "Quoter" subsection, click **"Send to Quoter →"**.
3. All the bill of materials is expanded here, along side with other relevant information for a sale.
4. Click the "Download PDF" on the top right corner 

---

