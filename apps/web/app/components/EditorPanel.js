'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * EditorPanel – left sidebar with two sections:
 *   1. Object Picker  – top, scrollable list of objects the user can place
 *   2. Object Editor  – bottom, properties/settings for the selected object
 */
export const PANEL_WIDTH = 320; // px – fixed width

export default function EditorPanel({
  drawingMode,
  onToggleDrawingMode,
  darkMode = false,
  layoutStore,
  layoutVersion,
  rackOrientation = 'horizontal',
  onToggleOrientation,
  wallMode = null,
  onSetWallMode,
  wallStore = null,
  wallStoreVersion,
  columnMode = false,
  onToggleColumnMode,
  columnStore = null,
  columnStoreVersion,
  children,
}) {
  const dk = darkMode;
  return (
    <aside style={{
      ...panelStyle,
      background: dk ? '#1e1f22' : '#ffffff',
      borderRightColor: dk ? '#374151' : '#e5e7eb',
    }}>
      {/* ── Section 1: Object Picker ─────────────────────────── */}
      <div style={pickerSectionStyle}>
        <div style={{
          ...sectionHeaderStyle,
          color: dk ? '#9ca3af' : '#6b7280',
          borderBottomColor: dk ? '#2d2f34' : '#f3f4f6',
        }}>Objects</div>
        <div style={sectionBodyStyle}>
          <button
            onClick={onToggleDrawingMode}
            style={{
              ...rackBtnStyle,
              background: drawingMode
                ? (dk ? '#1e3a5f' : '#eff6ff')
                : (dk ? '#2d2f34' : '#ffffff'),
              borderColor: drawingMode
                ? '#3b82f6'
                : (dk ? '#4b5563' : '#e5e7eb'),
              color: drawingMode
                ? (dk ? '#93c5fd' : '#1d4ed8')
                : (dk ? '#d1d5db' : '#374151'),
              ...(drawingMode ? { boxShadow: '0 0 0 2px rgba(59,130,246,0.2)' } : {}),
            }}
            title="Click to enter rack drawing mode, then click & drag on the canvas"
          >
            {/* simple rack icon */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
              <rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <line x1="2" y1="7"  x2="18" y2="7"  stroke="currentColor" strokeWidth="1" />
              <line x1="2" y1="13" x2="18" y2="13" stroke="currentColor" strokeWidth="1" />
            </svg>
            <span style={{ flex: 1 }}>Rack</span>
            {drawingMode && <span style={badgeStyle}>ACTIVE</span>}
          </button>

          {/* ── Wall tools ── */}
          <div style={{ marginTop: 14 }}>
            <div style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: dk ? '#6b7280' : '#9ca3af',
              marginBottom: 5,
              userSelect: 'none',
            }}>
              Walls
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['rect', 'line'].map((mode) => {
                const active = wallMode === mode;
                const label = mode === 'rect' ? 'Rectangle' : 'Line';
                return (
                  <button
                    key={mode}
                    onClick={() => onSetWallMode?.(mode)}
                    style={{
                      ...wallBtnStyle,
                      background: active
                        ? (dk ? '#1e3a5f' : '#eff6ff')
                        : (dk ? '#2d2f34' : '#ffffff'),
                      borderColor: active
                        ? '#3b82f6'
                        : (dk ? '#4b5563' : '#e5e7eb'),
                      color: active
                        ? (dk ? '#93c5fd' : '#1d4ed8')
                        : (dk ? '#d1d5db' : '#374151'),
                      ...(active ? { boxShadow: '0 0 0 2px rgba(59,130,246,0.2)' } : {}),
                    }}
                    title={`Draw walls in ${label.toLowerCase()} mode`}
                  >
                    {mode === 'rect'
                      ? <WallRectIcon size={16} />
                      : <WallLineIcon size={16} />
                    }
                    <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
                    {active && <span style={badgeStyle}>ACTIVE</span>}
                  </button>
                );
              })}
            </div>

          </div>

          {/* ── Column tool ── */}
          <div style={{ marginTop: 14 }}>
            <div style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: dk ? '#6b7280' : '#9ca3af',
              marginBottom: 5,
              userSelect: 'none',
            }}>
              Columns
            </div>
            <button
              onClick={onToggleColumnMode}
              style={{
                ...wallBtnStyle,
                width: '100%',
                background: columnMode
                  ? (dk ? '#1e3a5f' : '#eff6ff')
                  : (dk ? '#2d2f34' : '#ffffff'),
                borderColor: columnMode
                  ? '#3b82f6'
                  : (dk ? '#4b5563' : '#e5e7eb'),
                color: columnMode
                  ? (dk ? '#93c5fd' : '#1d4ed8')
                  : (dk ? '#d1d5db' : '#374151'),
                ...(columnMode ? { boxShadow: '0 0 0 2px rgba(59,130,246,0.2)' } : {}),
              }}
              title="Click to enter column placement mode, then click on the canvas"
            >
              <ColumnIcon size={16} />
              <span style={{ flex: 1, textAlign: 'left' }}>Column</span>
              {columnMode && <span style={badgeStyle}>ACTIVE</span>}
            </button>
          </div>
        </div>
      </div>

      {/* ── Resizable divider ────────────────────────────────── */}
      <div style={{ ...dividerStyle, background: dk ? '#374151' : '#e5e7eb' }} />

      {/* ── Section 2: Object Editor ───────────────────────── */}
      <div style={editorSectionStyle}>
        <div style={{
          ...sectionHeaderStyle,
          color: dk ? '#9ca3af' : '#6b7280',
          borderBottomColor: dk ? '#2d2f34' : '#f3f4f6',
        }}>Editor</div>
        <div style={sectionBodyStyle}>
          {drawingMode && (
            <OrientationToggle
              rackOrientation={rackOrientation}
              onToggleOrientation={onToggleOrientation}
              darkMode={dk}
            />
          )}
          <TransformPanel
            layoutStore={layoutStore}
            layoutVersion={layoutVersion}
            darkMode={dk}
          />
          {wallMode && (
            <WallThicknessControl
              wallStore={wallStore}
              wallStoreVersion={wallStoreVersion}
              darkMode={dk}
            />
          )}
          {columnMode && (
            <ColumnDimensionControl
              columnStore={columnStore}
              columnStoreVersion={columnStoreVersion}
              darkMode={dk}
            />
          )}
          <ColumnEntityEditor
            layoutStore={layoutStore}
            layoutVersion={layoutVersion}
            darkMode={dk}
          />
        </div>
      </div>

      {children}
    </aside>
  );
}

// ── TransformPanel ──────────────────────────────────────────────
function TransformPanel({ layoutStore, layoutVersion, darkMode }) {
  const dk = darkMode;

  const selCount   = layoutStore ? layoutStore.selectionCount() : 0;
  const selected   = layoutStore ? layoutStore.getSelectedEntities() : [];
  const singleEnt  = selCount === 1 ? selected[0] : null;
  const multiSel   = selCount > 1;
  const noSel      = selCount === 0;

  // Local edit state for the inputs (string while typing)
  const [xVal, setXVal] = useState('');
  const [yVal, setYVal] = useState('');

  // Sync input values when selection or entity transform changes
  useEffect(() => {
    if (singleEnt) {
      setXVal(fmt(singleEnt.transform.x));
      setYVal(fmt(singleEnt.transform.y));
    } else {
      setXVal('');
      setYVal('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singleEnt?.id, singleEnt?.transform.x, singleEnt?.transform.y, layoutVersion]);

  const commitX = useCallback(() => {
    if (!singleEnt || !layoutStore) return;
    const num = parseFloat(xVal);
    if (!isNaN(num)) {
      layoutStore.moveTo(singleEnt.id, num, singleEnt.transform.y);
    } else {
      setXVal(fmt(singleEnt.transform.x));
    }
  }, [singleEnt, layoutStore, xVal]);

  const commitY = useCallback(() => {
    if (!singleEnt || !layoutStore) return;
    const num = parseFloat(yVal);
    if (!isNaN(num)) {
      layoutStore.moveTo(singleEnt.id, singleEnt.transform.x, num);
    } else {
      setYVal(fmt(singleEnt.transform.y));
    }
  }, [singleEnt, layoutStore, yVal]);

  const onXKeyDown = (e) => { if (e.key === 'Enter') { commitX(); e.target.blur(); } };
  const onYKeyDown = (e) => { if (e.key === 'Enter') { commitY(); e.target.blur(); } };

  const textMuted = dk ? '#6b7280' : '#9ca3af';
  const textMain  = dk ? '#e5e7eb' : '#111827';
  const border    = dk ? '#374151' : '#e5e7eb';
  const inputBg   = dk ? '#2d2f34' : '#f9fafb';
  const disabledBg = dk ? '#1e1f22' : '#f3f4f6';
  const disabledTx = dk ? '#4b5563' : '#9ca3af';

  if (noSel) {
    return (
      <div style={{ color: textMuted, fontSize: 12, padding: '4px 0' }}>
        No selection
      </div>
    );
  }

  const disabled = multiSel;

  return (
    <div>
      {/* Section label */}
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: textMuted,
        marginBottom: 8,
      }}>
        Transform
      </div>

      {/* X / Y row */}
      <div style={{ display: 'flex', gap: 8 }}>
        <CoordInput
          label="X"
          value={disabled ? '—' : xVal}
          disabled={disabled}
          onChange={setXVal}
          onBlur={commitX}
          onKeyDown={onXKeyDown}
          inputBg={disabled ? disabledBg : inputBg}
          inputColor={disabled ? disabledTx : textMain}
          border={border}
          labelColor={textMuted}
        />
        <CoordInput
          label="Y"
          value={disabled ? '—' : yVal}
          disabled={disabled}
          onChange={setYVal}
          onBlur={commitY}
          onKeyDown={onYKeyDown}
          inputBg={disabled ? disabledBg : inputBg}
          inputColor={disabled ? disabledTx : textMain}
          border={border}
          labelColor={textMuted}
        />
      </div>

      {disabled && (
        <div style={{ fontSize: 11, color: textMuted, marginTop: 8 }}>
          Multiple objects selected — transform editing disabled
        </div>
      )}
    </div>
  );
}

function CoordInput({
  label,
  value,
  disabled,
  onChange,
  onBlur,
  onKeyDown,
  inputBg,
  inputColor,
  border,
  labelColor,
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: labelColor,
        userSelect: 'none',
      }}>
        {label}
      </label>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        border: `1px solid ${border}`,
        borderRadius: 6,
        overflow: 'hidden',
        background: inputBg,
      }}>
        <input
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: inputColor,
            fontSize: 12,
            fontFamily: 'monospace',
            fontWeight: 500,
            padding: '5px 8px',
            width: 0,
            cursor: disabled ? 'default' : 'text',
          }}
        />
        <span style={{
          fontSize: 10,
          color: labelColor,
          paddingRight: 6,
          userSelect: 'none',
          flexShrink: 0,
        }}>m</span>
      </div>
    </div>
  );
}

/** Format a world-space value (meters) for display */
function fmt(v) {
  return Number(v.toFixed(4)).toString();
}

// ── styles ─────────────────────────────────────────────────────
const panelStyle = {
  width: PANEL_WIDTH,
  minWidth: PANEL_WIDTH,
  height: '100vh',
  background: '#ffffff',
  borderRight: '1px solid #e5e7eb',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  zIndex: 20,
};

const pickerSectionStyle = {
  flex: '0 0 45%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const editorSectionStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const sectionHeaderStyle = {
  padding: '10px 14px',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#6b7280',
  borderBottom: '1px solid #f3f4f6',
  userSelect: 'none',
};

const sectionBodyStyle = {
  flex: 1,
  overflow: 'auto',
  padding: 12,
};

const dividerStyle = {
  height: 1,
  background: '#e5e7eb',
  flexShrink: 0,
};

const rackBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  background: '#ffffff',
  fontSize: 13,
  fontWeight: 500,
  color: '#374151',
  cursor: 'pointer',
  transition: 'all 0.15s',
  userSelect: 'none',
};

const wallBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flex: 1,
  padding: '7px 8px',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  background: '#ffffff',
  fontSize: 12,
  fontWeight: 500,
  color: '#374151',
  cursor: 'pointer',
  transition: 'all 0.15s',
  userSelect: 'none',
};

// ── OrientationToggle ──────────────────────────────────────────
function OrientationToggle({ rackOrientation, onToggleOrientation, darkMode }) {
  const dk = darkMode;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: dk ? '#6b7280' : '#9ca3af',
        marginBottom: 5,
        userSelect: 'none',
      }}>
        Orientation
      </div>
      <div style={{
        display: 'flex',
        border: `1px solid ${dk ? '#4b5563' : '#e5e7eb'}`,
        borderRadius: 7,
        overflow: 'hidden',
      }}>
        {['horizontal', 'vertical'].map((opt) => {
          const active = rackOrientation === opt;
          return (
            <button
              key={opt}
              onClick={() => { if (!active) onToggleOrientation(); }}
              title={opt === 'horizontal' ? 'Bays extend left–right' : 'Bays extend top–bottom'}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                padding: '5px 6px',
                border: 'none',
                borderRight: opt === 'horizontal' ? `1px solid ${dk ? '#4b5563' : '#e5e7eb'}` : 'none',
                background: active
                  ? (dk ? '#1e3a5f' : '#eff6ff')
                  : (dk ? '#2d2f34' : '#ffffff'),
                color: active
                  ? (dk ? '#93c5fd' : '#1d4ed8')
                  : (dk ? '#9ca3af' : '#6b7280'),
                cursor: active ? 'default' : 'pointer',
                fontSize: 11,
                fontWeight: active ? 600 : 400,
                transition: 'all 0.12s',
                userSelect: 'none',
              }}
            >
              {opt === 'horizontal'
                ? <HorizontalRackIcon size={16} />
                : <VerticalRackIcon size={16} />
              }
              {opt === 'horizontal' ? 'H' : 'V'}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Orientation icons ──────────────────────────────────────────
function HorizontalRackIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="4" width="14" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <line x1="1" y1="7" x2="15" y2="7" stroke="currentColor" strokeWidth="1" />
      <line x1="1" y1="10" x2="15" y2="10" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function VerticalRackIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="4" y="1" width="8" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <line x1="7" y1="1" x2="7" y2="15" stroke="currentColor" strokeWidth="1" />
      <line x1="10" y1="1" x2="10" y2="15" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

const badgeStyle = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '0.05em',
  color: '#ffffff',
  background: '#3b82f6',
  borderRadius: 4,
  padding: '1px 5px',
};

// ── Wall icons ─────────────────────────────────────────────────
function WallRectIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function WallLineIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ── WallThicknessControl ───────────────────────────────────────
function WallThicknessControl({ wallStore, wallStoreVersion, darkMode }) {
  const dk = darkMode;
  const current = wallStore ? wallStore.getDefaultThickness() : 0.2;
  const [localVal, setLocalVal] = useState(String(current));

  useEffect(() => {
    if (wallStore) setLocalVal(String(wallStore.getDefaultThickness()));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallStoreVersion, wallStore]);

  const commit = useCallback(() => {
    if (!wallStore) return;
    const num = parseFloat(localVal);
    if (!isNaN(num) && num > 0 && num <= 5) {
      wallStore.setDefaultThickness(num);
    } else {
      setLocalVal(String(wallStore.getDefaultThickness()));
    }
  }, [wallStore, localVal]);

  const textMuted = dk ? '#6b7280' : '#9ca3af';
  const inputBg   = dk ? '#2d2f34' : '#f9fafb';
  const inputColor = dk ? '#e5e7eb' : '#111827';
  const border    = dk ? '#374151' : '#e5e7eb';

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: textMuted,
        marginBottom: 4,
        userSelect: 'none',
      }}>
        Thickness
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        border: `1px solid ${border}`,
        borderRadius: 6,
        overflow: 'hidden',
        background: inputBg,
        maxWidth: 140,
      }}>
        <input
          type="number"
          step="0.05"
          min="0.05"
          max="5"
          value={localVal}
          onChange={(e) => setLocalVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') { commit(); e.target.blur(); } }}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: inputColor,
            fontSize: 12,
            fontFamily: 'monospace',
            fontWeight: 500,
            padding: '5px 8px',
            width: 0,
          }}
        />
        <span style={{
          fontSize: 10,
          color: textMuted,
          paddingRight: 8,
          userSelect: 'none',
          flexShrink: 0,
        }}>m</span>
      </div>
    </div>
  );
}

// ── ColumnIcon ─────────────────────────────────────────────────
function ColumnIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="3" y="3" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <line x1="3" y1="3"  x2="13" y2="13" stroke="currentColor" strokeWidth="1" />
      <line x1="13" y1="3" x2="3"  y2="13" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

// ── ColumnDimensionControl ─────────────────────────────────────
// Shown when column placement mode is active — set default width/depth
// for newly placed columns.
function ColumnDimensionControl({ columnStore, columnStoreVersion, darkMode }) {
  const dk = darkMode;
  const currentW = columnStore ? columnStore.getDefaultWidth() : 0.4;
  const currentD = columnStore ? columnStore.getDefaultDepth() : 0.4;
  const [wVal, setWVal] = useState(String(currentW));
  const [dVal, setDVal] = useState(String(currentD));

  useEffect(() => {
    if (columnStore) {
      setWVal(String(columnStore.getDefaultWidth()));
      setDVal(String(columnStore.getDefaultDepth()));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnStoreVersion, columnStore]);

  const commitW = useCallback(() => {
    if (!columnStore) return;
    const num = parseFloat(wVal);
    if (!isNaN(num) && num > 0 && num <= 5) {
      columnStore.setDefaultWidth(num);
    } else {
      setWVal(String(columnStore.getDefaultWidth()));
    }
  }, [columnStore, wVal]);

  const commitD = useCallback(() => {
    if (!columnStore) return;
    const num = parseFloat(dVal);
    if (!isNaN(num) && num > 0 && num <= 5) {
      columnStore.setDefaultDepth(num);
    } else {
      setDVal(String(columnStore.getDefaultDepth()));
    }
  }, [columnStore, dVal]);

  const textMuted  = dk ? '#6b7280' : '#9ca3af';
  const inputBg    = dk ? '#2d2f34' : '#f9fafb';
  const inputColor = dk ? '#e5e7eb' : '#111827';
  const border     = dk ? '#374151' : '#e5e7eb';

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: textMuted,
        marginBottom: 4,
        userSelect: 'none',
      }}>
        Default Column Size
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <DimInput label="W" value={wVal} onChange={setWVal} onBlur={commitW}
          inputBg={inputBg} inputColor={inputColor} border={border} labelColor={textMuted} />
        <DimInput label="D" value={dVal} onChange={setDVal} onBlur={commitD}
          inputBg={inputBg} inputColor={inputColor} border={border} labelColor={textMuted} />
      </div>
    </div>
  );
}

// ── ColumnEntityEditor ─────────────────────────────────────────
// Shown when a COLUMN entity is selected — allows editing width/depth
// of the placed column.
function ColumnEntityEditor({ layoutStore, layoutVersion, darkMode }) {
  const dk = darkMode;

  const selCount  = layoutStore ? layoutStore.selectionCount() : 0;
  const selected  = layoutStore ? layoutStore.getSelectedEntities() : [];
  const singleEnt = selCount === 1 ? selected[0] : null;
  const isColumn  = singleEnt?.type === 'COLUMN';

  const [wVal, setWVal] = useState('');
  const [dVal, setDVal] = useState('');

  useEffect(() => {
    if (isColumn) {
      setWVal(fmt(singleEnt.widthM));
      setDVal(fmt(singleEnt.depthM));
    } else {
      setWVal('');
      setDVal('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isColumn, singleEnt?.id, singleEnt?.widthM, singleEnt?.depthM, layoutVersion]);

  const commitW = useCallback(() => {
    if (!isColumn || !layoutStore) return;
    const num = parseFloat(wVal);
    if (!isNaN(num) && num > 0 && num <= 5) {
      layoutStore.update(singleEnt.id, { widthM: num });
    } else {
      setWVal(fmt(singleEnt.widthM));
    }
  }, [isColumn, layoutStore, singleEnt, wVal]);

  const commitD = useCallback(() => {
    if (!isColumn || !layoutStore) return;
    const num = parseFloat(dVal);
    if (!isNaN(num) && num > 0 && num <= 5) {
      layoutStore.update(singleEnt.id, { depthM: num });
    } else {
      setDVal(fmt(singleEnt.depthM));
    }
  }, [isColumn, layoutStore, singleEnt, dVal]);

  if (!isColumn) return null;

  const textMuted  = dk ? '#6b7280' : '#9ca3af';
  const inputBg    = dk ? '#2d2f34' : '#f9fafb';
  const inputColor = dk ? '#e5e7eb' : '#111827';
  const border     = dk ? '#374151' : '#e5e7eb';

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: textMuted,
        marginBottom: 8,
      }}>
        Column Size
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <DimInput label="Width" value={wVal} onChange={setWVal} onBlur={commitW}
          inputBg={inputBg} inputColor={inputColor} border={border} labelColor={textMuted} />
        <DimInput label="Depth" value={dVal} onChange={setDVal} onBlur={commitD}
          inputBg={inputBg} inputColor={inputColor} border={border} labelColor={textMuted} />
      </div>
    </div>
  );
}

// ── Shared dimension input ─────────────────────────────────────
function DimInput({ label, value, onChange, onBlur, inputBg, inputColor, border, labelColor }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: labelColor,
        userSelect: 'none',
      }}>{label}</label>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        border: `1px solid ${border}`,
        borderRadius: 6,
        overflow: 'hidden',
        background: inputBg,
      }}>
        <input
          type="number"
          step="0.05"
          min="0.05"
          max="5"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') { onBlur(); e.target.blur(); } }}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: inputColor,
            fontSize: 12,
            fontFamily: 'monospace',
            fontWeight: 500,
            padding: '5px 8px',
            width: 0,
          }}
        />
        <span style={{
          fontSize: 10,
          color: labelColor,
          paddingRight: 6,
          userSelect: 'none',
          flexShrink: 0,
        }}>m</span>
      </div>
    </div>
  );
}
