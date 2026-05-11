# Quick CAD BOM Mobile MVP Plan

Date: 2026-04-08
Owner: Product + Frontend + Domain Services

## 1) Objective

Deliver a mobile-first Quick CAD BOM app that lets a salesperson produce a usable rack layout and a quote on-site, fast, without requiring expert rack-design skills.

Core ethos:
- Quick to deliver
- Flexible for the 80 percent most common warehouse quoting cases
- Guided enough for non-expert users

## 2) Product Principles

1. Time-to-first-quote is the top KPI.
2. Progressive disclosure: beginner flow first, advanced controls hidden by default.
3. One flow, two outcomes: geometry + commercial quote generated together.
4. Reuse existing CAD and Quoter domain logic; only replace interaction model and layout for mobile.
5. Every step must be reversible without losing work.

## 3) Scope for Mobile MVP

## In scope
- Guided step-by-step wizard to capture context, build layout, and generate quote.
- Fast rack placement with presets and constraints for common layouts.
- Hidden advanced edit mode for aisle/module component-level changes.
- Bulk edits on selected modules/components.
- BOM + quote draft generation from the same underlying design semantics.
- Reuse existing model schemas, catalog data, import/export format, and quote store logic.

## Out of scope (MVP)
- Full parity with desktop CAD editing tools.
- Highly custom edge-case geometries not covered by common presets.
- Complex admin/catalog authoring workflows.

## 4) Target User and Jobs To Be Done

Primary user: field salesperson visiting a warehouse prospect.

Jobs:
- Capture enough warehouse context quickly.
- Build a credible rack layout in minutes.
- Produce a quote immediately while still with the customer.
- Make simple adjustments live during negotiation.

Constraints:
- Small screen, one-hand interactions, variable network quality.
- User may know sales but not structural rack design details.

## 5) End-to-End Wizard Flow

Use a 7-step mobile wizard with autosave at each step.

## Step 1: Opportunity Setup
Purpose: define quote context before design.

Inputs:
- Customer, site, project name
- Unit system (metric or imperial)
- Quote assumptions preset (safety, aisle policy)

Outputs:
- Project shell + quote draft initialized

## Step 2: Warehouse Quick Capture
Purpose: create lightweight site context.

Inputs:
- Boundary (rectangle first, polygon optional)
- Obstacles (columns, no-rack zones)
- Optional quick dimensions notes/photos metadata

Outputs:
- Valid editable layout context for rack placement

## Step 3: Rack Strategy
Purpose: choose a starter configuration before drawing.

Inputs:
- Rack template family (single selective, back-to-back selective)
- Typical frame/beam presets from catalog
- Target aisle width preset

Outputs:
- Preconfigured placement defaults to accelerate drawing

## Step 4: Quick Layout Builder
Purpose: place rack aisles fast.

Interactions:
- Tap start/end to place run
- Duplicate row and apply spacing
- Snap and ortho enabled by default
- Live ghost preview

Outputs:
- Initial layout with semantic modules ready for BOM

## Step 5: Guided Review and Auto-Fix
Purpose: prevent common errors before quoting.

Interactions:
- Validation issue list sorted by severity
- "Fix for me" actions for common issues (aisle too narrow, overlap)
- Manual "locate on canvas" for each issue

Outputs:
- Quote-ready, rule-checked design

## Step 6: BOM and Pricing
Purpose: generate and adjust commercial proposal.

Interactions:
- Generate BOM from current revision
- Show grouped line items (frames, beams, accessories)
- Apply discount, shipping, and fees
- Keep design-linked lines marked as read-only by default

Outputs:
- Draft quote with totals and margin visibility

## Step 7: Finalize and Share
Purpose: close the on-site cycle.

Interactions:
- PDF preview
- Share/send options
- Save version snapshot

Outputs:
- Versioned quote + linked design revision

## 6) Mobile UX Layout Blueprint

Primary structure:
- Top: compact step progress bar (7 steps)
- Middle: main content area (form, canvas, or quote table)
- Bottom: sticky action rail (Back, Continue, Save, Validate)

Design behavior:
- One primary action per screen
- Bottom sheets for secondary actions
- Large touch targets (min 44 px)
- Persistent autosave state chip

Canvas-specific mobile pattern:
- Floating mode chips: Place, Select, Measure, Obstacles
- Pinch zoom + pan
- Tap selects, long-press enters multi-select mode

## 7) Hidden Advanced Editing (Progressive Disclosure)

Default behavior:
- Advanced controls hidden behind "Advanced aisle edit" action in each aisle card.

Advanced panel (bottom sheet):
- Per-aisle overrides: frame spec, beam spec, levels
- Per-bay override markers and clear override action
- Accessory-level adjustments where supported

Safety rails:
- Show impact preview before applying advanced changes
- Use plain-language warnings when a change can break compliance

## 8) Bulk Edit Strategy

Selection model:
- Long-press enters selection mode
- Tap to add/remove modules or bays
- Quick filters: "same aisle", "same spec", "same row"

Bulk actions:
- Change frame spec for selection
- Change beam spec for selection
- Adjust levels/elevations by template
- Duplicate or delete selected modules

Bulk edit guardrails:
- Disabled actions for invalid mixed selections
- Preview count and impacted components before commit
- Single undo for each bulk operation

## 9) Reuse Plan: CAD + Quoter Internals

The mobile app should be a new UI shell on top of existing domain/services.

Reuse from CAD:
- Layout and entity stores
- Wall and column stores
- Rack domain serialization/import/export format
- Validation and export pipelines where already implemented

Reuse from Quoter:
- Quote store lifecycle
- Quote schemas and calculations
- CAD-to-BOM derivation and sync service
- Quote versioning workflow

Integration contract:
- Keep documentType as rack-editor-project for compatibility
- Keep CAD to Quoter handoff payload structure stable
- Do not fork domain schema for mobile; add adapters in UI layer only

## 10) Proposed Mobile Module Structure

Create a dedicated UI package under quick-cad-bom while importing shared logic from CAD and Quoter domains.

Suggested slices:
- Wizard shell and step router
- Step-specific screens (setup, capture, strategy, layout, review, quote, finalize)
- Touch canvas controls and selection helpers
- Advanced edit sheet and bulk edit toolbar
- BOM and quote review panel optimized for mobile cards

## 11) Delivery Plan (Fast MVP)

## Phase 0 (1 week) - Foundations
- Build wizard shell, step state machine, autosave checkpoints
- Wire existing CAD and quote stores into a single mobile flow context
- Define analytics events for funnel tracking

Exit criteria:
- User can move across 7 steps with persisted state

## Phase 1 (2 weeks) - Quick Layout Core
- Implement warehouse capture + quick rack placement presets
- Enable minimal canvas interactions for touch
- Add validation panel with locate-on-canvas

Exit criteria:
- User can create a valid layout for common selective rack case

## Phase 2 (2 weeks) - Quote Generation and Finalization
- BOM generation, quote draft edits, totals, PDF export
- Quote version snapshot tied to design revision

Exit criteria:
- End-to-end quote generated from mobile without desktop handoff

## Phase 3 (1 to 2 weeks) - Advanced and Bulk Editing
- Hidden advanced aisle edits
- Multi-select and bulk actions
- UX hardening and performance pass

Exit criteria:
- Power users can perform controlled component overrides and bulk updates

## 12) Acceptance Criteria Mapped to Your Requirements

Requirement: draw rack layout quickly
- Done when user can place and duplicate common rack aisles from presets in under 10 minutes for a standard warehouse block.

Requirement: step-by-step guided wizard
- Done when all users must pass through the 7-step flow with validation gates and plain-language guidance.

Requirement: hidden individual component edits
- Done when advanced component editing exists but is collapsed behind explicit user action and not shown in default flow.

Requirement: bulk changes on selected modules/components
- Done when user can select multiple modules/bays and apply shared edits in one action with undo.

Requirement: reuse CAD and Quoter under-the-hood components
- Done when mobile flow consumes existing schemas/stores/services without duplicating business logic.

## 13) Key Risks and Mitigations

Risk: mobile canvas usability may be slow or error-prone.
Mitigation: prioritize preset-driven placement and row duplication over freeform drawing.

Risk: non-expert users may still get stuck.
Mitigation: add micro-guidance per step, starter templates, and auto-fix suggestions.

Risk: schema drift between mobile and desktop.
Mitigation: enforce shared serialization contracts and centralized schema imports.

Risk: performance on mid-range phones.
Mitigation: simplify render layers, debounce expensive validation, and lazy-load advanced panels.

## 14) Success Metrics for MVP

1. Median time from new project to generated quote <= 20 minutes.
2. At least 80 percent of pilot opportunities completed without desktop fallback.
3. At least 70 percent of generated layouts pass validation without manual expert intervention.
4. Fewer than 10 percent of sessions require opening advanced edit mode.

## 15) Immediate Next Actions

1. Approve the 7-step wizard and phase plan.
2. Confirm the exact list of rack presets for the 80 percent scenario.
3. Start implementation with Phase 0 shell in quick-cad-bom and shared store wiring.
