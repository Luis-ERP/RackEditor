# RackEditor Project Document Schema (v1)

Status: Iteration 1 (compatibility-first)
Date: 2026-03-12

## Goal

Persist full editor progress for:
- Local recovery (cache/autosave)
- File-based sharing (JSON export)
- File-based restore (JSON import)

This first version mirrors existing domain/store shapes as closely as possible. Optimization and normalization can be done in later schema versions.

## Design Principles (v1)

- Compatibility-first: keep current `layoutStore`, `wallStore`, `columnStore`, and rack-domain structures.
- Versioned document: every payload carries `schemaVersion`.
- Non-destructive evolution: future migrations should transform older versions to the newest shape.

## Canonical Document Shape

```json
{
  "documentType": "rack-editor-project",
  "schemaVersion": "1.0.0",
  "exportedAt": "2026-03-12T00:00:00.000Z",
  "app": {
    "name": "RackEditor",
    "version": "web-v1"
  },
  "layout": {
    "entities": []
  },
  "semantics": {
    "rackDomain": {
      "modules": []
    },
    "wallStore": {
      "defaultThicknessM": 0.2,
      "overrides": {}
    },
    "columnStore": {
      "defaultWidthM": 0.4,
      "defaultDepthM": 0.4
    }
  },
  "canvas": {
    "darkMode": false,
    "rackOrientation": "horizontal",
    "drawingMode": false,
    "wallMode": null,
    "columnMode": false
  }
}
```

## Why This Mapping

- `layout.entities` comes from `layoutStore.snapshot()` and preserves object/canvas placement state.
- `semantics.rackDomain.modules` stores the rack domain objects referenced by rack entities.
- `semantics.wallStore` and `semantics.columnStore` keep non-layout semantics needed to continue editing.
- `canvas` preserves the most relevant visual/interaction state for continuity.

## Cache + File Strategy

- Cache key scope: `rack-editor:project:main`
- Autosave debounce: 250ms
- Restore policy: try cache once at startup; ignore malformed payloads safely
- File export: JSON download, same schema as cache payload
- File import: validate schema and restore all stores + canvas state, then refresh cache

## Planned Evolution (Flexible)

- v1.1: add migration metadata and validation diagnostics in payload.
- v1.2: add explicit camera/viewport persistence if needed.
- v2.0: normalize rack-domain graph if/when domain schema stabilizes further.
