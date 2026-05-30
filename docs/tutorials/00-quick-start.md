# Quick Start

**Read time:** 5 minutes
**No actions required** — this is an orientation, not a lab.

---

## What RackEditor is

RackEditor is a rack-domain design tool. It is not general-purpose CAD. Every drawing it produces is driven by a semantic configuration of real rack components — frames, beams, and levels — pulled from a product catalog. The geometry you see on screen is a consequence of that configuration, not the source of truth.

This distinction matters because:

- You cannot draw an arbitrary shape and call it a rack.
- Every rack placement represents a real assembly: a frame count, a beam spec, a set of beam levels with precise hole-grid elevations.
- The BOM, the quote, and any export derive from that assembly — not from the drawing.

---

## The three workspaces

| Workspace | Route | Purpose |
|-----------|-------|---------|
| **CAD Editor** | `/` | Design surface. Place rack modules, configure frame and beam specs, define levels, validate. |
| **Quoter** | `/quoter` | Commercial workspace. Import the CAD BOM, add line items, apply tax and fees, generate a quote PDF. |
| **Catalog** | `/catalog` | Browse available frame and beam specs. Useful for spec lookup before designing. |

The other modules (Clients, HubSpot, Quick BOM, Chatbot) are support tools around this core workflow.

---

## The design → quote flow

```
CAD Editor  →  (Send to Quoter)  →  Quoter  →  Quote PDF
    ↓                                   ↓
 Project JSON                      BOM snapshot
 (saved locally)                  (quote line items)
```

1. You design in the CAD Editor and configure rack modules.
2. When the design is ready, you send it to the Quoter. This serializes the canvas into a project document and derives a BOM from the rack domain semantics.
3. In the Quoter, you review the BOM, adjust pricing, add manual items, and export the quote.

---

## Key concepts

### Rack line

A rack line is a continuous sequence of bays sharing a common depth and beam specification. It is the primary design entity in the CAD Editor. A line can be single-row or back-to-back.

### Bay

A bay is the space between two adjacent frames. Bay width is constrained to valid beam lengths from the catalog.

### Frame

A frame is an upright pair (column + base plate). Frame count is derived: `N bays → N + 1 frames`. You do not place frames individually.

### Beam level

A beam level is a pair of beams at a specific elevation within a bay. Elevations must align to the hole grid (`HOLE_STEP_IN = 2 inches`). Levels must be strictly ordered bottom to top.

### Validation state

Every rack line carries a validation state:
- **INCOMPLETE** — no beam levels defined
- **VALID** — all rules satisfied
- **VALID_WITH_WARNINGS** — rules satisfied but approaching limits (e.g., very close to frame top)
- **INVALID** — one or more blocking rule violations

A design with any INVALID or INCOMPLETE line cannot produce a clean BOM.

---

## What the canvas is not

- The canvas does not store dimensions directly. Frame height, beam length, and level elevations come from catalog-backed configurations.
- Dragging a rack on the canvas moves its position but does not change its rack configuration.
- Exporting a PNG or PDF of the canvas gives you a presentation image, not a semantic document. The project JSON (`.rackproject` file) is the semantic export.

---

## Next step

When you are ready to do real work, start with **Lab 1: Layout to Quote**. It walks you through placing a rack run, configuring it, and sending the BOM to Quoter.

- [Lab 1 → Layout to Quote](./01-core-lab-layout-to-quote.md)
- [Lab 2 → Fix and Refine (optional)](./02-optional-lab-fixing-errors-and-overrides.md)
