'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Pencil, ClipboardList, Settings, FileDown, FileUp } from 'lucide-react';
import RackModuleEditor from './rack/RackModuleEditor.js';
import {
  BEAMS_PER_LEVEL,
  SAFETY_PINS_PER_BEAM,
  ANCHORS_PER_FRAME,
  BasePlateType,
} from '../services/rack/constants.js';

/**
 * EditorPanel – left sidebar with two sections:
 *   1. Object Picker  – top, scrollable list of objects the user can place
 *   2. Object Editor  – bottom, properties/settings for the selected object
 */
export const PANEL_WIDTH = 320; // px – fixed width

export default function EditorPanel({
  drawingMode,
  darkMode = false,
  layoutStore,
  layoutVersion,
  rackOrientation = 'horizontal',
  onToggleOrientation,
  wallMode = null,
  wallStore = null,
  wallStoreVersion,
  columnMode = false,
  columnStore = null,
  columnStoreVersion,
  rackDomainRef,
  subSelActive = false,
  onExportProjectDocument,
  onImportProjectDocument,
  children,
}) {
  const dk = darkMode;
  const [activeView, setActiveView] = useState('edition');

  const VIEW_MODES = [
    { key: 'edition',       label: 'Edition',     Icon: Pencil },
    { key: 'bom',           label: 'BOM & Stats',  Icon: ClipboardList },
    { key: 'configuration', label: 'Config',        Icon: Settings },
  ];

  return (
    <aside style={{
      ...panelStyle,
      background: dk ? '#1e1f22' : '#ffffff',
      borderRightColor: dk ? '#374151' : '#e5e7eb',
    }}>
      {/* ── View-mode selector ───────────────────────────────── */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: `1px solid ${dk ? '#374151' : '#e5e7eb'}`,
        flexShrink: 0,
        background: dk ? '#18191c' : '#f9fafb',
      }}>
        {VIEW_MODES.map(({ key, label, Icon }) => {
          const isActive = activeView === key;
          return (
            <button
              key={key}
              onClick={() => setActiveView(key)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '8px 4px',
                border: 'none',
                borderBottom: isActive
                  ? '2px solid #3b82f6'
                  : '2px solid transparent',
                background: 'transparent',
                color: isActive
                  ? (dk ? '#93c5fd' : '#1d4ed8')
                  : (dk ? '#6b7280' : '#9ca3af'),
                fontSize: 11,
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
                userSelect: 'none',
              }}
              title={label}
            >
              <Icon size={14} strokeWidth={isActive ? 2.2 : 1.8} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Edition view ─────────────────────────────────────── */}
      {activeView === 'edition' && (<>
      {/* ── Section: Object Editor ───────────────────────────── */}
      <div style={editorSectionStyle}>
        {subSelActive && (
          <div style={{
            margin: '8px 10px 0',
            padding: '7px 10px',
            borderRadius: 6,
            background: dk ? 'rgba(127,29,29,0.5)' : 'rgba(254,226,226,0.9)',
            border: `1px solid ${dk ? '#f87171' : '#fca5a5'}`,
            color: dk ? '#fca5a5' : '#991b1b',
            fontSize: 11,
            fontWeight: 500,
            lineHeight: 1.4,
          }}>
            Bay sub-selected — use the canvas toolbar to delete it.
          </div>
        )}
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
          <RackModuleEditor
            layoutStore={layoutStore}
            layoutVersion={layoutVersion}
            rackDomainRef={rackDomainRef}
            darkMode={dk}
          />
        </div>
      </div>

      {children}
      </>)}

      {/* ── BOM & Stats view ─────────────────────────────────── */}
      {activeView === 'bom' && (
        <BOMView
          layoutStore={layoutStore}
          layoutVersion={layoutVersion}
          rackDomainRef={rackDomainRef}
          darkMode={dk}
          onExportProjectDocument={onExportProjectDocument}
          onImportProjectDocument={onImportProjectDocument}
        />
      )}

      {/* ── Configuration view ───────────────────────────────── */}
      {activeView === 'configuration' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{
            ...sectionHeaderStyle,
            color: dk ? '#9ca3af' : '#6b7280',
            borderBottomColor: dk ? '#2d2f34' : '#f3f4f6',
          }}>Configuration</div>
          <div style={{ ...sectionBodyStyle, color: dk ? '#9ca3af' : '#6b7280', fontSize: 13 }}>
            <p style={{ margin: 0 }}>Project configuration and settings will appear here.</p>
          </div>
        </div>
      )}
    </aside>
  );
}

// ── BOMView ─────────────────────────────────────────────────────
const MAX_NAME_LEN = 28;

function BOMView({
  layoutStore,
  layoutVersion,
  rackDomainRef,
  darkMode,
  onExportProjectDocument,
  onImportProjectDocument,
}) {
  const dk = darkMode;

  const bomItems = useMemo(() => {
    if (!layoutStore || !rackDomainRef?.current) return [];

    const domainMap = rackDomainRef.current;
    const entities = layoutStore.getAll().filter(
      (e) => e.type === 'RACK_MODULE' || e.type === 'RACK_LINE',
    );

    // Aggregate items by SKU
    const merged = new Map();

    const addItem = (sku, name, qty, category) => {
      const existing = merged.get(sku);
      if (existing) {
        existing.quantity += qty;
      } else {
        merged.set(sku, { sku, name, quantity: qty, category });
      }
    };

    for (const ent of entities) {
      const mod = domainMap.get(ent.domainId);
      if (!mod) continue;

      // Frames
      const frameSpec = mod.frameSpec;
      const frameCount = mod.frameCount || (mod.bays.length + 1);
      addItem(
        frameSpec.id,
        `Frame ${frameSpec.heightIn}" × ${frameSpec.depthIn}" (${frameSpec.uprightSeries})`,
        frameCount,
        'Frame',
      );

      // Beams
      for (const bay of mod.bays) {
        for (const level of bay.levels) {
          const bs = level.beamSpec;
          addItem(
            bs.id,
            `Beam ${bs.lengthIn}" (${bs.beamSeries})`,
            BEAMS_PER_LEVEL,
            'Beam',
          );
        }
      }

      // Safety Pins
      let totalBeams = 0;
      for (const bay of mod.bays) {
        totalBeams += bay.levels.length * BEAMS_PER_LEVEL;
      }
      const pinCount = totalBeams * SAFETY_PINS_PER_BEAM;
      if (pinCount > 0) {
        addItem('ACC-SAFETY-PIN', 'Safety Pin', pinCount, 'Accessory');
      }

      // Anchors
      const bpType = frameSpec.basePlateType || BasePlateType.STANDARD;
      const anchorsPerFrame = ANCHORS_PER_FRAME[bpType] || 2;
      addItem(
        `ACC-ANCHOR-${bpType}`,
        `Anchor (${bpType.charAt(0) + bpType.slice(1).toLowerCase()})`,
        frameCount * anchorsPerFrame,
        'Accessory',
      );
    }

    // Sort: Frames first, then Beams, then Accessories
    const order = { Frame: 0, Beam: 1, Accessory: 2 };
    return [...merged.values()].sort(
      (a, b) => (order[a.category] ?? 9) - (order[b.category] ?? 9),
    );
  }, [layoutStore, layoutVersion, rackDomainRef]);

  const textColor   = dk ? '#e5e7eb' : '#1f2937';
  const textMuted   = dk ? '#6b7280' : '#9ca3af';
  const headerBg    = dk ? '#18191c' : '#f9fafb';
  const borderColor = dk ? '#2d2f34' : '#f3f4f6';
  const rowHoverBg  = dk ? '#25272b' : '#f9fafb';
  const buttonBg    = dk ? '#1f2937' : '#f3f4f6';
  const buttonHover = dk ? '#374151' : '#e5e7eb';
  const tagBg       = {
    Frame:     dk ? '#1e3a5f' : '#dbeafe',
    Beam:      dk ? '#1a3a2a' : '#d1fae5',
    Accessory: dk ? '#3b2f1e' : '#fef3c7',
  };
  const tagColor = {
    Frame:     dk ? '#93c5fd' : '#1e40af',
    Beam:      dk ? '#6ee7b7' : '#065f46',
    Accessory: dk ? '#fcd34d' : '#92400e',
  };

  const cropName = (name) =>
    name.length > MAX_NAME_LEN ? name.slice(0, MAX_NAME_LEN - 1) + '…' : name;

  // Group items by category for section rendering
  const grouped = useMemo(() => {
    const groups = new Map();
    for (const item of bomItems) {
      if (!groups.has(item.category)) groups.set(item.category, []);
      groups.get(item.category).push(item);
    }
    return groups;
  }, [bomItems]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        ...sectionHeaderStyle,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        color: dk ? '#9ca3af' : '#6b7280',
        borderBottomColor: borderColor,
      }}>
        <span>Bill of Materials</span>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={onImportProjectDocument}
            disabled={typeof onImportProjectDocument !== 'function'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              border: `1px solid ${borderColor}`,
              borderRadius: 6,
              background: buttonBg,
              color: textColor,
              cursor: typeof onImportProjectDocument === 'function' ? 'pointer' : 'default',
              fontSize: 11,
              fontWeight: 600,
              padding: '5px 8px',
              opacity: typeof onImportProjectDocument === 'function' ? 1 : 0.55,
              transition: 'background 0.12s ease',
            }}
            onMouseEnter={(e) => {
              if (typeof onImportProjectDocument === 'function') {
                e.currentTarget.style.background = buttonHover;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = buttonBg;
            }}
            title="Import project document"
          >
            <FileUp size={14} />
            Import
          </button>
          <button
            onClick={onExportProjectDocument}
            disabled={typeof onExportProjectDocument !== 'function'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              border: `1px solid ${borderColor}`,
              borderRadius: 6,
              background: buttonBg,
              color: textColor,
              cursor: typeof onExportProjectDocument === 'function' ? 'pointer' : 'default',
              fontSize: 11,
              fontWeight: 600,
              padding: '5px 8px',
              opacity: typeof onExportProjectDocument === 'function' ? 1 : 0.55,
              transition: 'background 0.12s ease',
            }}
            onMouseEnter={(e) => {
              if (typeof onExportProjectDocument === 'function') {
                e.currentTarget.style.background = buttonHover;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = buttonBg;
            }}
            title="Export project document"
          >
            <FileDown size={14} />
            Export
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
        {bomItems.length === 0 ? (
          <div style={{
            padding: 20,
            textAlign: 'center',
            color: textMuted,
            fontSize: 13,
          }}>
            No rack modules placed yet.
            <br />
            <span style={{ fontSize: 11 }}>Place racks on the canvas to see the BOM.</span>
          </div>
        ) : (
          <>
            {/* Total count badge */}
            <div style={{
              padding: '8px 12px',
              borderBottom: `1px solid ${borderColor}`,
              background: headerBg,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: 11, color: textMuted, fontWeight: 500 }}>
                {bomItems.reduce((sum, i) => sum + i.quantity, 0)} total items
              </span>
              <span style={{ fontSize: 11, color: textMuted }}>
                {bomItems.length} line{bomItems.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Grouped sections */}
            {['Frame', 'Beam', 'Accessory'].map((cat) => {
              const items = grouped.get(cat);
              if (!items || items.length === 0) return null;
              return (
                <div key={cat}>
                  {/* Category header */}
                  <div style={{
                    padding: '6px 12px',
                    background: headerBg,
                    borderBottom: `1px solid ${borderColor}`,
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: textMuted,
                    userSelect: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    <span style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: tagBg[cat],
                      border: `1px solid ${tagColor[cat]}`,
                      flexShrink: 0,
                    }} />
                    {cat}s
                  </div>

                  {/* Items */}
                  {items.map((item) => (
                    <div
                      key={item.sku}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '7px 12px',
                        borderBottom: `1px solid ${borderColor}`,
                        fontSize: 12,
                        color: textColor,
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = rowHoverBg; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* Tag */}
                      <span style={{
                        flexShrink: 0,
                        padding: '1px 5px',
                        borderRadius: 4,
                        fontSize: 9,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        background: tagBg[item.category],
                        color: tagColor[item.category],
                        userSelect: 'none',
                      }}>
                        {item.category === 'Accessory' ? 'ACC' : item.category.slice(0, 3).toUpperCase()}
                      </span>

                      {/* Name + attributes */}
                      <span style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontWeight: 500,
                        fontSize: 12,
                      }} title={item.name}>
                        {cropName(item.name)}
                      </span>

                      {/* Quantity */}
                      <span style={{
                        flexShrink: 0,
                        fontWeight: 600,
                        fontFamily: 'monospace',
                        fontSize: 12,
                        minWidth: 28,
                        textAlign: 'right',
                        color: dk ? '#e5e7eb' : '#111827',
                      }}>
                        ×{item.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
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
        Position
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
