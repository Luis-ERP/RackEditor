'use client';

import DocsSidebar from '@/src/apps/docs/components/DocsSidebar';
import '@/src/apps/docs/styles/docs.css';

export default function DocsPage() {
  return (
    <div className="docs-shell">
      <DocsSidebar />

      <div className="docs-content">

        {/* ── OVERVIEW ─────────────────────────────────── */}
        <section id="overview" className="docs-section">
          <h1 className="docs-page-title">RackEditor Documentation</h1>
          <p className="docs-page-lead">
            RackEditor is a selective pallet rack design and quoting platform. It replaces manual
            CAD drawings and spreadsheet pricing with a single connected workflow: design a rack
            layout, automatically generate a bill of materials, and produce a versioned quote — all
            from one place.
          </p>

          <h2 className="docs-section-title">What the platform does</h2>
          <p className="docs-p">
            Every rack you place in the design editor represents a real physical assembly: a specific
            number of frames, beams at defined heights, and all required hardware. The platform knows
            your product catalog and applies it automatically. You never manually count parts or look
            up dimensions — the system derives them from your design.
          </p>
          <p className="docs-p">
            When your design is complete, you send it to the Quoting workspace. The bill of materials
            is generated automatically from your design, prices are applied from a versioned pricing
            table, and you can export a professional quote PDF. Design changes always flow through
            new revisions, so every quote is traceable to the exact design it was based on.
          </p>

          <div className="docs-callout info">
            <div className="docs-callout-title">Scope</div>
            This platform is purpose-built for <strong>selective pallet racking</strong>. It does not
            support drive-in, push-back, cantilever, or mezzanine systems. It is not a general-purpose
            CAD tool and does not replace accounting, procurement, or inventory software.
          </div>
        </section>

        <hr className="docs-divider" />

        {/* ── ROLES ─────────────────────────────────── */}
        <section id="roles" className="docs-section">
          <h2 className="docs-section-title">User Roles</h2>
          <p className="docs-section-lead">
            Access and capabilities in RackEditor are governed by role. Each role reflects a
            distinct function in the design-to-quote workflow.
          </p>

          <div className="docs-role-grid">
            <div className="docs-role-card">
              <div className="docs-role-title">Admin</div>
              <div className="docs-role-desc">
                Manages pricing tables, catalog rules, quote templates, and user permissions.
              </div>
            </div>
            <div className="docs-role-card">
              <div className="docs-role-title">Designer / Sales Engineer</div>
              <div className="docs-role-desc">
                Builds and revises rack layouts, configures frame and beam specifications, and sends
                designs to the Quoter.
              </div>
            </div>
            <div className="docs-role-card">
              <div className="docs-role-title">Estimator</div>
              <div className="docs-role-desc">
                Reviews the generated BOM, validates pricing, applies commercial adjustments, and
                manages the quote lifecycle.
              </div>
            </div>
            <div className="docs-role-card">
              <div className="docs-role-title">Viewer</div>
              <div className="docs-role-desc">
                Read-only access to designs and quotes. Cannot create revisions or make changes.
              </div>
            </div>
          </div>

          <p className="docs-p">
            Role permissions control which actions are available — including who can create design
            revisions, apply discounts, override prices, and send quotes to clients.
          </p>
        </section>

        <hr className="docs-divider" />

        {/* ── CORE WORKFLOW ─────────────────────────────────── */}
        <section id="workflow" className="docs-section">
          <h2 className="docs-section-title">Core Workflow</h2>
          <p className="docs-section-lead">
            The platform connects three workspaces in a linear workflow. Each step feeds the next.
          </p>

          <div className="docs-steps">
            <div className="docs-step">
              <div className="docs-step-number">1</div>
              <div className="docs-step-body">
                <div className="docs-step-title">Design — CAD Editor</div>
                <div className="docs-step-desc">
                  Place rack runs on the canvas, configure frame specifications (height, depth,
                  capacity), set beam lengths, and add beam levels at the heights you need. The
                  editor validates your design in real time and shows you exactly what is missing or
                  incorrect before you move on.
                </div>
              </div>
            </div>
            <div className="docs-step">
              <div className="docs-step-number">2</div>
              <div className="docs-step-body">
                <div className="docs-step-title">Generate — Bill of Materials</div>
                <div className="docs-step-desc">
                  When your design is valid, send it to the Quoter. The platform automatically
                  calculates every component required: frames, beams, safety pins, floor anchors,
                  row spacers, and all other hardware — based on the rack configuration you defined.
                  No manual counting required.
                </div>
              </div>
            </div>
            <div className="docs-step">
              <div className="docs-step-number">3</div>
              <div className="docs-step-body">
                <div className="docs-step-title">Quote — Quoter Workspace</div>
                <div className="docs-step-desc">
                  Review and adjust the BOM, apply pricing from the current price list, add manual
                  line items (freight, labor, etc.), apply discounts with proper approval, and
                  export a quote PDF. Every quote revision is linked to the specific design it came
                  from — nothing drifts silently.
                </div>
              </div>
            </div>
          </div>

          <div className="docs-callout info">
            <div className="docs-callout-title">Catalog Browser</div>
            The <strong>Catalog</strong> workspace lets you browse available frame and beam
            specifications before you start designing. It is a reference tool — changes to the
            catalog are made by Admins and apply to all new designs.
          </div>
        </section>

        <hr className="docs-divider" />

        {/* ── KEY CONCEPTS ─────────────────────────────────── */}
        <section id="key-concepts" className="docs-section">
          <h2 className="docs-section-title">Key Concepts</h2>
          <p className="docs-section-lead">
            Understanding these five concepts is enough to work effectively with RackEditor.
          </p>

          <h3 className="docs-h3">Rack Run (Rack Line)</h3>
          <p className="docs-p">
            A rack run is a continuous sequence of bays that share the same frame depth and beam
            specification. It is the primary unit you place on the canvas. A run can be a
            single-sided row or a back-to-back pair (two rows sharing the same footprint).
          </p>

          <h3 className="docs-h3">Bay</h3>
          <p className="docs-p">
            A bay is the space between two adjacent frames. The width of a bay is determined by the
            beam length you select. Bay widths must correspond to a standard beam length in your
            product catalog — the system will not allow an arbitrary width.
          </p>

          <h3 className="docs-h3">Frame</h3>
          <p className="docs-p">
            A frame is an upright assembly (two columns with bracing) that forms the vertical
            structure of the rack. You configure frames by selecting height, depth, and capacity
            class. You do <em>not</em> place frames individually — the system places them
            automatically based on your bay count. For every N bays, the system places N+1 frames.
          </p>

          <h3 className="docs-h3">Beam Level</h3>
          <p className="docs-p">
            A beam level is a pair of horizontal beams at a specific height inside the rack. Each
            level defines a pallet load position. You add levels by choosing a height (elevation)
            along the upright. Heights must fall on the standard 2-inch hole grid — you cannot
            place a beam at an arbitrary height. Levels must be ordered from bottom to top with
            sufficient vertical clearance between them.
          </p>

          <h3 className="docs-h3">Validation State</h3>
          <p className="docs-p">
            Every rack run has a real-time validation state that tells you whether it is ready to
            be included in a bill of materials.
          </p>

          <div className="docs-badge-row">
            <span className="docs-badge incomplete">⬤ Incomplete</span>
            <span className="docs-badge valid">⬤ Valid</span>
            <span className="docs-badge warnings">⬤ Valid with Warnings</span>
            <span className="docs-badge invalid">⬤ Invalid</span>
          </div>

          <div className="docs-table-wrap">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>State</th>
                  <th>Meaning</th>
                  <th>Can be quoted?</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Incomplete</strong></td>
                  <td>The rack has bays but no beam levels have been added yet, or a required accessory has not been resolved.</td>
                  <td>No</td>
                </tr>
                <tr>
                  <td><strong>Valid</strong></td>
                  <td>All rules are satisfied. The design is ready for BOM generation.</td>
                  <td>Yes</td>
                </tr>
                <tr>
                  <td><strong>Valid with Warnings</strong></td>
                  <td>All rules are satisfied, but one or more conditions are worth reviewing (e.g., a beam level placed very close to the top of the frame). The design can still be quoted.</td>
                  <td>Yes</td>
                </tr>
                <tr>
                  <td><strong>Invalid</strong></td>
                  <td>One or more rules are violated. The specific errors are listed in the Validation panel. The design cannot be sent to Quoter until all errors are resolved.</td>
                  <td>No</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <hr className="docs-divider" />

        {/* ── FRAME RULES ─────────────────────────────────── */}
        <section id="frame-rules" className="docs-section">
          <h2 className="docs-section-title">Frame Rules</h2>
          <p className="docs-section-lead">
            Frames carry the load of everything placed on the rack. Several rules govern how they
            can be configured to ensure structural consistency.
          </p>

          <h3 className="docs-h3">Uniform depth per row</h3>
          <p className="docs-p">
            All frames in the same row must have the same depth (front-to-back dimension). This
            ensures that the back of the rack forms a consistent plane, which is required for
            pallet positioning and safe installation. Changing the depth of a row means changing
            the depth of every frame in that row simultaneously — it is a row-level change, not a
            per-frame change.
          </p>
          <p className="docs-p">
            In back-to-back configurations, the two rows may have different depths from each other
            (e.g., 42 inches on one side and 36 inches on the other). This is a supported
            configuration. Depth uniformity is enforced within each row independently.
          </p>

          <h3 className="docs-h3">Frame count is derived, not entered</h3>
          <p className="docs-p">
            You set the number of bays. The system derives the frame count automatically:
          </p>
          <div className="docs-formula">
            Number of frames = Number of bays + 1{'\n\n'}
            Example: 5 bays → 6 frames
          </div>

          <h3 className="docs-h3">Capacity class</h3>
          <p className="docs-p">
            Frames are rated by capacity class (Light, Standard, Medium, Heavy, Extra Heavy). The
            beams installed in a frame must not exceed that frame's capacity class. Installing a
            heavier beam in a lighter frame is a structural error that blocks the design from being
            valid.
          </p>

          <h3 className="docs-h3">Top clearance</h3>
          <p className="docs-p">
            Beam levels cannot be placed too close to the top of the frame. A minimum clearance is
            required above the topmost beam to accommodate row-tie hardware, cap plates, and pallet
            load overhang. Violating this clearance is a blocking error.
          </p>

          <h3 className="docs-h3">Floor clearance</h3>
          <p className="docs-p">
            The lowest beam level must be high enough for a forklift to enter the rack. A minimum
            floor clearance is enforced based on catalog specifications. Additionally, the connector
            hardware on the lowest beam must not extend below floor level.
          </p>
        </section>

        <hr className="docs-divider" />

        {/* ── BEAM LEVELS ─────────────────────────────────── */}
        <section id="beam-levels" className="docs-section">
          <h2 className="docs-section-title">Beam Levels</h2>
          <p className="docs-section-lead">
            Beam levels define where pallet loads are stored in the rack. Placement is governed by
            the physical constraints of the upright and the beam hardware.
          </p>

          <h3 className="docs-h3">The 2-inch hole grid</h3>
          <p className="docs-p">
            Upright columns have punched holes every 2 inches. Beam connectors attach to these
            holes. As a result, every beam level must be placed at an elevation that is a multiple
            of 2 inches — you cannot choose arbitrary heights. When you drag a beam level in the
            editor, it snaps to valid hole positions.
          </p>

          <h3 className="docs-h3">Minimum spacing between levels</h3>
          <p className="docs-p">
            Adjacent beam levels must maintain a minimum vertical separation. This separation
            accounts for:
          </p>
          <ul className="docs-list">
            <li>The physical height of the beam cross-section above its mounting point</li>
            <li>The connector hardware that hangs below the beam seat</li>
            <li>The one-hole grid step required between any two beam positions</li>
          </ul>
          <p className="docs-p">
            Placing two levels too close together is a blocking error. The editor enforces this
            automatically — you cannot drag a beam into an invalid position relative to a
            neighboring level.
          </p>

          <h3 className="docs-h3">Level ordering</h3>
          <p className="docs-p">
            Levels are ordered bottom to top and numbered sequentially starting from zero. Gaps in
            the sequence are not permitted. The level indices must always form a consecutive series
            (0, 1, 2, …).
          </p>

          <h3 className="docs-h3">Uniform vs. variable levels</h3>
          <p className="docs-p">
            By default, all bays in a rack run share the same beam level elevations (uniform mode).
            Individual bays may be given different beam specifications through per-bay overrides,
            but this is explicitly marked and auditable — it does not happen silently.
          </p>
        </section>

        <hr className="docs-divider" />

        {/* ── CONFIGURATIONS ─────────────────────────────────── */}
        <section id="configurations" className="docs-section">
          <h2 className="docs-section-title">Rack Configurations</h2>
          <p className="docs-section-lead">
            RackEditor supports single-row and back-to-back rack configurations.
          </p>

          <h3 className="docs-h3">Single Row</h3>
          <p className="docs-p">
            A single-sided rack with bays accessible from one aisle. Frames are placed along one
            axis and connected by beams at each level.
          </p>

          <h3 className="docs-h3">Back-to-Back</h3>
          <p className="docs-p">
            Two or more rows of racks placed with their backs facing each other, sharing the same
            structural footprint. RackEditor supports 2-row, 3-row, and 4-row back-to-back
            configurations.
          </p>
          <p className="docs-p">
            In back-to-back configurations, additional hardware is automatically included in the
            BOM: row spacers that maintain the required gap between the two backs, tie plates that
            connect the rows at defined intervals, and additional floor anchors. The gap between
            rows must meet a minimum size defined in the catalog — a gap smaller than this minimum
            is a blocking error.
          </p>

          <div className="docs-callout warning">
            <div className="docs-callout-title">Row spacer minimum</div>
            The gap between back-to-back rows cannot be smaller than the catalog-defined minimum.
            This minimum ensures the tie hardware can be installed correctly and meets manufacturer
            requirements. Setting a smaller gap is a blocking error and prevents the design from
            being valid.
          </div>
        </section>

        <hr className="docs-divider" />

        {/* ── ACCESSORIES ─────────────────────────────────── */}
        <section id="accessories" className="docs-section">
          <h2 className="docs-section-title">Accessories</h2>
          <p className="docs-section-lead">
            Rack accessories fall into two categories: those the system derives automatically, and
            those you add explicitly.
          </p>

          <h3 className="docs-h3">Derived accessories</h3>
          <p className="docs-p">
            Derived accessories are mandatory components that the system calculates automatically
            from your rack configuration. You do not add them manually — they are computed as part
            of BOM generation. A rack run is considered Incomplete if any required derived
            accessories have not been resolved.
          </p>
          <p className="docs-p">Examples of derived accessories include:</p>
          <ul className="docs-list">
            <li>Floor anchors (based on frame count and base plate type)</li>
            <li>Safety pins for beams (2 pins per beam end)</li>
            <li>Beam locks</li>
            <li>Row spacers and tie plates (for back-to-back configurations)</li>
          </ul>

          <h3 className="docs-h3">Explicit accessories</h3>
          <p className="docs-p">
            Explicit accessories are optional items you add to a rack run, a specific bay, or a
            specific level. These are stored as part of the design configuration and carry through
            to the BOM.
          </p>
          <p className="docs-p">Examples include:</p>
          <ul className="docs-list">
            <li>Column protectors</li>
            <li>Wire decking</li>
            <li>Pallet supports</li>
            <li>Labeling systems</li>
          </ul>
        </section>

        <hr className="docs-divider" />

        {/* ── VALIDATION STATES ─────────────────────────────────── */}
        <section id="validation-states" className="docs-section">
          <h2 className="docs-section-title">Validation States</h2>
          <p className="docs-section-lead">
            Every rack run in your design carries a live validation state. The state updates
            immediately as you make changes — there is no separate "validate" button.
          </p>

          <p className="docs-p">
            A design cannot be sent to Quoter if any rack run is in <strong>Incomplete</strong> or{' '}
            <strong>Invalid</strong> state. Runs in <strong>Valid</strong> or{' '}
            <strong>Valid with Warnings</strong> state can proceed to BOM generation.
          </p>

          <h3 className="docs-h3">What causes Incomplete?</h3>
          <ul className="docs-list">
            <li>No beam levels have been added to the rack yet</li>
            <li>Required derived accessories have not been resolved</li>
            <li>A bay width does not match any valid beam length in the catalog</li>
          </ul>

          <h3 className="docs-h3">What causes Invalid?</h3>
          <p className="docs-p">
            Invalid state means a structural or catalog rule has been violated. All Invalid errors
            are blocking — the design cannot be used for quoting until they are resolved. The
            Validation panel identifies each error by the specific bay, level, or frame that caused
            it, so you always know exactly what to fix and where.
          </p>

          <h3 className="docs-h3">What causes Valid with Warnings?</h3>
          <p className="docs-p">
            Warnings indicate a condition worth reviewing, but the design is structurally sound and
            can proceed to quoting. Common warnings include:
          </p>
          <ul className="docs-list">
            <li>A beam level placed very close to the top of the frame (but still within the allowed clearance)</li>
            <li>A frame or beam operating near its rated capacity limit</li>
            <li>Unusually large vertical spacing between beam levels</li>
          </ul>
        </section>

        <hr className="docs-divider" />

        {/* ── COMPATIBILITY RULES ─────────────────────────────────── */}
        <section id="compatibility-rules" className="docs-section">
          <h2 className="docs-section-title">Compatibility Rules</h2>
          <p className="docs-section-lead">
            Beams and frames must be compatible with each other. These rules are defined in the
            product catalog and enforced automatically. All compatibility violations are blocking
            errors — none produce mere warnings.
          </p>

          <div className="docs-table-wrap">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Rule</th>
                  <th>What it means</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Connector type match</strong></td>
                  <td>The beam connector must be compatible with the slot pattern on the frame upright. A connector that does not physically fit the upright slot cannot be used.</td>
                </tr>
                <tr>
                  <td><strong>Capacity class</strong></td>
                  <td>The beam's capacity class cannot exceed the frame's allowable capacity class. Installing a heavier beam in a lighter frame leaves the uprights underspecified for the actual load — this is a structural safety issue.</td>
                </tr>
                <tr>
                  <td><strong>Beam length = bay width</strong></td>
                  <td>The beam length must exactly match the width of the bay it spans. Additionally, the bay width must correspond to a beam SKU that exists in the catalog.</td>
                </tr>
                <tr>
                  <td><strong>Upright series</strong></td>
                  <td>The beam must be rated for use with the frame's upright series. Not all beam models are compatible with all upright profiles.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <hr className="docs-divider" />

        {/* ── ERROR REFERENCE ─────────────────────────────────── */}
        <section id="error-reference" className="docs-section">
          <h2 className="docs-section-title">Error Reference</h2>
          <p className="docs-section-lead">
            The Validation panel uses specific error codes to identify issues. Here is what each one
            means and how to resolve it.
          </p>

          <div className="docs-table-wrap">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Error</th>
                  <th>Cause</th>
                  <th>How to fix</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>CAPACITY_CLASS_EXCEEDED</strong></td>
                  <td>The selected beam capacity class is higher than the frame's allowable capacity class.</td>
                  <td>Upgrade the frame to a higher capacity class, or select a lighter beam.</td>
                </tr>
                <tr>
                  <td><strong>CONNECTOR_TYPE_MISMATCH</strong></td>
                  <td>The beam connector type is not compatible with the frame upright's slot pattern.</td>
                  <td>Select a beam with a connector type compatible with your frame, or switch to a compatible frame.</td>
                </tr>
                <tr>
                  <td><strong>INSUFFICIENT_TOP_CLEARANCE</strong></td>
                  <td>The highest beam level is too close to the top of the frame. The required minimum clearance above the topmost beam is not satisfied.</td>
                  <td>Move the highest beam level down to a lower position.</td>
                </tr>
                <tr>
                  <td><strong>INSUFFICIENT_FLOOR_CLEARANCE</strong></td>
                  <td>The lowest beam level is too close to the floor. The rack must provide minimum entry clearance for forklift operation.</td>
                  <td>Raise the lowest beam level to a height that meets the minimum floor clearance.</td>
                </tr>
                <tr>
                  <td><strong>LEVEL_SPACING_VIOLATION</strong></td>
                  <td>Two adjacent beam levels are placed too close together, given the physical size of the beams and connectors.</td>
                  <td>Increase the vertical gap between the two affected levels.</td>
                </tr>
                <tr>
                  <td><strong>ROW_SPACER_TOO_SMALL</strong></td>
                  <td>The gap between back-to-back rows is smaller than the catalog minimum required for tie hardware installation.</td>
                  <td>Increase the row spacer size to meet the catalog minimum.</td>
                </tr>
                <tr>
                  <td><strong>NEAR_FRAME_TOP</strong> (warning)</td>
                  <td>The highest beam level is close to the top clearance boundary but has not crossed it.</td>
                  <td>Review whether the placement is intentional. No action required if this is a flush-top installation.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <hr className="docs-divider" />

        {/* ── BOM OVERVIEW ─────────────────────────────────── */}
        <section id="bom-overview" className="docs-section">
          <h2 className="docs-section-title">How the BOM Works</h2>
          <p className="docs-section-lead">
            The bill of materials is a complete, itemized list of every component required to build
            the racks in your design. It is generated automatically from your design configuration —
            you never enter quantities manually.
          </p>

          <h3 className="docs-h3">Deterministic generation</h3>
          <p className="docs-p">
            Given the same design and the same catalog, the BOM always produces the same result.
            There is no ambiguity or variation in how quantities are computed. If two people open the
            same design revision, they will always see the same BOM.
          </p>

          <h3 className="docs-h3">Traceable line items</h3>
          <p className="docs-p">
            Every BOM line identifies its source: which rack run, which bay, and which level
            produced that quantity. If a line item's quantity seems wrong, you can trace it back to
            the exact place in the design that generated it.
          </p>

          <h3 className="docs-h3">Derived vs. manual lines</h3>
          <p className="docs-p">
            The BOM contains two types of lines:
          </p>
          <ul className="docs-list">
            <li>
              <strong>Derived lines</strong> — calculated automatically from your rack design.
              These are clearly marked as derived and show their source.
            </li>
            <li>
              <strong>Manual lines</strong> — items you add directly in the Quoter (e.g., freight,
              labor, custom hardware). These are clearly marked as manual and show who added them
              and when.
            </li>
          </ul>

          <div className="docs-callout warning">
            <div className="docs-callout-title">BOM snapshot</div>
            The BOM used in a quote is a snapshot tied to a specific design revision. If you change
            the design after creating a quote, those changes do not automatically update the quote.
            To apply design changes commercially, you must create a new design revision and a new
            quote revision that references it.
          </div>
        </section>

        <hr className="docs-divider" />

        {/* ── BOM QUANTITIES ─────────────────────────────────── */}
        <section id="bom-quantities" className="docs-section">
          <h2 className="docs-section-title">Quantity Derivation</h2>
          <p className="docs-section-lead">
            Understanding how the system counts components helps you verify that your BOM is correct.
          </p>

          <div className="docs-formula">
            {'Frames          = Number of bays + 1\n'}
            {'Beams           = Number of bays × Number of levels × 2\n'}
            {'Safety pins     = Number of beams × 2\n'}
            {'Floor anchors   = Number of frames × anchors per base plate (catalog-defined)\n'}
            {'Row spacers     = Number of frame pairs × spacers per pair (back-to-back only, catalog-defined)'}
          </div>

          <p className="docs-p">
            All derived quantities follow explicit rules published in the product catalog. If a
            quantity in the BOM does not match your expectation, check the Validation panel first —
            an Incomplete or Invalid rack run may be contributing unexpected values.
          </p>

          <div className="docs-callout danger">
            <div className="docs-callout-title">Incomplete racks excluded</div>
            BOM generation requires every rack run in the design to be in Valid or Valid with
            Warnings state. If any run is Incomplete or Invalid, the BOM cannot be generated.
            Resolve all issues in the design before sending to Quoter.
          </div>
        </section>

        <hr className="docs-divider" />

        {/* ── QUOTE LIFECYCLE ─────────────────────────────────── */}
        <section id="quote-lifecycle" className="docs-section">
          <h2 className="docs-section-title">Quote Lifecycle</h2>
          <p className="docs-section-lead">
            A quote moves through a defined set of statuses. Each transition has rules about who
            can act and what conditions must be met.
          </p>

          <div className="docs-table-wrap">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Meaning</th>
                  <th>Editable?</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Draft</strong></td>
                  <td>Work in progress. Line items, pricing, and adjustments can be changed freely.</td>
                  <td>Yes</td>
                </tr>
                <tr>
                  <td><strong>Sent</strong></td>
                  <td>The quote has been issued to the client. No further changes are allowed on this revision. To revise a sent quote, create a new quote revision.</td>
                  <td>No (immutable)</td>
                </tr>
                <tr>
                  <td><strong>Accepted</strong></td>
                  <td>The client has accepted the quote. The revision is locked.</td>
                  <td>No</td>
                </tr>
                <tr>
                  <td><strong>Rejected</strong></td>
                  <td>The client has declined the quote.</td>
                  <td>No</td>
                </tr>
                <tr>
                  <td><strong>Expired</strong></td>
                  <td>The quote's validity period has passed without a response.</td>
                  <td>No</td>
                </tr>
                <tr>
                  <td><strong>Cancelled</strong></td>
                  <td>The quote was withdrawn before a decision was reached.</td>
                  <td>No</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="docs-callout warning">
            <div className="docs-callout-title">Before sending</div>
            A quote can only be sent if two conditions are met: (1) there are no blocking design
            errors, and (2) all BOM line items have a valid price. Missing prices block the send
            action to prevent issuing an incomplete quote.
          </div>
        </section>

        <hr className="docs-divider" />

        {/* ── PRICING ─────────────────────────────────── */}
        <section id="pricing" className="docs-section">
          <h2 className="docs-section-title">Pricing Rules</h2>
          <p className="docs-section-lead">
            Prices in RackEditor are applied from versioned pricing tables, not entered manually for
            each item.
          </p>

          <h3 className="docs-h3">Versioned pricing context</h3>
          <p className="docs-p">
            Every quote revision records which pricing table version it used. This means the prices
            in an old quote are always reproducible — even if the current pricing table has been
            updated. A quote from six months ago will always reproduce the exact totals it showed
            when it was sent.
          </p>

          <h3 className="docs-h3">Price matching</h3>
          <p className="docs-p">
            Each BOM line item is matched to a pricing rule based on the component's catalog
            identity. The quote records which pricing rule was matched for every line, so the source
            of every price is traceable.
          </p>

          <h3 className="docs-h3">Missing prices block send</h3>
          <p className="docs-p">
            If a BOM line item cannot be matched to any pricing rule, it is flagged as
            unpriced. Unpriced lines block the quote from being sent to the client. The Estimator
            must either assign a price manually (with an approved override) or ask the Admin to add
            the missing rule to the pricing table.
          </p>

          <h3 className="docs-h3">Tax, freight, and labor</h3>
          <p className="docs-p">
            Service lines (freight, labor, installation) and tax can be added to a quote:
          </p>
          <ul className="docs-list">
            <li>
              <strong>Tax</strong> — configured as a percentage rate or fixed amount. The default
              tax rate is 16% (IVA). Tax can be toggled on or off per quote.
            </li>
            <li>
              <strong>Freight</strong> — added as a line item with its own unit price. A base
              freight calculation by destination city is available.
            </li>
            <li>
              <strong>Labor / Installation</strong> — added as a line item and subject to standard
              pricing and discount rules.
            </li>
          </ul>
        </section>

        <hr className="docs-divider" />

        {/* ── ADJUSTMENTS ─────────────────────────────────── */}
        <section id="adjustments" className="docs-section">
          <h2 className="docs-section-title">Discounts &amp; Overrides</h2>
          <p className="docs-section-lead">
            Commercial adjustments are fully supported but must be attributed. Every discount and
            price override records who made it, when, and why.
          </p>

          <h3 className="docs-h3">Discount types</h3>
          <ul className="docs-list">
            <li><strong>Quote-level discount</strong> — a percentage or fixed amount applied to the entire quote total.</li>
            <li><strong>Line-level discount</strong> — a percentage or fixed amount applied to a single BOM line item.</li>
          </ul>

          <h3 className="docs-h3">Price overrides</h3>
          <p className="docs-p">
            You can override the catalog price for an individual line item. Overrides require a
            reason and are subject to role-based approval limits. All override attempts are logged
            regardless of outcome.
          </p>

          <h3 className="docs-h3">Quantity adjustments</h3>
          <p className="docs-p">
            Derived line quantities can be adjusted in the quote. Any change to a derived quantity
            is recorded with the reason, the user who made the change, and a timestamp. The original
            derived quantity is preserved alongside the adjustment so the difference is always
            visible.
          </p>

          <div className="docs-callout info">
            <div className="docs-callout-title">Audit trail</div>
            Every commercial adjustment — discount, price override, or quantity change — is part of
            the quote's permanent record. This audit trail cannot be cleared or edited after the
            fact.
          </div>
        </section>

        <hr className="docs-divider" />

        {/* ── DESIGN REVISIONS ─────────────────────────────────── */}
        <section id="design-revisions" className="docs-section">
          <h2 className="docs-section-title">Design Revisions</h2>
          <p className="docs-section-lead">
            A design revision is a permanent, locked snapshot of the rack layout at a specific point
            in time.
          </p>

          <h3 className="docs-h3">How revisions work</h3>
          <p className="docs-p">
            While you are working on a design, your changes are saved continuously but have not yet
            been committed as a revision. When you create a revision, the current state of the
            design is captured as an immutable snapshot with an author, timestamp, and optional
            notes.
          </p>
          <p className="docs-p">
            Once a design revision is created, it cannot be changed. If you need to make changes,
            you continue working on the design (which is always editable) and create a new revision
            when ready.
          </p>

          <h3 className="docs-h3">Restoring a previous revision</h3>
          <p className="docs-p">
            You can restore a previous design revision, but this creates a <em>new</em> revision
            rather than overwriting the current one. The historical revision remains unchanged, and
            the restored state is added as a new entry in the revision history.
          </p>

          <h3 className="docs-h3">What a design revision contains</h3>
          <ul className="docs-list">
            <li>The full rack layout (all runs, frame specs, beam specs, beam levels)</li>
            <li>The catalog version used at the time of the revision</li>
            <li>The validation results at the time of the revision</li>
            <li>The derived BOM snapshot</li>
          </ul>
        </section>

        <hr className="docs-divider" />

        {/* ── QUOTE REVISIONS ─────────────────────────────────── */}
        <section id="quote-revisions" className="docs-section">
          <h2 className="docs-section-title">Quote Revisions</h2>
          <p className="docs-section-lead">
            Each quote is versioned independently from the design. A quote revision is linked to
            exactly one design revision.
          </p>

          <h3 className="docs-h3">One design revision per quote revision</h3>
          <p className="docs-p">
            When you create a quote, it references the design revision it was based on. If the
            design changes and a new design revision is created, the existing quote continues to
            reference the old design revision. To produce a quote based on the new design, you
            create a new quote revision.
          </p>
          <p className="docs-p">
            This one-to-one relationship ensures that the design a client sees in a quote always
            matches the exact rack layout that produced the BOM quantities in that quote.
          </p>

          <h3 className="docs-h3">Quote revision immutability</h3>
          <p className="docs-p">
            Once a quote revision is sent to a client, it becomes immutable. No changes can be made
            to its line items, prices, discounts, or totals. If corrections are needed after
            sending, a new quote revision must be created.
          </p>

          <h3 className="docs-h3">Comparing revisions</h3>
          <p className="docs-p">
            You can compare any two quote revisions to see exactly what changed between them:
            which line items were added or removed, which prices changed, and which discounts
            changed. The same comparison is available for design revisions.
          </p>
        </section>

        <hr className="docs-divider" />

        {/* ── IMMUTABILITY ─────────────────────────────────── */}
        <section id="immutability" className="docs-section">
          <h2 className="docs-section-title">Immutability Policy</h2>
          <p className="docs-section-lead">
            Immutability is a core principle of RackEditor. It guarantees that historical records
            are permanent and reproducible.
          </p>

          <div className="docs-table-wrap">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>What becomes immutable</th>
                  <th>When</th>
                  <th>Why</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Design revision</strong></td>
                  <td>As soon as it is created</td>
                  <td>Ensures that the design a quote references cannot be retroactively changed, which would invalidate the BOM quantities tied to it.</td>
                </tr>
                <tr>
                  <td><strong>Quote revision</strong></td>
                  <td>When it is sent to the client</td>
                  <td>Ensures that the document you sent to a client is exactly what they received. No silent post-send edits are possible.</td>
                </tr>
                <tr>
                  <td><strong>BOM snapshot</strong></td>
                  <td>At the time the quote revision is created</td>
                  <td>Ensures that BOM quantities are tied to the design revision and cannot be altered by later catalog changes.</td>
                </tr>
                <tr>
                  <td><strong>Pricing context</strong></td>
                  <td>At the time the quote revision is created</td>
                  <td>Ensures that a historical quote can always reproduce the exact prices it showed when sent, regardless of subsequent price list updates.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="docs-callout success">
            <div className="docs-callout-title">What this means for you</div>
            You can always reproduce a quote from any point in the past. The design, the BOM, the
            prices, and the commercial adjustments are all locked to the revision. If a client
            asks about a quote sent months ago, you can always regenerate the exact same document
            with the exact same totals.
          </div>
        </section>

      </div>
    </div>
  );
}
