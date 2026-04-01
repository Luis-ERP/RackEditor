'use client';

// ─────────────────────────────────────────────────────────────────────────────
//  RackModuleEditor
//
//  Side-panel editor for a selected RACK_MODULE entity.
//  Renders inside EditorPanel.js when exactly one RACK_MODULE is selected.
//
//  Architecture:
//    - Reads the selected entity from layoutStore.
//    - Reads the RackModule domain object from rackDomainRef.
//    - Maintains a local `draft` state for live editing.
//    - On each committed change, calls commitDraftToModule → replaces domain
//      ref entry → calls layoutStore.update() to trigger canvas repaint.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { HOLE_STEP_IN, RowConfiguration } from '../../services/rack/constants.js';

const ROW_COUNT_MAP = {
  [RowConfiguration.SINGLE]:         1,
  [RowConfiguration.BACK_TO_BACK_2]: 2,
  [RowConfiguration.BACK_TO_BACK_3]: 3,
  [RowConfiguration.BACK_TO_BACK_4]: 4,
};

import {
  FRAME_HEIGHTS_IN,
  FRAME_DEPTHS_IN,
  FRAME_CAPACITY_CLASSES,
  BEAM_LENGTHS_IN,
  BEAM_CAPACITY_CLASSES,
  CAPACITY_LABELS,
  findFrameSpec,
  findBeamSpec,
} from '../../services/rack/catalogRegistry.js';
import {
  computeDraftValidation,
  computeEntityDimensions,
  maxAllowedHoleIndex,
  autoPositionNewLevel,
  addLevel,
  removeLevel,
  moveLevel,
  applyFrameSpec,
  applyBeamLength,
  applyLevelBeamSpec,
  commitDraftToModule,
  bindingFrameSpec,
  applyFrameOverrideAtIndex,
} from '../../services/rack/rackModuleEditorUtils.js';

// ── Entry point: reads selection, renders editor or null ─────────────────────

export default function RackModuleEditor({ layoutStore, layoutVersion, rackDomainRef, darkMode }) {
  if (!layoutStore) return null;

  const selCount  = layoutStore.selectionCount();
  const selected  = layoutStore.getSelectedEntities();
  const singleEnt = selCount === 1 ? selected[0] : null;
  const isRack    = singleEnt?.type === 'RACK_MODULE';

  if (!isRack) return null;

  const domainObj = rackDomainRef?.current?.get(singleEnt.domainId);
  if (!domainObj) return null;

  return (
    <ModuleEditorInner
      key={singleEnt.id}
      entity={singleEnt}
      domain={domainObj}
      layoutStore={layoutStore}
      rackDomainRef={rackDomainRef}
      darkMode={darkMode}
    />
  );
}

// ── Main editor component ─────────────────────────────────────────────────────

function ModuleEditorInner({ entity, domain, layoutStore, rackDomainRef, darkMode }) {
  const dk = darkMode;

  // Initialise draft from the domain object
  const initDraft = useCallback(() => {
    const holeIndices = domain.levelUnion.map((l) => l.holeIndex).sort((a, b) => a - b);
    const levelMap    = new Map(domain.levelUnion.map((l) => [l.holeIndex, l.beamSpec]));
    const beamSpecs   = holeIndices.map((h) => levelMap.get(h) ?? domain.bays[0]?.beamSpec);
    const refSpec     = beamSpecs[0] ?? domain.bays[0]?.beamSpec ?? domain.levelUnion[0]?.beamSpec;
    return {
      frameSpec:        domain.frameSpec,
      frameOverrides:   { ...domain.frameOverrides },
      beamLengthIn:     refSpec?.lengthIn ?? 96,
      beamSpecs,
      holeIndices,
      bayCount:         entity.bayCount || domain.bays.length,
      rowConfiguration: entity.rowConfiguration ?? RowConfiguration.SINGLE,
      spacerSizeIn:     entity.spacerSizeIn ?? 6,
    };
  }, [domain, entity]);

  const [draft, setDraft] = useState(initDraft);

  // Re-initialise when selection changes (key prop handles this, but guard anyway)
  useEffect(() => {
    setDraft(initDraft());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity.id, entity.domainId]);

  // Live validation of draft state
  const validation = useMemo(() => computeDraftValidation(draft), [draft]);

  // Write-back: build new domain object and update layout entity
  const commit = useCallback((newDraft) => {
    if (!newDraft.frameSpec || !newDraft.beamLengthIn) return;

    const startFrameIndex = domain.startFrameIndex ?? 0;
    let newMod;
    try {
      newMod = commitDraftToModule(newDraft, startFrameIndex);
    } catch {
      return; // factory rejected (e.g. incompatible specs) — leave canvas unchanged
    }

    // computeEntityDimensions returns widthM=beamLength, depthM=frameDepth (× rows + spacers).
    // Vertical racks (rotation=90) store widthM=depthM, depthM=widthM — swap.
    const isVertical = entity.transform.rotation === 90;
    const rowCount = ROW_COUNT_MAP[newDraft.rowConfiguration] ?? 1;
    const spacerIn = rowCount > 1 ? (newDraft.spacerSizeIn ?? 6) : 0;
    const rawDims = computeEntityDimensions(
      { lengthIn: newDraft.beamLengthIn },
      newDraft.frameSpec,
      newDraft.bayCount,
      rowCount,
      spacerIn,
    );
    const widthM = isVertical ? rawDims.depthM : rawDims.widthM;
    const depthM = isVertical ? rawDims.widthM : rawDims.depthM;

    const bayCount = newDraft.bayCount || 1;
    const depthIn = newDraft.frameSpec.depthIn;
    const beamLengthIn = newDraft.beamLengthIn;
    const dims = isVertical
      ? `${depthIn}" × ${beamLengthIn}"`
      : `${beamLengthIn}" × ${depthIn}"`;
    const label = bayCount > 1 ? `${bayCount}× ${dims}` : dims;

    rackDomainRef.current.delete(entity.domainId);
    rackDomainRef.current.set(newMod.id, newMod);
    layoutStore.update(entity.id, {
      domainId:         newMod.id,
      widthM,
      depthM,
      rowConfiguration: newDraft.rowConfiguration,
      spacerSizeIn:     newDraft.spacerSizeIn,
      label,
    });
  }, [domain, entity, layoutStore, rackDomainRef]);

  // Updater: mutate draft and commit in one step.
  // Intentionally does NOT call commit inside setDraft's updater — side effects
  // inside updaters cause layoutStore to trigger a synchronous re-render before
  // React applies the new draft, producing a one-click visual lag.
  const update = useCallback((mutateFn) => {
    const next = mutateFn(draft);
    setDraft(next);
    commit(next);
  }, [draft, commit]);

  // ── Colours ──────────────────────────────────────────────────────────────
  const c = useColors(dk);

  return (
    <div style={{ color: c.text, fontSize: 12 }}>
      {/* ── Validation Banner ───────────────────────────────────────────── */}
      <ValidationBanner validation={validation} dk={dk} c={c} />

      {/* ── Frame Configuration (default) ───────────────────────────────── */}
      <CollapsibleSection label="Frame" dk={dk} c={c} defaultOpen>
        <FramePicker
          draft={draft}
          onChange={(newFrameSpec) => update((d) => applyFrameSpec(d, newFrameSpec))}
          dk={dk}
          c={c}
        />
      </CollapsibleSection>

      {/* ── Per-Frame Overrides ──────────────────────────────────────────── */}
      <CollapsibleSection
        label="Per-Frame Overrides"
        dk={dk}
        c={c}
        badge={Object.keys(draft.frameOverrides ?? {}).length > 0
          ? `${Object.keys(draft.frameOverrides).length} custom`
          : null}
      >
        <FrameOverrideList
          draft={draft}
          onOverride={(localIdx, spec) => update((d) => applyFrameOverrideAtIndex(d, localIdx, spec))}
          onResetAll={() => update((d) => ({ ...d, frameOverrides: {} }))}
          dk={dk}
          c={c}
        />
      </CollapsibleSection>

      {/* ── Beam Configuration ──────────────────────────────────────────── */}
      <CollapsibleSection label="Beam" dk={dk} c={c} defaultOpen>
        <BeamPicker
          draft={draft}
          onChange={(newLengthIn) => update((d) => applyBeamLength(d, newLengthIn))}
          dk={dk}
          c={c}
        />
      </CollapsibleSection>

      {/* ── Beam Levels ─────────────────────────────────────────────────── */}
      <CollapsibleSection label="Beam Levels" dk={dk} c={c} defaultOpen>
        {draft.frameSpec && draft.beamLengthIn && (
          <RackFrontView
            draft={draft}
            validation={validation}
            onMove={(levelIndex, newHole) => update((d) => moveLevel(d, levelIndex, newHole))}
            dk={dk}
            c={c}
          />
        )}
        <BeamLevelList
          draft={draft}
          validation={validation}
          onMove={(levelIndex, newHole) => update((d) => moveLevel(d, levelIndex, newHole))}
          onRemove={(levelIndex) => update((d) => removeLevel(d, levelIndex))}
          onAdd={() => update((d) => addLevel(d))}
          onLevelCapacity={(levelIndex, cap) => update((d) => {
            const spec = findBeamSpec(d.beamLengthIn, cap);
            return spec ? applyLevelBeamSpec(d, levelIndex, spec) : d;
          })}
          dk={dk}
          c={c}
        />
      </CollapsibleSection>

      {/* ── Row Configuration ───────────────────────────────────────────── */}
      <CollapsibleSection label="Back-to-back" dk={dk} c={c}>
        <RowConfigControl
          draft={draft}
          onChange={(rowConfiguration) => update((d) => ({ ...d, rowConfiguration }))}
          onSpacerChange={(spacerSizeIn) => update((d) => ({ ...d, spacerSizeIn }))}
          dk={dk}
          c={c}
        />
      </CollapsibleSection>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  FramePicker
// ─────────────────────────────────────────────────────────────────────────────

function FramePicker({ draft, onChange, dk, c }) {
  const cur = draft.frameSpec;
  const [selHeight,   setSelHeight]   = useState(cur?.heightIn   ?? 144);
  const [selDepth,    setSelDepth]    = useState(cur?.depthIn    ?? 42);
  const [selCapacity, setSelCapacity] = useState(cur?.capacityClass ?? 'standard');

  // Keep local state in sync if draft is reset externally
  useEffect(() => {
    if (cur) {
      setSelHeight(cur.heightIn);
      setSelDepth(cur.depthIn);
      setSelCapacity(cur.capacityClass);
    }
  }, [cur?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Find matching spec and notify parent
  const tryApply = useCallback((h, d, cap) => {
    const spec = findFrameSpec(h, d, cap);
    if (spec) onChange(spec);
  }, [onChange]);

  const handleHeight   = (h)   => { setSelHeight(h);   tryApply(h, selDepth, selCapacity); };
  const handleDepth    = (d)   => { setSelDepth(d);    tryApply(selHeight, d, selCapacity); };
  const handleCapacity = (cap) => { setSelCapacity(cap); tryApply(selHeight, selDepth, cap); };

  const matched = findFrameSpec(selHeight, selDepth, selCapacity);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <AttrRow label="Height">
        <SegmentedControl
          options={FRAME_HEIGHTS_IN.map((h) => ({ value: h, label: `${h}"` }))}
          value={selHeight}
          onChange={handleHeight}
          dk={dk} c={c}
        />
      </AttrRow>
      <AttrRow label="Depth">
        <SegmentedControl
          options={FRAME_DEPTHS_IN.map((d) => ({ value: d, label: `${d}"` }))}
          value={selDepth}
          onChange={handleDepth}
          dk={dk} c={c}
        />
      </AttrRow>
      <AttrRow label="Capacity">
        <SegmentedControl
          options={FRAME_CAPACITY_CLASSES.map((cap) => ({ value: cap, label: CAPACITY_LABELS[cap] }))}
          value={selCapacity}
          onChange={handleCapacity}
          dk={dk} c={c}
        />
      </AttrRow>
      <SpecMatchBadge matched={matched} label="Frame" dk={dk} c={c} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  BeamPicker
// ─────────────────────────────────────────────────────────────────────────────

function BeamPicker({ draft, onChange, dk, c }) {
  const [selLength, setSelLength] = useState(draft.beamLengthIn ?? 96);

  useEffect(() => {
    setSelLength(draft.beamLengthIn);
  }, [draft.beamLengthIn]);

  const handleLength = (l) => { setSelLength(l); onChange(l); };

  return (
    <AttrRow label="Length">
      <SegmentedControl
        options={BEAM_LENGTHS_IN.map((l) => ({ value: l, label: `${l}"` }))}
        value={selLength}
        onChange={handleLength}
        dk={dk} c={c}
      />
    </AttrRow>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  RackFrontView  (SVG elevation diagram with draggable beam handles)
// ─────────────────────────────────────────────────────────────────────────────

const SVG_W = 280;
const SVG_H = 160;
const COL_W = 10;   // upright column width (px)
const PAD_X = 36;   // horizontal padding — wide enough for labels like "108""
const PAD_Y = 8;    // vertical padding

function RackFrontView({ draft, validation, onMove, dk, c }) {
  const { frameSpec, beamLengthIn, holeIndices } = draft;
  if (!frameSpec || !beamLengthIn) return null;

  const sorted     = [...holeIndices].sort((a, b) => a - b);
  const frameH     = frameSpec.heightIn;
  const scale      = (SVG_H - 2 * PAD_Y) / frameH;  // px per inch
  const leftX      = PAD_X;
  const rightX     = SVG_W - PAD_X - COL_W;
  const beamLeft   = leftX + COL_W;
  const beamRight  = rightX;

  // Drag state
  const dragRef    = useRef(null); // { levelIndex, svgY, initialHole }
  const svgRef     = useRef(null);
  const [dragY, setDragY] = useState(null); // current drag preview Y

  // Convert hole index → SVG Y (inverted: low elevation = high Y)
  const holeToY = (hole) => SVG_H - PAD_Y - hole * HOLE_STEP_IN * scale;
  // Convert SVG Y → hole index (clamped to valid range)
  const yToHole = (y) => {
    const elevation = (SVG_H - PAD_Y - y) / scale;
    return Math.max(0, Math.round(elevation / HOLE_STEP_IN));
  };

  // Error level indices (for red colouring)
  const errorLevelIndices = useMemo(() => {
    const set = new Set();
    for (const e of validation.errors) {
      if (e.context?.levelIndex != null) set.add(e.context.levelIndex);
    }
    return set;
  }, [validation.errors]);

  const onMouseDown = (e, levelIndex) => {
    e.preventDefault();
    dragRef.current = { levelIndex, initialHole: sorted[levelIndex] };
    setDragY(holeToY(sorted[levelIndex]));
  };

  const onSvgMouseMove = (e) => {
    if (!dragRef.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const y    = e.clientY - rect.top;
    setDragY(Math.max(PAD_Y, Math.min(SVG_H - PAD_Y, y)));
  };

  const onSvgMouseUp = () => {
    if (!dragRef.current) return;
    const newHole = yToHole(dragY ?? holeToY(dragRef.current.initialHole));
    onMove(dragRef.current.levelIndex, newHole);
    dragRef.current = null;
    setDragY(null);
  };

  const onSvgMouseLeave = () => {
    if (dragRef.current) {
      dragRef.current = null;
      setDragY(null);
    }
  };

  return (
    <svg
      ref={svgRef}
      width={SVG_W}
      height={SVG_H}
      style={{
        display: 'block',
        borderRadius: 6,
        border: `1px solid ${c.border}`,
        background: dk ? '#18191c' : '#f9fafb',
        marginBottom: 8,
        cursor: dragRef.current ? 'ns-resize' : 'default',
        userSelect: 'none',
      }}
      onMouseMove={onSvgMouseMove}
      onMouseUp={onSvgMouseUp}
      onMouseLeave={onSvgMouseLeave}
    >
      {/* Left upright column */}
      <rect
        x={leftX} y={PAD_Y}
        width={COL_W} height={SVG_H - 2 * PAD_Y}
        fill={dk ? '#374151' : '#9ca3af'}
        rx={2}
      />
      {/* Right upright column */}
      <rect
        x={rightX} y={PAD_Y}
        width={COL_W} height={SVG_H - 2 * PAD_Y}
        fill={dk ? '#374151' : '#9ca3af'}
        rx={2}
      />

      {/* Frame height label */}
      <text
        x={leftX - 2} y={PAD_Y + 4}
        textAnchor="end"
        fontSize={9}
        fill={c.muted}
      >{frameH}"</text>

      {/* Beam lines */}
      {sorted.map((hole, idx) => {
        const isDragging = dragRef.current?.levelIndex === idx;
        const y          = isDragging ? (dragY ?? holeToY(hole)) : holeToY(hole);
        const isError    = errorLevelIndices.has(idx);
        const color      = isError ? '#ef4444' : (dk ? '#60a5fa' : '#3b82f6');

        return (
          <g key={idx}>
            {/* Beam line */}
            <line
              x1={beamLeft} y1={y}
              x2={beamRight} y2={y}
              stroke={color}
              strokeWidth={isDragging ? 3 : 2}
              strokeLinecap="round"
            />
            {/* Elevation label — anchored left of the upright column */}
            <text
              x={leftX - 3} y={y + 4}
              textAnchor="end"
              fontSize={8}
              fill={isError ? '#ef4444' : c.muted}
            >{hole * HOLE_STEP_IN}"</text>
            {/* Drag handle */}
            <circle
              cx={(beamLeft + beamRight) / 2}
              cy={y}
              r={isDragging ? 7 : 5}
              fill={isDragging ? color : 'transparent'}
              stroke={color}
              strokeWidth={1.5}
              cursor="ns-resize"
              onMouseDown={(e) => onMouseDown(e, idx)}
            />
            {/* Level index badge */}
            <text
              x={beamRight + COL_W + 4}
              y={y + 4}
              fontSize={8}
              fill={c.muted}
            >{idx}</text>
          </g>
        );
      })}

      {/* Drag preview position indicator when dragging */}
      {dragRef.current && dragY != null && (
        <line
          x1={beamLeft} y1={dragY}
          x2={beamRight} y2={dragY}
          stroke={dk ? '#fbbf24' : '#f59e0b'}
          strokeWidth={1}
          strokeDasharray="4 2"
        />
      )}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  BeamLevelList
// ─────────────────────────────────────────────────────────────────────────────

const CAP_SHORT = { light: 'L', standard: 'S', medium: 'M', heavy: 'H' };

function BeamLevelList({ draft, validation, onMove, onRemove, onAdd, onLevelCapacity, dk, c }) {
  const { frameSpec, beamLengthIn, beamSpecs, holeIndices } = draft;
  const sorted = [...holeIndices].sort((a, b) => a - b);

  const maxAllowed = frameSpec ? maxAllowedHoleIndex(frameSpec) : 0;
  const topSpec    = beamSpecs.length > 0 ? beamSpecs[beamSpecs.length - 1] : null;
  const newSpec    = findBeamSpec(beamLengthIn, topSpec?.capacityClass ?? 'standard');
  const canAdd     = frameSpec && beamLengthIn && autoPositionNewLevel(holeIndices, frameSpec, topSpec, newSpec) !== null;

  // Map levelIndex → error messages
  const levelErrors = useMemo(() => {
    const map = new Map();
    for (const e of validation.errors) {
      if (e.context?.levelIndex != null) {
        const li = e.context.levelIndex;
        if (!map.has(li)) map.set(li, []);
        map.get(li).push(e.message);
      }
    }
    return map;
  }, [validation.errors]);

  return (
    <div>
      {sorted.length === 0 && (
        <div style={{ color: c.muted, fontSize: 11, marginBottom: 8, textAlign: 'center', padding: '4px 0' }}>
          No beam levels — add one below
        </div>
      )}

      {sorted.map((hole, idx) => {
        const elevation   = hole * HOLE_STEP_IN;
        const errors      = levelErrors.get(idx) ?? [];
        const hasError    = errors.length > 0;
        const levelCap    = beamSpecs[idx]?.capacityClass ?? 'standard';

        return (
          <div key={idx} style={{
            padding: '8px 0',
            borderBottom: `1px solid ${c.divider}`,
          }}>
            {/* Row 1: badge + elevation + delete */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                background: hasError ? '#ef4444' : (dk ? '#1e3a5f' : '#dbeafe'),
                color: hasError ? '#fff' : (dk ? '#93c5fd' : '#1e40af'),
                fontSize: 9,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>{idx}</span>

              <span style={{ flex: 1, color: c.muted, fontSize: 11 }}>
                {elevation}"
              </span>

              <button
                onClick={() => onRemove(idx)}
                title="Remove level"
                style={{
                  width: 20, height: 20, border: 'none', borderRadius: 4,
                  background: 'transparent', color: c.muted, cursor: 'pointer',
                  fontSize: 14, lineHeight: 1, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = dk ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = c.muted; e.currentTarget.style.background = 'transparent'; }}
              >×</button>
            </div>

            {/* Row 2: hole stepper + capacity buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Hole stepper */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                <StepperButton onClick={() => onMove(idx, hole - 1)} disabled={hole <= 0} dk={dk} c={c}>−</StepperButton>
                <span style={{
                  fontFamily: 'monospace', fontSize: 11, width: 44,
                  textAlign: 'center', color: c.text,
                }}>hole #{hole}</span>
                <StepperButton onClick={() => onMove(idx, hole + 1)} disabled={hole >= maxAllowed} dk={dk} c={c}>+</StepperButton>
              </div>

              {/* Per-level capacity selector */}
              <div style={{ display: 'flex', border: `1px solid ${c.border}`, borderRadius: 4, overflow: 'hidden' }}>
                {BEAM_CAPACITY_CLASSES.map((cap, ci) => {
                  const active = cap === levelCap;
                  return (
                    <button
                      key={cap}
                      onClick={() => onLevelCapacity(idx, cap)}
                      title={CAPACITY_LABELS[cap]}
                      style={{
                        width: 20, height: 20, border: 'none',
                        borderRight: ci < BEAM_CAPACITY_CLASSES.length - 1 ? `1px solid ${c.border}` : 'none',
                        background: active ? (dk ? '#1e3a5f' : '#eff6ff') : (dk ? '#2d2f34' : '#fff'),
                        color: active ? (dk ? '#93c5fd' : '#1d4ed8') : c.muted,
                        fontSize: 9, fontWeight: active ? 700 : 400,
                        cursor: 'pointer', padding: 0, lineHeight: 1,
                      }}
                    >{CAP_SHORT[cap]}</button>
                  );
                })}
              </div>
            </div>

            {/* Inline error messages */}
            {errors.map((msg, mi) => (
              <div key={mi} style={{ fontSize: 10, color: '#ef4444', paddingTop: 3, lineHeight: 1.3 }}>
                ↳ {msg}
              </div>
            ))}
          </div>
        );
      })}

      {/* Add level button */}
      <button
        onClick={onAdd}
        disabled={!canAdd}
        style={{
          marginTop: 8,
          width: '100%',
          padding: '5px 0',
          border: `1px dashed ${canAdd ? (dk ? '#4b5563' : '#d1d5db') : c.divider}`,
          borderRadius: 6,
          background: 'transparent',
          color: canAdd ? (dk ? '#9ca3af' : '#6b7280') : c.divider,
          fontSize: 11,
          cursor: canAdd ? 'pointer' : 'not-allowed',
          transition: 'all 0.12s',
        }}
        onMouseEnter={(e) => { if (canAdd) { e.currentTarget.style.borderColor = dk ? '#60a5fa' : '#3b82f6'; e.currentTarget.style.color = dk ? '#60a5fa' : '#3b82f6'; } }}
        onMouseLeave={(e) => { if (canAdd) { e.currentTarget.style.borderColor = dk ? '#4b5563' : '#d1d5db'; e.currentTarget.style.color = dk ? '#9ca3af' : '#6b7280'; } }}
      >
        + Add Beam Level
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  FrameOverrideList  (per-frame spec customisation)
// ─────────────────────────────────────────────────────────────────────────────

function FrameOverrideList({ draft, onOverride, onResetAll, dk, c }) {
  const { frameSpec, frameOverrides = {}, bayCount = 1 } = draft;
  const frameCount  = bayCount + 1;
  const binding     = bindingFrameSpec(draft);
  const customCount = Object.keys(frameOverrides).length;

  // Find the local index of the binding frame (for the constraint indicator).
  let bindingIdx = null;
  if (customCount > 0) {
    let min = frameSpec.heightIn;
    for (const [k, spec] of Object.entries(frameOverrides)) {
      if (spec.heightIn < min) { min = spec.heightIn; bindingIdx = Number(k); }
    }
  }

  return (
    <div>
      {/* Binding constraint indicator */}
      {customCount > 0 && (
        <div style={{
          fontSize: 10,
          color: dk ? '#fbbf24' : '#b45309',
          background: dk ? 'rgba(251,191,36,0.08)' : 'rgba(251,191,36,0.1)',
          border: `1px solid ${dk ? 'rgba(251,191,36,0.3)' : 'rgba(251,191,36,0.4)'}`,
          borderRadius: 5,
          padding: '4px 8px',
          marginBottom: 8,
          lineHeight: 1.4,
        }}>
          Binding height: {binding.heightIn}"
          {bindingIdx !== null ? ` (Frame ${bindingIdx})` : ' (default)'}
          {' '}— beam levels constrained to this frame.
        </div>
      )}

      {Array.from({ length: frameCount }, (_, localIdx) => {
        const isCustom  = frameOverrides[localIdx] != null;
        const resolved  = isCustom ? frameOverrides[localIdx] : frameSpec;
        return (
          <FrameOverrideRow
            key={localIdx}
            localIdx={localIdx}
            spec={resolved}
            defaultSpec={frameSpec}
            isCustom={isCustom}
            onOverride={(spec) => onOverride(localIdx, spec)}
            onReset={() => onOverride(localIdx, null)}
            dk={dk}
            c={c}
          />
        );
      })}

      {/* Reset-all action */}
      {customCount > 0 && (
        <button
          onClick={onResetAll}
          style={{
            marginTop: 6,
            width: '100%',
            padding: '4px 0',
            border: `1px solid ${dk ? '#4b5563' : '#d1d5db'}`,
            borderRadius: 5,
            background: 'transparent',
            color: c.muted,
            fontSize: 10,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef4444'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = c.muted; e.currentTarget.style.borderColor = dk ? '#4b5563' : '#d1d5db'; }}
        >
          Reset all to default
        </button>
      )}
    </div>
  );
}

function FrameOverrideRow({ localIdx, spec, defaultSpec, isCustom, onOverride, onReset, dk, c }) {
  const [expanded, setExpanded] = useState(false);

  // Depth is locked to the module default — only height and capacity can be overridden per frame.
  const lockedDepth = defaultSpec.depthIn;

  // Local picker state — initialised from current resolved spec.
  const [selHeight,   setSelHeight]   = useState(spec.heightIn);
  const [selCapacity, setSelCapacity] = useState(spec.capacityClass);

  // Keep local picker in sync when the resolved spec changes externally.
  useEffect(() => {
    setSelHeight(spec.heightIn);
    setSelCapacity(spec.capacityClass);
  }, [spec.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  const tryApply = (h, cap) => {
    const newSpec = findFrameSpec(h, lockedDepth, cap);
    if (newSpec) onOverride(newSpec);
  };

  const matched = findFrameSpec(selHeight, lockedDepth, selCapacity);

  return (
    <div style={{ borderBottom: `1px solid ${c.divider}`, paddingBottom: 6, marginBottom: 6 }}>
      {/* Summary row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Frame index badge */}
        <span style={{
          width: 20, height: 20, borderRadius: 4, flexShrink: 0,
          background: isCustom ? (dk ? '#1e3a5f' : '#dbeafe') : (dk ? '#2d2f34' : '#f3f4f6'),
          color: isCustom ? (dk ? '#93c5fd' : '#1e40af') : c.muted,
          fontSize: 9, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>F{localIdx}</span>

        {/* Spec summary */}
        <span style={{ flex: 1, fontSize: 11, color: c.text, fontFamily: 'monospace' }}>
          {spec.heightIn}"
        </span>

        {/* Custom badge + reset */}
        {isCustom && (
          <>
            <span style={{
              fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 8,
              background: dk ? '#1e3a5f' : '#dbeafe', color: dk ? '#93c5fd' : '#1e40af',
            }}>custom</span>
            <button
              onClick={onReset}
              title="Reset to module default"
              style={{
                width: 20, height: 20, border: 'none', borderRadius: 4, padding: 0,
                background: 'transparent', color: c.muted, cursor: 'pointer', fontSize: 13,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = c.muted; }}
            >↺</button>
          </>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((x) => !x)}
          title={expanded ? 'Collapse' : 'Edit this frame'}
          style={{
            width: 20, height: 20, border: `1px solid ${c.border}`, borderRadius: 4, padding: 0,
            background: expanded ? (dk ? '#1e3a5f' : '#eff6ff') : 'transparent',
            color: expanded ? (dk ? '#93c5fd' : '#1d4ed8') : c.muted,
            cursor: 'pointer', fontSize: 11,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >{expanded ? '▲' : '✎'}</button>
      </div>

      {/* Inline spec picker */}
      {expanded && (
        <div style={{ paddingTop: 10, paddingLeft: 26, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <AttrRow label="Height">
            <SegmentedControl
              options={FRAME_HEIGHTS_IN.map((h) => ({ value: h, label: `${h}"` }))}
              value={selHeight}
              onChange={(h) => { setSelHeight(h); tryApply(h, selCapacity); }}
              dk={dk} c={c}
            />
          </AttrRow>
          <AttrRow label="Capacity">
            <SegmentedControl
              options={FRAME_CAPACITY_CLASSES.map((cap) => ({ value: cap, label: CAPACITY_LABELS[cap] }))}
              value={selCapacity}
              onChange={(cap) => { setSelCapacity(cap); tryApply(selHeight, cap); }}
              dk={dk} c={c}
            />
          </AttrRow>
          <SpecMatchBadge matched={matched} label="Frame" dk={dk} c={c} />
          {!isCustom && matched && matched.id !== defaultSpec.id && (
            <div style={{ fontSize: 10, color: c.muted }}>
              Differs from default — will be saved as an override.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  RowConfigControl
// ─────────────────────────────────────────────────────────────────────────────

const ROW_OPTIONS = [
  { value: RowConfiguration.SINGLE,         label: '1×' },
  { value: RowConfiguration.BACK_TO_BACK_2, label: '2×' },
  { value: RowConfiguration.BACK_TO_BACK_3, label: '3×' },
  { value: RowConfiguration.BACK_TO_BACK_4, label: '4×' },
];

function RowConfigControl({ draft, onChange, onSpacerChange, dk, c }) {
  const [spacerVal, setSpacerVal] = useState(String(draft.spacerSizeIn ?? 6));

  useEffect(() => {
    setSpacerVal(String(draft.spacerSizeIn ?? 6));
  }, [draft.spacerSizeIn]);

  const commitSpacer = () => {
    const num = parseFloat(spacerVal);
    if (!isNaN(num) && num > 0) {
      onSpacerChange(num);
    } else {
      setSpacerVal(String(draft.spacerSizeIn ?? 6));
    }
  };

  const isBackToBack = draft.rowConfiguration !== RowConfiguration.SINGLE;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SegmentedControl
        options={ROW_OPTIONS}
        value={draft.rowConfiguration}
        onChange={onChange}
        dk={dk} c={c}
      />
      {isBackToBack && (
        <AttrRow label="Spacer">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            border: `1px solid ${c.border}`,
            borderRadius: 6,
            overflow: 'hidden',
            background: c.inputBg,
            maxWidth: 100,
          }}>
            <input
              type="number"
              step="1"
              min="3"
              max="24"
              value={spacerVal}
              onChange={(e) => setSpacerVal(e.target.value)}
              onBlur={commitSpacer}
              onKeyDown={(e) => { if (e.key === 'Enter') { commitSpacer(); e.target.blur(); } }}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: c.text,
                fontSize: 12,
                fontFamily: 'monospace',
                padding: '4px 6px',
                width: 0,
              }}
            />
            <span style={{ fontSize: 10, color: c.muted, paddingRight: 6 }}>in</span>
          </div>
        </AttrRow>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  ValidationBanner
// ─────────────────────────────────────────────────────────────────────────────

const STATE_CONFIG = {
  VALID:               { bg: 'rgba(16,185,129,0.1)', border: '#10b981', text: '#059669', label: 'Valid' },
  VALID_WITH_WARNINGS: { bg: 'rgba(245,158,11,0.1)', border: '#f59e0b', text: '#d97706', label: 'Warnings' },
  INVALID:             { bg: 'rgba(239,68,68,0.1)',  border: '#ef4444', text: '#dc2626', label: 'Invalid' },
  INCOMPLETE:          { bg: 'rgba(107,114,128,0.1)',border: '#6b7280', text: '#6b7280', label: 'Incomplete' },
};

function ValidationBanner({ validation, dk, c }) {
  const [expanded, setExpanded] = useState(false);
  const cfg    = STATE_CONFIG[validation.state] ?? STATE_CONFIG.INCOMPLETE;
  const issues = [...validation.errors, ...validation.warnings];

  return (
    <div style={{ margin: '10px 0' }}>
      <button
        onClick={() => setExpanded((x) => !x)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 8px',
          border: `1px solid ${cfg.border}`,
          borderRadius: 6,
          background: cfg.bg,
          cursor: issues.length > 0 ? 'pointer' : 'default',
          textAlign: 'left',
        }}
      >
        <span style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: cfg.border,
          flexShrink: 0,
        }} />
        <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: cfg.text }}>
          {cfg.label}
        </span>
        {issues.length > 0 && (
          <span style={{ fontSize: 10, color: cfg.text }}>
            {issues.length} issue{issues.length !== 1 ? 's' : ''} {expanded ? '▲' : '▼'}
          </span>
        )}
      </button>

      {expanded && issues.length > 0 && (
        <div style={{
          marginTop: 2,
          padding: '6px 8px',
          border: `1px solid ${c.border}`,
          borderRadius: 6,
          background: dk ? '#18191c' : '#f9fafb',
          maxHeight: 120,
          overflow: 'auto',
        }}>
          {issues.map((issue, i) => (
            <div key={i} style={{
              fontSize: 10,
              color: issue.severity === 'error' ? '#ef4444' : '#f59e0b',
              lineHeight: 1.4,
              marginBottom: 3,
            }}>
              {issue.severity === 'error' ? '✕' : '⚠'} {issue.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────

function CollapsibleSection({ label, dk, c, defaultOpen = false, badge = null, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 10 }}>
      <button
        onClick={() => setOpen((x) => !x)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 0',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: c.muted,
          borderBottom: `1px solid ${c.divider}`,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {label}
          </span>
          {badge && (
            <span style={{
              fontSize: 9,
              fontWeight: 600,
              padding: '1px 5px',
              borderRadius: 8,
              background: dk ? '#1e3a5f' : '#dbeafe',
              color: dk ? '#93c5fd' : '#1e40af',
            }}>{badge}</span>
          )}
        </span>
        <span style={{ fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ paddingTop: 12, paddingBottom: 8 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ dk, c, label, badge }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
      paddingBottom: 6,
      borderBottom: `1px solid ${c.divider}`,
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: c.text }}>
        {label}
      </span>
      {badge && (
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          padding: '1px 6px',
          borderRadius: 10,
          background: dk ? '#1e3a5f' : '#dbeafe',
          color: dk ? '#93c5fd' : '#1e40af',
        }}>{badge}</span>
      )}
    </div>
  );
}

function AttrRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        minWidth: 52,
        color: '#9ca3af',
        flexShrink: 0,
      }}>{label}</span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function SegmentedControl({ options, value, onChange, dk, c }) {
  return (
    <div style={{
      display: 'flex',
      border: `1px solid ${c.border}`,
      borderRadius: 6,
      overflow: 'hidden',
      flexWrap: 'wrap',
    }}>
      {options.map(({ value: v, label }, i) => {
        const active = v === value;
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            style={{
              flex: 1,
              padding: '4px 3px',
              border: 'none',
              borderRight: i < options.length - 1 ? `1px solid ${c.border}` : 'none',
              background: active ? (dk ? '#1e3a5f' : '#eff6ff') : (dk ? '#2d2f34' : '#ffffff'),
              color: active ? (dk ? '#93c5fd' : '#1d4ed8') : c.muted,
              fontSize: 10,
              fontWeight: active ? 700 : 400,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.1s',
              userSelect: 'none',
              minWidth: 0,
            }}
          >{label}</button>
        );
      })}
    </div>
  );
}

function SpecMatchBadge({ matched, label, dk, c }) {
  if (matched) {
    return (
      <div style={{ fontSize: 9, color: dk ? '#6ee7b7' : '#059669', fontFamily: 'monospace', opacity: 0.8 }}>
        ✓ {matched.id}
      </div>
    );
  }
  return (
    <div style={{ fontSize: 9, color: '#ef4444' }}>
      ✕ No matching {label} in catalog for this combination
    </div>
  );
}

function StepperButton({ onClick, disabled, children, dk, c }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 20,
        height: 20,
        border: `1px solid ${c.border}`,
        borderRadius: 3,
        background: dk ? '#2d2f34' : '#f9fafb',
        color: disabled ? c.divider : c.text,
        fontSize: 13,
        lineHeight: 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        flexShrink: 0,
      }}
    >{children}</button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Colour palette hook
// ─────────────────────────────────────────────────────────────────────────────

function useColors(dk) {
  return useMemo(() => ({
    text:    dk ? '#e5e7eb' : '#111827',
    muted:   dk ? '#6b7280' : '#9ca3af',
    border:  dk ? '#374151' : '#e5e7eb',
    divider: dk ? '#2d2f34' : '#f3f4f6',
    inputBg: dk ? '#2d2f34' : '#f9fafb',
  }), [dk]);
}
