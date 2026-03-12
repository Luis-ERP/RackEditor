import {
  ZoomIn,
  ZoomOut,
  Maximize,
  XCircle,
  Trash2,
  Copy,
  Moon,
  Sun,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import DrawingToolbar from '../DrawingToolbar';
import {
  actionsBarStyle,
  actionBtnStyle,
  actionDividerStyle,
  btnStyle,
  coordHudStyle,
  dividerStyle,
  drawBannerStyle,
  toolbarStyle,
  toolbarWrapperStyle,
  zoomLabelStyle,
} from './styles';

export function CanvasActionsBar({
  subSel,
  hasSelection,
  theme,
  clearSubSel,
  handleDeleteSubSelected,
  handleDeselect,
  handleMoveUp,
  handleMoveDown,
  handleMoveLeft,
  handleMoveRight,
  handleDuplicateSelected,
  handleDeleteSelected,
}) {
  return (
    <div style={{ ...actionsBarStyle, background: theme.overlayBg, borderColor: theme.overlayBorder }}>
      {subSel ? (
        <>
          <button
            onClick={clearSubSel}
            style={{ ...actionBtnStyle, color: theme.overlayText }}
            title="Clear bay sub-selection (Esc)"
          >
            <XCircle size={16} />
          </button>
          <div style={{ ...actionDividerStyle, background: theme.overlayBorder }} />
          <button
            onClick={handleDeleteSubSelected}
            style={{ ...actionBtnStyle, color: theme.overlayAccent }}
            title="Delete this bay"
          >
            <Trash2 size={16} />
          </button>
        </>
      ) : (
        <>
          <button
            onClick={handleDeselect}
            style={{ ...actionBtnStyle, color: theme.overlayText }}
            title="Deselect all (Esc)"
          >
            <XCircle size={16} />
          </button>
          {hasSelection && (
            <>
              <div style={{ ...actionDividerStyle, background: theme.overlayBorder }} />
              <button onClick={handleMoveUp} style={{ ...actionBtnStyle, color: theme.overlayText }} title="Move up one grid unit"><ArrowUp size={16} /></button>
              <button onClick={handleMoveDown} style={{ ...actionBtnStyle, color: theme.overlayText }} title="Move down one grid unit"><ArrowDown size={16} /></button>
              <button onClick={handleMoveLeft} style={{ ...actionBtnStyle, color: theme.overlayText }} title="Move left one grid unit"><ArrowLeft size={16} /></button>
              <button onClick={handleMoveRight} style={{ ...actionBtnStyle, color: theme.overlayText }} title="Move right one grid unit"><ArrowRight size={16} /></button>
              <div style={{ ...actionDividerStyle, background: theme.overlayBorder }} />
              <button onClick={handleDuplicateSelected} style={{ ...actionBtnStyle, color: theme.overlayText }} title="Duplicate selected (⌘D / Ctrl+D)"><Copy size={16} /></button>
              <button onClick={handleDeleteSelected} style={{ ...actionBtnStyle, color: theme.overlayAccent }} title="Delete selected"><Trash2 size={16} /></button>
            </>
          )}
        </>
      )}
    </div>
  );
}

export function CanvasModeBanners({ drawingMode, wallMode, columnMode, subSel, darkMode, theme }) {
  return (
    <>
      {drawingMode && (
        <div style={{ ...drawBannerStyle, background: theme.overlayBanner.bg, borderColor: theme.overlayBanner.border, color: theme.overlayBanner.color }}>
          Drawing: Rack — click &amp; drag to place · Esc to cancel
        </div>
      )}
      {wallMode && (
        <div style={{ ...drawBannerStyle, background: theme.overlayBanner.bg, borderColor: theme.overlayBanner.border, color: theme.overlayBanner.color }}>
          Drawing: Wall ({wallMode === 'rect' ? 'Rectangle' : 'Line'}) — click &amp; drag to draw · Esc to cancel
        </div>
      )}
      {columnMode && (
        <div style={{ ...drawBannerStyle, background: theme.overlayBanner.bg, borderColor: theme.overlayBanner.border, color: theme.overlayBanner.color }}>
          Placing: Column — click to place · Esc to cancel
        </div>
      )}
      {subSel && (
        <div
          style={{
            ...drawBannerStyle,
            background: darkMode ? 'rgba(127,29,29,0.88)' : 'rgba(254,226,226,0.92)',
            borderColor: '#f87171',
            color: darkMode ? '#fca5a5' : '#991b1b',
          }}
        >
          Bay {subSel.bayIndex + 1} of {subSel.bayCount} selected — Delete to remove · Esc to cancel
        </div>
      )}
    </>
  );
}

export function CanvasHUDs({
  cursorCoord,
  zoomPercent,
  darkMode,
  theme,
  onToggleDarkMode,
  onZoomIn,
  onZoomOut,
  onFitView,
}) {
  return (
    <>
      <div style={{ ...coordHudStyle, background: theme.overlayBg, borderColor: theme.overlayBorder, color: theme.overlayText }}>
        <span>X&nbsp;{cursorCoord.x}</span>
        <span style={{ color: theme.overlayMuted }}>|</span>
        <span>Y&nbsp;{cursorCoord.y}</span>
      </div>

      <div style={toolbarWrapperStyle}>
        <span style={{ ...zoomLabelStyle, background: theme.overlayBg, borderColor: theme.overlayBorder, color: theme.overlayZoomTx }}>
          {zoomPercent}%
        </span>
        <div style={{ ...toolbarStyle, background: theme.overlayBg, borderColor: theme.overlayBorder }}>
          <button onClick={onZoomIn} style={{ ...btnStyle, color: theme.overlayText }} title="Zoom in">
            <ZoomIn size={16} />
          </button>
          <button onClick={onZoomOut} style={{ ...btnStyle, color: theme.overlayText }} title="Zoom out">
            <ZoomOut size={16} />
          </button>
          <div style={{ ...dividerStyle, background: theme.overlayBorder }} />
          <button onClick={onFitView} style={{ ...btnStyle, color: theme.overlayText }} title="Reset zoom (100%)">
            <Maximize size={16} />
          </button>
          <div style={{ ...dividerStyle, background: theme.overlayBorder }} />
          <button
            onClick={onToggleDarkMode}
            style={{ ...btnStyle, color: theme.overlayText }}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>
    </>
  );
}

export function CanvasDrawingToolbar({
  drawingMode,
  onToggleDrawingMode,
  wallMode,
  onSetWallMode,
  columnMode,
  onToggleColumnMode,
  darkMode,
  disabled,
}) {
  return (
    <DrawingToolbar
      drawingMode={drawingMode}
      onToggleDrawingMode={onToggleDrawingMode}
      wallMode={wallMode}
      onSetWallMode={onSetWallMode}
      columnMode={columnMode}
      onToggleColumnMode={onToggleColumnMode}
      darkMode={darkMode}
      disabled={disabled}
    />
  );
}
