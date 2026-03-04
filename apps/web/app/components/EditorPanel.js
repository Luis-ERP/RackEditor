'use client';

/**
 * EditorPanel – left sidebar with two sections:
 *   1. Object Picker  – top, scrollable list of objects the user can place
 *   2. Object Editor  – bottom, properties/settings for the selected object
 *
 * Neither section has content yet; they're empty placeholders
 * ready to receive child components.
 */
export const PANEL_WIDTH = 320; // px – fixed width

export default function EditorPanel({ drawingMode, onToggleDrawingMode, darkMode = false, children }) {
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
          {/* object editor content will go here */}
        </div>
      </div>

      {children}
    </aside>
  );
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

const rackBtnActiveStyle = {
  background: '#eff6ff',
  borderColor: '#3b82f6',
  color: '#1d4ed8',
  boxShadow: '0 0 0 2px rgba(59,130,246,0.2)',
};

const badgeStyle = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '0.05em',
  color: '#ffffff',
  background: '#3b82f6',
  borderRadius: 4,
  padding: '1px 5px',
};
