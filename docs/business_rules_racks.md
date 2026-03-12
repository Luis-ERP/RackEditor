RACK CONFIGURATION SYSTEM
BUSINESS RULES — SELECTIVE PALLET RACKING
Version: 1.1 — Revised after logical gap analysis
Purpose: Define the structural, geometric, and validation rules governing rack configuration so the system can deterministically derive geometry, BOM, and pricing.

---------------------------------------------------------------------

1. DOMAIN OVERVIEW

A rack line (also called a rack run) represents a continuous sequence of pallet rack bays.

A rack line is composed of the following primary structural components:

- Frames (upright assemblies)
- Beams (horizontal load members)
- Beam Levels (vertical placement of beams)
- Bays (span between two adjacent frames)
- Accessories (derived or explicit add-ons)

The rack system being modeled is selective pallet racking.

All geometry, BOM, and pricing must be derived from semantic configuration data. The drawing on the canvas is only a projection of the domain model and must never be the source of truth.

---------------------------------------------------------------------

2. PRIMARY STRUCTURAL COMPONENTS

2.1 Frames (Uprights)

Frames are vertical assemblies consisting of two upright columns connected by bracing.

Frames define the vertical support structure of the rack and establish bay boundaries.

Frame attributes include:

- Frame height
- Frame depth
- Frame gauge
- Frame capacity class
- Upright series / profile
- Hole pattern (fixed at 2 inch increments)

Frames are positioned along the rack line axis.

Frame positions are discrete and ordered.

For a rack line with N bays:

frame_count = N + 1

Example:

5 bays → 6 frames

Frames may be duplicated across rows for back-to-back configurations.

Frame depth uniformity rule:

All frames within the same rack line must have the same depth.

Frame depth defines the front-to-back footprint of the line — the dimension
that extends into the aisle. If adjacent frames had different depths, the
back-of-rack plane would shift between bays, making pallet positioning
inconsistent and the structure impossible to manufacture or install.

Frame HEIGHT is allowed to vary between positions in the same line (e.g. to
accommodate a taller middle section with additional beam levels). Frame DEPTH
is not.

Changing the line depth means replacing every frame in the line simultaneously.
It is a line-level operation, not a single-frame override.

In back-to-back configurations, depth uniformity is enforced per row, not
across the entire RackLine frame array.

Each row must be internally uniform:

  All frames belonging to Row A must share the same depthIn.
  All frames belonging to Row B must share the same depthIn.

Row A and Row B may have different depths from each other. This is a supported
and common configuration (e.g. 42" deep row paired with a 36" row). The
depth values frame_depth_A and frame_depth_B used in spacer calculations
(see Section 9.2) refer to these per-row depths respectively.

Because frames from different rows can have different depths, each FrameConfig
must carry a rowIndex annotation when the rack line is back-to-back. The
rowIndex is an integer in [0, rowCount − 1] identifying which physical row the
frame belongs to. Depth uniformity is then enforced within each rowIndex
group independently.

---------------------------------------------------------------------

2.2 Bays

A bay is the horizontal span between two adjacent frames.

Bay attributes include:

- Beam length (determines bay width)
- Beam capacity class
- Beam levels
- Optional accessories applied to that bay

A bay always references:

left_frame_index
right_frame_index

Constraints:

- right_frame_index = left_frame_index + 1
- Beam length must match a valid catalog beam SKU.
- Bay width (beam length) must equal a discrete lengthIn value present in the
  active catalog. A bay whose width does not correspond to any catalog SKU is
  permanently unresolvable and must be flagged INVALID, not merely INCOMPLETE.
- A bay must contain at least one beam level to be considered complete.
  A bay with no beam levels contributes frames and bay width to the BOM but
  omits all horizontal members, producing a structurally incoherent rack.
  Such a bay is in INCOMPLETE state; completeness is required before the
  containing rack line can reach VALID state.

All beams within a bay must match the bay beam specification unless explicitly overridden.

---------------------------------------------------------------------

2.3 Beams

Beams are horizontal structural members connecting two frames.

A beam exists within a specific bay and at a specific beam level.

Beam attributes include:

- Beam length
- Beam capacity class
- Beam series / profile
- Connector type
- Vertical connector envelope (see section 4) — clearance consumed below the
  beam seat by the connector hardware.
- Beam profile height — structural depth of the beam body above the beam seat.
  This is the physical height of the beam cross-section and occupies vertical
  space upward from the seat. It is a catalog-defined attribute stored in the
  beam specification and must be included in clearance calculations (see
  Section 5).

Two beams exist per level in each bay:

left beam
right beam

The system may represent these as one logical beam pair or two physical beams depending on BOM modeling.

---------------------------------------------------------------------

2.4 Beam Levels

Beam levels define vertical load positions within the rack.

Each level corresponds to a pair of beams spanning the bay.

Levels are ordered bottom to top.

Attributes per level:

- Beam specification
- Elevation
- Hole index (recommended canonical representation)
- Level index — zero-based sequential integer. The lowest level is levelIndex 0,
  the next is 1, and so on. Level indices must be consecutive integers starting
  at 0. Gaps are not permitted (e.g. {0, 1, 2} is valid; {0, 2, 5} is not).
  This ensures that levelIndex is always an unambiguous ordinal position within
  the bay and that uniformity comparisons across bays produce correct results.

---------------------------------------------------------------------

3. FRAME HOLE PATTERN

Frames are perforated along the upright column with holes every:

2 inches

This hole spacing defines the vertical placement grid for beam connectors.

Constraint:

Beam levels can only be placed on hole positions.

Allowed elevations must therefore align to the hole grid.

If hole index representation is used:

hole_step = 2 inches

elevation_in_inches = hole_index × 2

Constraint:

hole_index must be an integer.

---------------------------------------------------------------------

4. BEAM CONNECTOR VERTICAL ENVELOPE AND BEAM PROFILE HEIGHT

Each beam type has two vertical dimension attributes that govern the physical
space it occupies around the beam seat.

4.1 Connector Envelope (below the seat)

Define:

  beam_vertical_envelope_in

This is the vertical clearance consumed by the connector assembly and support
bracket below the beam seat (downward from the hole position). It is
catalog-defined and stored in the beam specification. It is not constant
across all beams.

4.2 Beam Profile Height (above the seat)

Define:

  beam_profile_height_in

This is the structural depth of the beam cross-section above the beam seat
(upward from the hole position). A standard step beam or structural channel
typically occupies 3−6 inches above the seat. This value is catalog-defined
and stored in the beam specification.

Both values are required in the beam catalog. A beam specification without
either value is incomplete and must not be used in a configuration.

---------------------------------------------------------------------

5. MINIMUM VERTICAL DISTANCE BETWEEN LEVELS

Because beams occupy physical space both below the seat (connector envelope)
and above the seat (beam profile), two adjacent beam levels must maintain a
minimum vertical separation that accounts for both dimensions.

Rule:

  The clear space between the top surface of the lower beam and the bottom of
  the upper connector must be ≥ 0. Concretely, the minimum hole-index gap is:

  minimum_gap_in = hole_step
                 + max(envelope_lower_beam, envelope_upper_beam)
                 + profile_height_lower_beam

Where:

  hole_step                 = 2 inches
  envelope_lower_beam       = lower beam's beam_vertical_envelope_in
  envelope_upper_beam       = upper beam's beam_vertical_envelope_in
  profile_height_lower_beam = lower beam's beam_profile_height_in

To enforce the hole grid:

  minimum_gap_steps = ceil(minimum_gap_in / 2)

Constraint:

  hole_index[i+1] - hole_index[i] >= minimum_gap_steps

Example:

  Lower beam: envelope = 10", profile height = 5"
  Upper beam: envelope = 8",  profile height = 4"

  minimum_gap_in = 2 + max(10, 8) + 5 = 17"
  minimum_gap_steps = ceil(17 / 2) = 9 holes

Note: An earlier version of this formula omitted profile_height_lower_beam.
Omitting it permitted adjacent levels whose physical beam bodies overlap.

---------------------------------------------------------------------

6. LEVEL ORDERING RULES

Beam levels must satisfy:

1. Strict ordering
2. Minimum spacing rule
3. Grid alignment rule

Constraints:

hole_index[i] must be strictly increasing.

hole_index[i+1] - hole_index[i] ≥ required_gap_steps

All levels must align to the hole grid.

---------------------------------------------------------------------

7. FRAME HEIGHT CONSTRAINTS

Beam levels must fit within the frame height.

Constraint:

  top_beam_elevation ≤ frame_height − minimum_top_clearance_in

Where:

  minimum_top_clearance_in is a catalog-defined value (not optional).

Rationale:

A beam seated at the top hole of the frame leaves no room for:
  - Overhead row-tie plate hardware
  - Frame cap plates and bracing anchors
  - Pallet or load clearance above the topmost beam

The minimum top clearance must be defined in the frame specification or as a
global catalog constant. A frame specification that does not carry this value
is incomplete and must not be used in a configuration.

Violating the top clearance constraint is a blocking INVALID error.

---------------------------------------------------------------------

8. FLOOR CLEARANCE

The first beam level must be physically reachable by a fork truck and must not
require its connector hardware to penetrate the floor slab.

Two constraints apply simultaneously:

8.1 Operational floor clearance

  first_beam_elevation ≥ minimum_floor_clearance_in

Where:

  minimum_floor_clearance_in is a catalog-defined constant (not optional).
  It represents the minimum usable entry height for fork truck operation.

Violating this constraint is a blocking INVALID error.

8.2 Connector above-grade constraint

  first_beam_elevation ≥ first_beam.beam_vertical_envelope_in

Rationale:

The connector assembly hangs below the beam seat. If the elevation is less
than the envelope depth, part of the connector would occupy space below the
floor surface, making physical installation impossible.

Violating this constraint is a blocking INVALID error.

In practice, 8.1 is the more restrictive constraint in most installations.
Both must be satisfied independently.

---------------------------------------------------------------------

9. RACK LINE CONFIGURATIONS

Two rack line configurations exist:

Single row
Back-to-back of 2 rows
Back-to-back of 3 rows
Back-to-back of 4 rows

A rack line always starts and ends with a frame, and can have N number of frames in between.
All frames are connected by beam levels. Rack lines must have consecutive modules.
A module starts and ends with a frame, and has a single beam level union. 
Two or more consecutive modules can share adjacent frames. 

Here are examples:

Symbol representation
| frame
= beam levels union

These are valid rack lines configurations:
|=|             1 line of 1 module; 2 frames one beam level union
|=|=|           1 line of 2 modules; 3 frames one beam level union
|=|=| |=|       2 lines, first of 2 modules, second of 1 module

These are invalid rack lines configurations:
|=
|==|
=|=
|=||=|
|
=

---------------------------------------------------------------------

9.1 Single Row

Structure:

Frame — Bay — Frame — Bay — Frame

Frame count:

frame_count = bays + 1

Each bay has beams on each level.

---------------------------------------------------------------------

9.2 Back-to-Back (N rows)

Two or more rows of racks placed with their backs facing each other.

Structure:

  Row 0, Row 1[, Row 2, Row 3]

Rows are physically distinct structures sharing spacing between them.

9.2.1 Row Count

The row count is the single normative value. It is defined by the
rowConfiguration property of the rack line:

  BACK_TO_BACK_2  →  2 rows
  BACK_TO_BACK_3  →  3 rows
  BACK_TO_BACK_4  →  4 rows

No secondary rowCount field exists. Row count is read directly from
rowConfiguration. Any system that derives row count from a separate stored
field introduces a redundancy that can produce contradictory values and must
be avoided.

9.2.2 Row Membership

Every frame in a back-to-back rack line must carry a rowIndex annotation
(integer in [0, rowCount − 1]) identifying which physical row it belongs to.

This annotation is mandatory whenever rowConfiguration ≠ SINGLE.

Rationale:
  - BOM derivation (row spacers, tie plates, back-to-back anchors) depends on
    knowing which frames are paired across the row gap.
  - Canvas rendering requires placing Row 0 and Row 1 frames on opposite sides
    of the shared back line.
  - The total depth formula requires grouping frames by rowIndex:
      total_depth = depth_row_0 + row_spacer + depth_row_1 [+ ...]

9.2.3 Depth Uniformity per Row

As stated in Section 2.1, depth uniformity is enforced per row:

  All frames where rowIndex = r must share the same depthIn value.

Different rows may have different depths. For example, Row 0 may be 42" deep
and Row 1 may be 36" deep. This is a valid and supported configuration.

Spacing between rows is determined by:

  frame_depth_row_0
  frame_depth_row_1   (may differ from row 0)
  row_spacer_size

9.2.4 Module Boundaries

Modules must not span across the row boundary. A ModuleConfig must contain
frames that all share the same rowIndex. A module whose startFrameIndex and
endFrameIndex include frames from different rows is INVALID.

Rationale: a bay is the physical span between two adjacent frames in the same
row. Beams connect frames within a row. There are no beams that cross from one
row to the other (the back-to-back gap contains spacers and ties, not beams).
A module spanning the row boundary would imply a bay connecting frames from
different rows, which is not physically meaningful.

9.2.5 Row Spacer Size

Back-to-back requires additional components:

  - Row spacers
  - Tie plates
  - Additional anchors depending on system design

Row spacer size must satisfy:

  row_spacer_size ≥ minimum_row_spacer_in

Where:

  minimum_row_spacer_in is a catalog-defined constant. It represents the
  minimum clear distance required between row backs to accommodate tie hardware
  and meet manufacturer installation requirements.

A row_spacer_size of 0 or any value below minimum_row_spacer_in is a blocking
INVALID error.

9.2.6 Row spacers per frame pair

  row_spacers_per_frame_pair = catalog rule (derived, not stored)

Both rows may share identical or different frame/beam configurations.

---------------------------------------------------------------------

10. ACCESSORIES

Accessories fall into two categories.

10.1 Derived Accessories

Derived accessories are automatically required based on configuration.
They are not optional selections — they are mandatory outputs of configuration.
A rack line cannot reach VALID state until all required derived accessories
have been computed and are present in the BOM snapshot.

Examples:

- Anchors per base plate
- Row spacers for back-to-back
- Safety pins for beams
- Beam locks
- Decking panels
- Row ties

Derived accessories must be computed deterministically from rack configuration.

Example rules:

  anchors_per_frame        = 2 or 4 depending on base plate type
  safety_pins_per_beam     = 2
  row_spacers_per_frame_pair = catalog rule

A rack line with no floor anchors, no safety pins, or no beam locks
(when required by the frame/beam catalog entries) is INCOMPLETE, not VALID.
A BOM snapshot that omits any mandatory derived accessory is invalid and must
not be used for quoting.

10.2 Explicit Accessories

User-selected accessories applied to:

- Entire rack line
- Specific bay
- Specific level

Examples:

- Column protectors
- Wire decking
- Pallet supports
- Labels

Explicit accessories must be stored as configuration inputs.

---------------------------------------------------------------------

11. BAY COUNT RULES

Minimum bay count:

  1

Constraint:

  bay_count ≥ 1

Frame count is derived:

  frame_count = bay_count + 1

Minimum beam levels per bay:

A bay must have at least 1 beam level to be considered complete. 
A rack line can only reach VALID state if every bay has at least one beam level.

A bay with 0 beam levels is in INCOMPLETE state. INCOMPLETE is not a terminal
state — the system must allow the user to add levels. However, a rack line
containing any INCOMPLETE bay cannot advance to VALID, and its BOM snapshot
must not be generated.

---------------------------------------------------------------------

12. BEAM COMPATIBILITY

Beams must be compatible with the frame upright series.

All compatibility rules are catalog-defined and produce INVALID state when
violated. None of these produce warnings — they are hard blocking errors.

12.1 Connector type

  The beam's connectorType must match the frame's compatible connector slot
  pattern. The frame specification must carry a list of compatibleConnectorTypes.

  Constraint:
    beam.connectorType ∈ frame.compatibleConnectorTypes

  A beam connector that does not match the physical slot cannot be seated.
  This is a blocking INVALID error.

12.2 Capacity class

  The beam's capacityClass must not exceed the frame's capacityClass for the
  intended load scenario.

  Constraint:
    beamCapacityClass ≤ frameAllowableCapacityClass

  Placing a heavy-capacity beam on a light-capacity frame means the uprights
  will be underspecified for the actual load. This is a structural safety
  failure and is a blocking INVALID error, not a warning.

12.3 Beam length

  Beam length must match bay width exactly:
    beam.lengthIn = bay.widthIn

  Bay width must correspond to a valid catalog beam SKU (see Section 2.2).

12.4 Upright series

  The beam's compatibleUprightSeries list must include the frame's uprightSeries:
    beam.compatibleUprightSeries.includes(frame.uprightSeries)

---------------------------------------------------------------------

13. LEVEL UNIFORMITY

Two configuration modes may exist.

Uniform levels:

All bays share identical beam level elevations.

Variable levels:

Individual bays may override level placement.

Most selective pallet systems operate in uniform mode.

---------------------------------------------------------------------

14. VALIDATION STATES

Each rack line has a configuration validation status.

States:

  INCOMPLETE
  VALID
  VALID_WITH_WARNINGS
  INVALID

INCOMPLETE rules:

A rack line is INCOMPLETE if any of the following are true:
  - Any bay has zero beam levels
  - Required derived accessories have not been computed
  - BOM snapshot has not been generated
  - Bay widthIn does not correspond to any catalog SKU

A rack line in INCOMPLETE state must not be quoted or submitted as a design.

Blocking INVALID errors include:

  - Levels not aligned to hole grid
  - Adjacent levels too close vertically (gap formula violated, Section 5)
  - Beam upright series incompatible with frame (Section 12.4)
  - Beam connector type mismatches frame slot (Section 12.1)
  - Beam capacity class exceeds frame allowable capacity (Section 12.2)
  - Beam length does not match bay width (Section 12.3)
  - Beam elevation exceeds frame height minus top clearance (Section 7)
  - First beam elevation below minimum floor clearance (Section 8.1)
  - First beam elevation below its own connector envelope (Section 8.2)
  - Frame depth not uniform within its row (Section 2.1 / Section 9.2.3)
  - Module spans frames from different rows in a back-to-back line (Section 9.2.4)
  - Row spacer size below catalog minimum (Section 9.2.5)
  - Bay widthIn has no matching catalog beam SKU (Section 2.2)
  - levelIndex values are not consecutive starting at 0 (Section 2.4)

Warnings (VALID_WITH_WARNINGS) include:

  - Non-standard level spacing (unusually large gap between levels)
  - Frame or beam usage within 90% of rated capacity (near-capacity informational alert)

Note: beam/frame capacity mismatch was previously listed as a warning.
It is promoted to a blocking INVALID error in this version (see Section 12.2).

---------------------------------------------------------------------

15. DESIGN REVISION RULES

All rack configurations exist within a design revision.

Design revisions are immutable snapshots.

Edits require creation of a new revision.

A design revision must contain:

- Rack line configurations
- Catalog version reference
- Validation results
- Derived BOM snapshot

Given the same design revision and catalog version:

The generated BOM must always be identical.

---------------------------------------------------------------------

16. BOM DERIVATION RULE

The Bill of Materials is a deterministic function of:

Rack configuration
Catalog version
Accessory derivation rules

Example BOM logic:

frames = frame_count

beams = bay_count × levels × 2

safety_pins = beams × 2

anchors = frame_count × anchors_per_frame

All derived quantities must be explainable from rules.

---------------------------------------------------------------------

17. PRICING RULE

Pricing is a deterministic function of:

BOM snapshot
Pricing version
Manual overrides

Pricing changes must never alter historical quotes.

Quotes must reference a pricing version.

---------------------------------------------------------------------

18. CANVAS REPRESENTATION RULE

The graphical rack drawing is only a projection of the domain model.

Canvas elements must never be the source of truth.

Geometry must always be derived from:

rack configuration parameters
frame spacing
beam elevations

---------------------------------------------------------------------

19. DETERMINISM REQUIREMENT

Given:

DesignRevision
CatalogVersion
PricingVersion

The system must always produce:

The same geometry
The same BOM
The same pricing totals

No hidden mutations are allowed.

---------------------------------------------------------------------

END OF BUSINESS RULES