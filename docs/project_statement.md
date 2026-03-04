# Project Statement

## 1) Product Name and Purpose

**Working Name:** Selective Pallet Rack Design & Quotation Platform

This product replaces the AutoCAD + Excel workflow with a single web application that supports:
- Semantic rack layout design (CAD-like 2D experience)
- Deterministic bill of materials (BOM) generation
- Versioned pricing application
- Quote lifecycle and revision control

The platform is a **vertical configuration + quotation engine** for selective pallet racking. It is not a general CAD system and not a full ERP replacement.

---

## 2) Problem Being Solved

Current process:
1. Layout created in AutoCAD.
2. Quantities extracted manually.
3. Pricing calculated in Excel.
4. Revisions and exceptions tracked manually.

Current pain points:
- Geometry is non-semantic (lines/blocks vs rack entities)
- Manual quantity and pricing errors
- Weak traceability between design and quote
- Fragile revision process
- No single source of truth

---

## 3) Product Vision

The system is designed to be:
- **Model-first:** Business semantics own the truth; drawing is a view.
- **Deterministic:** Same design revision always yields same BOM.
- **Versioned:** Pricing context is fixed per quote revision.
- **Auditable:** Overrides and discounts are attributable.
- **Integrated:** Design, BOM, pricing, and quoting are connected.

Core principle: **The design model drives BOM, pricing, and quote outputs.**

---

## 4) Scope

### In Scope (Initial Release)
- Selective pallet racking only
- Rack run placement/editing with semantic parameters
- Validation rules (compatibility, spacing, collisions)
- Deterministic BOM derivation
- Pricing from versioned mapping tables
- Quote creation, revisioning, lifecycle, and PDF output

### Out of Scope (Initial Release)
- Other rack families (drive-in, push-back, cantilever, mezzanines)
- Accounting, invoicing, procurement, inventory
- General-purpose CAD authoring

---

## 5) Target Users and Roles

- **Admin**: Manage pricing/rules/templates/permissions
- **Designer / Sales Engineer**: Build and revise layouts
- **Estimator**: Validate BOM/pricing, apply commercial adjustments
- **Viewer**: Read-only access

Permissions govern editing, revision creation, discounts, overrides, and quote sending.

---

## 6) System Architecture (High-Level)

- **Backend:** Django
- **Database:** PostgreSQL
- **Frontend:** Next.js
- **2D Rendering:** Canvas-based interaction engine

Domain engines:
- **Design Engine:** Rack semantics and geometric representation
- **Validation Layer:** Business + geometric rules
- **BOM Engine:** Deterministic material derivation
- **Pricing Engine:** Rule-based, versioned price matching
- **Quote Engine:** Revision lifecycle and document output

---

## 7) Core Functional Capabilities

### 7.1 CAD-like Design Engine
- 2D warehouse context (boundary, obstacles, no-rack zones)
- Rack run creation/editing (single/back-to-back)
- Semantic parameter editing (frame, beam, levels, elevations)
- Row/bay labeling and numbering
- CAD interactions (select, move, stretch, duplicate, snap, dimensions)

### 7.2 Validation and Business Rules
- Frame/beam/accessory catalog constraints
- Capacity and compatibility constraints
- Aisle and clearance constraints
- Collision checks with boundaries and obstacles
- Traceable warning/error output with object-level linking

### 7.3 Deterministic BOM
- BOM generated per design revision snapshot
- Explainable line derivation (source run/bay/level)
- Support derived + manual lines with clear distinction
- Reproducible outputs tied to immutable revisions

### 7.4 Pricing
- Versioned mapping tables with reproducible context
- Unit, extended, and totals computation
- Missing-price blocking behavior before send
- Discount and override support with audit metadata

### 7.5 Quote and Revisioning
- Quote revisions linked to design revisions
- Immutable sent revisions
- Status lifecycle (Draft, Sent, Accepted, Rejected, Expired, Cancelled)
- PDF generation and export support

---

## 8) Data Integrity and Governance

1. Design revisions are immutable snapshots.
2. Quote revisions are immutable once sent.
3. BOM generation is deterministic and explainable.
4. Pricing is bound to a version/effective context.
5. Quantity/price/discount overrides require attribution.
6. No silent drift between design and commercial outputs.

---

## 9) Revision Model

### Design Revision Track
- Captures layout changes
- Immutable once created
- New changes create a new revision

### Quote Revision Track
- References one design revision and one pricing context
- Captures commercial changes
- Immutable once sent

Rule: A design change must flow into a new quote revision to change commercial output.

---

## 10) Localization

The system supports English and Spanish in:
- Core UI workflows (design, BOM, quote)
- System messages and validations
- Client-facing generated outputs (PDF/export summaries)

Language and output language choices are stored and auditable at revision level.

---

## 11) Definition of Done (System-Level)

The system is successful when:
1. Users can model selective pallet layouts in a semantic CAD-like interface.
2. Validation rules catch incompatible and unsafe configurations.
3. The BOM is deterministic, explainable, and reproducible.
4. Pricing is applied from versioned mapping rules.
5. Quote PDFs are generated from linked revisions.
6. Revisions are immutable and fully auditable.
7. No external Excel manipulation is required in the core workflow.

---

## 12) Strategic Intent

This platform unifies technical design and commercial output into one controlled, revisioned workflow. It replaces geometry-first drafting and spreadsheet-based pricing with a semantic domain model that guarantees consistency, traceability, and reproducibility.