import { RULER_SIZE } from '../../services/coordinateSystem';

export const wrapperStyle = {
  position: 'relative',
  flex: 1,
  minWidth: 0,
  height: '100%',
  overflow: 'hidden',
};

export const coordHudStyle = {
  position: 'absolute',
  bottom: 16,
  left: RULER_SIZE + 8,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 11,
  fontFamily: 'monospace',
  fontWeight: 500,
  backdropFilter: 'blur(6px)',
  border: '1px solid',
  borderRadius: 6,
  padding: '4px 10px',
  userSelect: 'none',
  pointerEvents: 'none',
  zIndex: 10,
};

export const toolbarWrapperStyle = {
  position: 'absolute',
  bottom: 16,
  right: 16,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  zIndex: 10,
  pointerEvents: 'auto',
};

export const zoomLabelStyle = {
  fontSize: 12,
  fontWeight: 500,
  backdropFilter: 'blur(6px)',
  borderRadius: 6,
  padding: '4px 8px',
  minWidth: 48,
  textAlign: 'center',
  userSelect: 'none',
  border: '1px solid',
};

export const toolbarStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  backdropFilter: 'blur(6px)',
  border: '1px solid',
  borderRadius: 8,
  padding: '4px 4px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};

export const btnStyle = {
  display: 'grid',
  placeItems: 'center',
  width: 28,
  height: 28,
  border: 'none',
  background: 'transparent',
  borderRadius: 6,
  cursor: 'pointer',
};

export const dividerStyle = {
  width: 1,
  height: 16,
  margin: '0 2px',
};

export const actionsBarStyle = {
  position: 'absolute',
  top: RULER_SIZE + 8,
  right: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  backdropFilter: 'blur(6px)',
  border: '1px solid',
  borderRadius: 8,
  padding: 4,
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  zIndex: 10,
  pointerEvents: 'auto',
};

export const actionBtnStyle = {
  display: 'grid',
  placeItems: 'center',
  width: 28,
  height: 28,
  border: 'none',
  background: 'transparent',
  borderRadius: 6,
  cursor: 'pointer',
};

export const actionDividerStyle = {
  height: 1,
  margin: '0 2px',
};

export const drawBannerStyle = {
  position: 'absolute',
  top: RULER_SIZE + 8,
  left: '50%',
  transform: 'translateX(-50%)',
  fontSize: 12,
  fontWeight: 500,
  backdropFilter: 'blur(6px)',
  border: '1px solid',
  borderRadius: 6,
  padding: '5px 14px',
  userSelect: 'none',
  pointerEvents: 'none',
  zIndex: 10,
  whiteSpace: 'nowrap',
};

export function getOverlayTheme(darkMode) {
  const dk = darkMode;
  return {
    overlayBg: dk ? 'rgba(30,31,34,0.88)' : 'rgba(255,255,255,0.85)',
    overlayBorder: dk ? '#374151' : '#e5e7eb',
    overlayText: dk ? '#e5e7eb' : '#374151',
    overlayMuted: dk ? '#6b7280' : '#d1d5db',
    overlayZoomTx: dk ? '#d1d5db' : '#4b5563',
    overlayAccent: '#dc2626',
    overlayBanner: dk
      ? { bg: 'rgba(30,58,95,0.92)', border: '#3b82f6', color: '#93c5fd' }
      : { bg: 'rgba(219,234,254,0.92)', border: '#93c5fd', color: '#1d4ed8' },
  };
}
