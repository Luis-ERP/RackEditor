'use client';

/**
 * DrawingToolbar – Figma-style floating toolbar for canvas drawing tools.
 *
 * Rendered at the bottom-centre of the canvas. Only one tool can be active
 * at a time; pressing ESC (handled in page.js) deactivates everything.
 */

import { MousePointer2 } from 'lucide-react';
import { RackIcon, WallRectIcon, WallLineIcon, ColumnIcon, NoteIcon } from './icons/ToolIcons';

// ── tool definitions ───────────────────────────────────────────
const TOOLS = [
  { id: 'select',   label: 'Select',             Icon: MousePointer2 },
  'divider',
  { id: 'rack',     label: 'Rack',               Icon: RackIcon },
  'divider',
  { id: 'wallRect', label: 'Wall — Rectangle',   Icon: WallRectIcon },
  { id: 'wallLine', label: 'Wall — Line',         Icon: WallLineIcon },
  'divider',
  { id: 'column',   label: 'Column',             Icon: ColumnIcon },
  'divider',
  { id: 'note',     label: 'Note',               Icon: NoteIcon },
];

// ────────────────────────────────────────────────────────────────
export default function DrawingToolbar({
  drawingMode,
  onToggleDrawingMode,
  wallMode,
  onSetWallMode,
  columnMode,
  onToggleColumnMode,
  noteMode = false,
  onToggleNoteMode,
  darkMode = false,
  disabled = false,
}) {
  const dk = darkMode;

  // derive the active tool id
  const activeTool = drawingMode
    ? 'rack'
    : wallMode === 'rect'
      ? 'wallRect'
      : wallMode === 'line'
        ? 'wallLine'
        : columnMode
          ? 'column'
          : noteMode
            ? 'note'
            : 'select';

  const handleClick = (tool) => {
    if (disabled) return;

    if (tool === 'select') {
      // deactivate whichever tool is active
      if (drawingMode) onToggleDrawingMode();
      else if (wallMode) onSetWallMode(wallMode); // same mode → toggles off
      else if (columnMode) onToggleColumnMode();
      else if (noteMode) onToggleNoteMode();
      return;
    }

    // Other tools: the page-level toggles already handle mutual exclusion
    switch (tool) {
      case 'rack':     onToggleDrawingMode(); break;
      case 'wallRect': onSetWallMode('rect'); break;
      case 'wallLine': onSetWallMode('line'); break;
      case 'column':   onToggleColumnMode();  break;
      case 'note':     onToggleNoteMode();    break;
    }
  };

  // ── palette colours ──────────────────────────────────────────
  const bg          = dk ? 'rgba(30,31,34,0.95)' : 'rgba(255,255,255,0.95)';
  const borderColor = dk ? '#374151' : '#e5e7eb';
  const textColor   = dk ? '#d1d5db' : '#4b5563';
  const activeBg    = dk ? '#1e3a5f' : '#eff6ff';
  const activeColor = dk ? '#93c5fd' : '#1d4ed8';
  const dividerBg   = dk ? '#374151' : '#e5e7eb';
  const shadow      = dk
    ? '0 4px 16px rgba(0,0,0,0.45)'
    : '0 4px 16px rgba(0,0,0,0.10)';

  return (
    <div
      style={{
        ...barStyle,
        background: bg,
        borderColor,
        boxShadow: shadow,
        ...(disabled ? { opacity: 0.45, pointerEvents: 'none' } : {}),
      }}
    >
      {TOOLS.map((entry, i) => {
        if (entry === 'divider') {
          return (
            <div
              key={`d${i}`}
              style={{ ...dividerStyle, background: dividerBg }}
            />
          );
        }

        const { id, label, Icon } = entry;
        const isActive = activeTool === id;

        return (
          <button
            key={id}
            onClick={() => handleClick(id)}
            title={label}
            style={{
              ...toolBtnStyle,
              background: isActive ? activeBg : 'transparent',
              color: isActive ? activeColor : textColor,
              boxShadow: isActive ? `0 0 0 1.5px ${activeColor}40` : 'none',
            }}
          >
            <Icon size={16} />
          </button>
        );
      })}
    </div>
  );
}

// ── inline styles ──────────────────────────────────────────────
const barStyle = {
  position: 'absolute',
  bottom: 16,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  backdropFilter: 'blur(6px)',
  border: '1px solid',
  borderRadius: 8,
  padding: '4px 4px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  zIndex: 10,
  pointerEvents: 'auto',
  userSelect: 'none',
};

const toolBtnStyle = {
  display: 'grid',
  placeItems: 'center',
  width: 28,
  height: 28,
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  transition: 'background 0.1s, color 0.1s',
};

const dividerStyle = {
  width: 1,
  height: 16,
  margin: '0 2px',
  flexShrink: 0,
};
