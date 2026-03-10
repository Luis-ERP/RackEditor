# CAD Export Implementation Checklist

This checklist translates the CAD export specification into implementation work items.

Source specification:

- [docs/cad_export_file_spec.md](docs/cad_export_file_spec.md)

---

## 1. Planning and Scope Lock

- [ ] Confirm the first export target is **ASCII DXF** only.
- [ ] Confirm the target DXF dialect is **AutoCAD 2018 / AC1032**.
- [ ] Confirm first-version scope is **2D model-space export only**.
- [ ] Confirm supported exported entity types are:
  - [ ] rack modules
  - [ ] rack lines
  - [ ] walls
  - [ ] columns
  - [ ] text notes
- [ ] Confirm excluded content for first version:
  - [ ] grid
  - [ ] rulers
  - [ ] selection overlays
  - [ ] drag previews
  - [ ] snapping guides
  - [ ] temporary UI helpers
- [ ] Confirm non-goals remain excluded:
  - [ ] DWG output
  - [ ] 3D export
  - [ ] paper-space layout
  - [ ] title block generation
  - [ ] PDF plotting
  - [ ] BIM / IFC

---

## 2. Export Architecture

- [ ] Define the export pipeline stages.
- [ ] Split implementation into clear steps:
  - [ ] collect visible layout entities
  - [ ] transform editor coordinates into CAD coordinates
  - [ ] map entities to export primitives
  - [ ] assemble DXF tables and sections
  - [ ] serialize ASCII DXF output
  - [ ] validate result
- [ ] Define a stable internal export data model independent of the canvas renderer.
- [ ] Ensure export uses semantic/layout data, not screen pixels.
- [ ] Ensure export does not depend on zoom, viewport, or dark mode.

---

## 3. Coordinate System and Units

- [ ] Implement world-to-CAD coordinate conversion.
- [ ] Convert current editor coordinates to CAD orientation with **positive Y upward**.
- [ ] Preserve `X` positions.
- [ ] Invert or transform `Y` consistently so output opens correctly in CAD.
- [ ] Set all exported geometry to `Z = 0`.
- [ ] Export all geometry in **meters**.
- [ ] Ensure **1 drawing unit = 1 meter**.
- [ ] Preserve rotation in decimal degrees.
- [ ] Preserve entity insertion/base points.
- [ ] Ensure serialization precision is **0.001 m** or better.

---

## 4. DXF File Skeleton

- [ ] Implement DXF section writer.
- [ ] Emit sections in required order:
  - [ ] `HEADER`
  - [ ] `TABLES`
  - [ ] `BLOCKS`
  - [ ] `ENTITIES`
  - [ ] `OBJECTS`
  - [ ] `EOF`
- [ ] Omit `CLASSES` in the first version.
- [ ] Implement tagged ASCII DXF serialization using group-code/value pairs.
- [ ] Ensure final file ends with valid `EOF` marker.

---

## 5. DXF Header Implementation

- [ ] Write `$ACADVER = AC1032`.
- [ ] Write `$INSUNITS = 6`.
- [ ] Write `$MEASUREMENT = 1`.
- [ ] Write `$LUNITS = 2`.
- [ ] Write `$AUNITS = 0`.
- [ ] Compute drawing extents from visible exported entities.
- [ ] Write `$EXTMIN` from computed minimum XY bounds.
- [ ] Write `$EXTMAX` from computed maximum XY bounds.

---

## 6. DXF Tables

### 6.1 Linetype table
- [ ] Define `CONTINUOUS`.
- [ ] Define `CENTER`.
- [ ] Define `HIDDEN`.

### 6.2 Layer table
- [ ] Create all required layers:
  - [ ] `RACK_OUTLINE`
  - [ ] `RACK_FRAME`
  - [ ] `RACK_BEAM`
  - [ ] `RACK_LABEL`
  - [ ] `WALL`
  - [ ] `COLUMN`
  - [ ] `ANNOTATION_TEXT`
  - [ ] `ANNOTATION_DIM`
  - [ ] `AUX_ORIGIN`
  - [ ] `AUX_GRID`
  - [ ] `METADATA`
- [ ] Set layer color defaults.
- [ ] Set layer linetype defaults.
- [ ] Set layer lineweight defaults.
- [ ] Set non-plot behavior for `AUX_*` and `METADATA` layers if supported by the chosen DXF strategy.

### 6.3 Text style table
- [ ] Define text style `RACKEDITOR_STD`.
- [ ] Use CAD-safe sans-serif fallback.
- [ ] Prefer `Arial` or CAD default simplex-style equivalent.
- [ ] Set width factor to `1.0`.
- [ ] Set oblique angle to `0`.

### 6.4 Dimension style table
- [ ] Define `RACKEDITOR_DIM` if dimensions are exported.
- [ ] Set decimal metric units.
- [ ] Set precision to `0.001`.
- [ ] Set angular precision to `0.1°`.
- [ ] Set text height to 2.5 mm plotted equivalent.
- [ ] Set arrow size to 2.5 mm plotted equivalent.
- [ ] Set extension line offset to 1.5 mm.
- [ ] Set extension overshoot to 1.5 mm.
- [ ] Set text gap to 0.8 mm.

### 6.5 APPID table
- [ ] Define `ACAD`.
- [ ] Define `RACKEDITOR` if XDATA is implemented.

---

## 7. Layer Mapping Rules

- [ ] Enforce uppercase layer names only.
- [ ] Enforce maximum layer-name length of 31 characters.
- [ ] Ensure every exported entity maps to exactly one primary layer.
- [ ] Ensure production geometry never uses `AUX_*` or `METADATA` layers.
- [ ] Use `BYLAYER` color for exported entities.
- [ ] Use `BYLAYER` linetype for exported entities.
- [ ] Use `BYLAYER` lineweight for exported entities.

### 7.1 Required layer assignments
- [ ] Rack outer perimeter → `RACK_OUTLINE`
- [ ] Rack frames/uprights → `RACK_FRAME`
- [ ] Rack beams → `RACK_BEAM`
- [ ] Rack labels → `RACK_LABEL`
- [ ] Walls → `WALL`
- [ ] Columns → `COLUMN`
- [ ] Text notes → `ANNOTATION_TEXT`
- [ ] Dimensions → `ANNOTATION_DIM`
- [ ] Optional origin marker → `AUX_ORIGIN`
- [ ] Optional exported reference grid → `AUX_GRID`
- [ ] Metadata carriers → `METADATA`

---

## 8. Supported DXF Entity Writers

- [ ] Implement writer for `LINE`.
- [ ] Implement writer for `LWPOLYLINE`.
- [ ] Implement writer for `CIRCLE`.
- [ ] Implement writer for `ARC` if needed.
- [ ] Implement writer for `ELLIPSE` if needed.
- [ ] Implement writer for `HATCH`.
- [ ] Implement writer for `TEXT`.
- [ ] Implement writer for `MTEXT`.
- [ ] Implement writer for `DIMENSION` only if dimension export is enabled.
- [ ] Do not implement splines, proxy objects, ACIS solids, regions, dynamic blocks, or annotative objects for the first version.

---

## 9. Rack Export

### 9.1 Geometry extraction
- [ ] Collect visible rack module and rack line entities.
- [ ] Read width, depth, rotation, and label.
- [ ] Preserve physical extents.
- [ ] Preserve shared-upright behavior from the current editor.

### 9.2 Geometry generation
- [ ] Export rack outer boundary as `LWPOLYLINE` on `RACK_OUTLINE`.
- [ ] Export frame/upright geometry as `LWPOLYLINE` on `RACK_FRAME`.
- [ ] Export beam geometry as `LWPOLYLINE` on `RACK_BEAM`.
- [ ] Export rack labels as `TEXT` or `MTEXT` on `RACK_LABEL`.
- [ ] Optionally export fills as `HATCH` using current light-theme colors.

### 9.3 Shared frame handling
- [ ] Detect adjacent rack bays that share a physical upright.
- [ ] Suppress duplicate shared-upright geometry.
- [ ] Verify resulting rack geometry remains clean and non-duplicated.

### 9.4 Styling
- [ ] `RACK_OUTLINE` lineweight = 0.35 mm.
- [ ] `RACK_FRAME` lineweight = 0.25 mm.
- [ ] `RACK_BEAM` lineweight = 0.25 mm.
- [ ] `RACK_LABEL` uses text style `RACKEDITOR_STD`.

---

## 10. Wall Export

- [ ] Collect visible wall entities.
- [ ] Read origin, length, thickness, rotation, and label.
- [ ] Convert wall geometry into closed rectangular `LWPOLYLINE` body.
- [ ] Place wall outline on `WALL` layer.
- [ ] Add optional fill `HATCH`.
- [ ] If dotted wall texture is implemented, use only a simple CAD-compatible hatch approach.
- [ ] Verify wall thickness is preserved after coordinate transform.
- [ ] Verify rotated walls remain correct in CAD.

---

## 11. Column Export

### 11.1 Rectangular columns
- [ ] Export as closed `LWPOLYLINE` on `COLUMN`.
- [ ] Add optional solid `HATCH`.
- [ ] Add internal diagonal `LINE` cross.

### 11.2 Round columns
- [ ] Export as `CIRCLE` when width and depth represent a true circle.
- [ ] Export as `ELLIPSE` only if non-circular round/oval geometry is needed.
- [ ] Add optional solid `HATCH`.
- [ ] Add internal diagonal cross only if visually supported and still readable.

### 11.3 Validation
- [ ] Verify center point is preserved.
- [ ] Verify width/depth are preserved.
- [ ] Verify rotation or shape interpretation is consistent.

---

## 12. Text Note Export

- [ ] Collect visible text note entities.
- [ ] Preserve insertion point.
- [ ] Preserve rotation.
- [ ] Preserve text content.
- [ ] Preserve text height where explicit.
- [ ] Use `TEXT` for single-line content.
- [ ] Use `MTEXT` for multi-line content.
- [ ] Restrict visible output to printable ASCII for first version.
- [ ] Transliterate unsupported characters rather than dropping them.
- [ ] Map notes to `ANNOTATION_TEXT`.

---

## 13. Optional Dimension Export

- [ ] Decide whether first implementation includes dimensions or defers them.
- [ ] If included, ensure all dimensions use `ANNOTATION_DIM`.
- [ ] Apply dimension style `RACKEDITOR_DIM`.
- [ ] Enforce metric decimal output.
- [ ] Enforce non-duplicated dimensions.
- [ ] Place dimensions outside objects whenever practical.
- [ ] Do not dimension hidden geometry.
- [ ] Use true geometry references, not hatch boundaries.

---

## 14. Styling Implementation

### 14.1 Linework
- [ ] Use `CONTINUOUS` for racks, walls, columns, labels, and text notes.
- [ ] Do not use `HIDDEN` in the first version.
- [ ] Use `CENTER` only for optional origin/reference geometry.

### 14.2 Colors
- [ ] Apply current light-theme export colors through layers.
- [ ] Ensure output remains readable in monochrome.
- [ ] Ensure lineweight, not only color, communicates hierarchy.

### 14.3 Text sizes
- [ ] Rack labels default to 3.5 mm plotted height when not explicitly defined.
- [ ] Text notes default to 2.5 mm plotted height when not explicitly defined.
- [ ] Dimension text defaults to 2.5 mm plotted height.
- [ ] Future sheet title text defaults to 5.0 mm plotted height.

---

## 15. Metadata Implementation

### 15.1 File-level metadata
- [ ] Store application name = `RackEditor`.
- [ ] Store export timestamp.
- [ ] Store export format version.
- [ ] Store units.
- [ ] Store drawing bounds.
- [ ] Store project name if available.
- [ ] Store app version if available.

### 15.2 Entity-level metadata
- [ ] Preserve layout entity id.
- [ ] Preserve entity type.
- [ ] Preserve linked rack domain id when present.
- [ ] Preserve label/name when present.
- [ ] Preserve source dimensions when useful.

### 15.3 Carrier strategy
- [ ] Decide first-version metadata carrier:
  - [ ] XDATA
  - [ ] extension dictionaries
  - [ ] defer metadata implementation
- [ ] If using XDATA, register `RACKEDITOR` in `APPID`.
- [ ] Ensure metadata never breaks DXF interoperability.

---

## 16. Extents and Visibility Rules

- [ ] Export visible entities only.
- [ ] Exclude locked-state UI effects from export.
- [ ] Exclude selection state from export.
- [ ] Exclude hover state from export.
- [ ] Exclude drag-preview state from export.
- [ ] Compute extents from exported entities only.

---

## 17. Validation and Error Handling

### 17.1 Structural validation
- [ ] Validate section order.
- [ ] Validate required tables exist.
- [ ] Validate all referenced layers exist.
- [ ] Validate all referenced linetypes exist.
- [ ] Validate all referenced text styles exist.
- [ ] Validate file terminates correctly.

### 17.2 Geometric validation
- [ ] Reject or sanitize `NaN` coordinates.
- [ ] Reject or sanitize infinite coordinates.
- [ ] Reject non-planar geometry.
- [ ] Reject invalid negative sizes or thicknesses.
- [ ] Verify all closed outlines are actually closed.
- [ ] Verify rotated entities remain geometrically valid.

### 17.3 Content validation
- [ ] Ensure no unsupported entity type is emitted.
- [ ] Ensure no duplicate shared rack members are emitted.
- [ ] Ensure no UI-only helper entities leak into export.
- [ ] Ensure text output obeys first-version encoding rules.

---

## 18. Interoperability Testing

- [ ] Open exported files in an AutoCAD-compatible viewer.
- [ ] Open exported files in DraftSight-class software if available.
- [ ] Open exported files in LibreCAD and/or QCAD if available.
- [ ] Confirm no repair prompt appears on open.
- [ ] Confirm drawing extents are correct.
- [ ] Confirm units are interpreted as meters.
- [ ] Confirm geometry orientation is correct.
- [ ] Confirm layer names and properties are present.
- [ ] Confirm text is readable.
- [ ] Confirm fills/hatches do not break compatibility.

---

## 19. Regression Test Cases

- [ ] Empty layout exports a valid but minimal DXF.
- [ ] Single rack module exports correctly.
- [ ] Multi-bay rack line exports without duplicate shared uprights.
- [ ] Horizontal wall exports correctly.
- [ ] Rotated wall exports correctly.
- [ ] Rectangular column exports correctly.
- [ ] Round column exports correctly.
- [ ] Single-line text note exports as `TEXT`.
- [ ] Multi-line text note exports as `MTEXT`.
- [ ] Mixed drawing with racks, walls, columns, and notes exports correctly.
- [ ] Large drawing still computes correct extents.
- [ ] Negative and positive coordinates export correctly.
- [ ] Non-default rotations export correctly.

---

## 20. UX and Product Tasks

- [ ] Define export command entry point in the app.
- [ ] Define default output filename pattern.
- [ ] Define file extension as `.dxf`.
- [ ] Define user-facing export error messages.
- [ ] Define user-facing success message.
- [ ] Decide whether export should include optional metadata in first release.
- [ ] Decide whether export should include optional fills/hatches in first release.

---

## 21. Documentation Tasks

- [ ] Document supported entities.
- [ ] Document unsupported entities.
- [ ] Document unit behavior.
- [ ] Document coordinate conversion behavior.
- [ ] Document first-version limitations.
- [ ] Add example output files for QA/reference.
- [ ] Link implementation to [docs/cad_export_file_spec.md](docs/cad_export_file_spec.md).

---

## 22. Done Criteria

The implementation is done only when all of the following are true:

- [ ] valid ASCII DXF is generated
- [ ] file opens without repair prompt in target CAD tools
- [ ] exported geometry is in meters at 1:1 scale
- [ ] positive Y is upward in CAD
- [ ] supported entities export correctly
- [ ] UI-only aids are excluded
- [ ] layers, linetypes, and text styles are valid
- [ ] shared rack geometry is clean
- [ ] extents are correct
- [ ] output matches the approved specification
