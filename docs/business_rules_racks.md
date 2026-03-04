RACK CONFIGURATION SYSTEM
BUSINESS RULES — SELECTIVE PALLET RACKING
Version: Draft
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
- Vertical connector envelope (see section 4)

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

4. BEAM CONNECTOR VERTICAL ENVELOPE

Each beam type has a connector assembly that occupies vertical space below the beam seat.

This vertical space varies by beam design and connector type.

Define:

beam_vertical_envelope_in

This represents the vertical clearance consumed by the beam connector and support bracket.

This value is catalog-defined and stored in the beam specification.

It is not constant across all beams.

---------------------------------------------------------------------

5. MINIMUM VERTICAL DISTANCE BETWEEN LEVELS

Because of the beam connector envelope and hole spacing constraints, two adjacent beam levels must maintain a minimum vertical separation.

Rule:

minimum_gap_in = hole_step + governing_beam_envelope

Where:

hole_step = 2 inches

governing_beam_envelope = maximum vertical envelope of the adjacent beams

Therefore:

minimum_gap_in = 2 + max(envelope_lower_beam, envelope_upper_beam)

To enforce the hole grid:

minimum_gap_steps = ceil(minimum_gap_in / 2)

Constraint:

hole_index[i+1] - hole_index[i] >= minimum_gap_steps

Example:

Lower beam envelope = 10"
Upper beam envelope = 8"

minimum_gap = 2 + max(10,8) = 12"

minimum_gap_steps = 6 holes

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

top_beam_elevation ≤ frame_height

Optional rule:

top clearance between the highest beam and frame top may be required by safety rules.

Example:

minimum_top_clearance = catalog rule

---------------------------------------------------------------------

8. FLOOR CLEARANCE

Many rack systems require a minimum distance between the floor and the first beam level.

Define:

minimum_floor_clearance

Constraint:

first_beam_elevation ≥ minimum_floor_clearance

This rule may vary by system or installation standard.

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

Two rows of racks placed with their backs facing each other.

Structure:

Row A
Row B

Rows share spacing between them.

Back-to-back requires additional components such as:

- Row spacers
- Tie plates
- Additional anchors depending on system design

Both rows may share identical or different configurations.

Spacing between rows is determined by:

frame_depth_A
frame_depth_B
row_spacer_size

---------------------------------------------------------------------

10. ACCESSORIES

Accessories fall into two categories.

10.1 Derived Accessories

Automatically required based on configuration.

Examples:

- Anchors per base plate
- Row spacers for back-to-back
- Safety pins for beams
- Beam locks
- Decking panels
- Row ties

Derived accessories must be computed deterministically from rack configuration.

Example rules:

anchors_per_frame = 2 or 4 depending on base plate type

safety_pins_per_beam = 2

row_spacers_per_frame_pair = catalog rule

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

---------------------------------------------------------------------

12. BEAM COMPATIBILITY

Beams must be compatible with the frame upright series.

Compatibility rules include:

- Connector type must match frame slot pattern
- Beam capacity must be within frame allowable limits
- Beam length must match bay width

These compatibility rules are catalog-defined.

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

Blocking validation errors include:

- Levels not aligned to hole grid
- Levels too close vertically
- Beam incompatible with frame
- Beam length incompatible with bay
- Beam elevation exceeding frame height

Warnings may include:

- Near capacity limits
- Non-standard level spacing

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