/**
 * Custom SVG icon components following Lucide design conventions:
 *   - 24×24 viewBox
 *   - stroke="currentColor", strokeWidth="1.5"
 *   - strokeLinecap="round", strokeLinejoin="round"
 *   - No fill unless explicitly required
 */

// ── Rack icon ──────────────────────────────────────────────────
// Two vertical uprights, two horizontal beams (shelves), and base plates.
export function RackIcon({ size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Left upright */}
      <line x1="6" y1="3" x2="6" y2="21" />
      {/* Right upright */}
      <line x1="18" y1="3" x2="18" y2="21" />
      {/* Beams / shelves */}
      <line x1="6" y1="9" x2="18" y2="9" />
      <line x1="6" y1="15" x2="18" y2="15" />
      {/* Base plates */}
      <line x1="3" y1="21" x2="9" y2="21" />
      <line x1="15" y1="21" x2="21" y2="21" />
    </svg>
  );
}

// ── Wall Rectangle icon ────────────────────────────────────────
// Nested concentric rectangles — suggests room outline / wall thickness.
export function WallRectIcon({ size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Outer wall boundary */}
      <rect x="3" y="3" width="18" height="18" rx="1" />
      {/* Inner wall boundary (shows wall thickness) */}
      <rect x="7" y="7" width="10" height="10" rx="0.5" />
    </svg>
  );
}

// ── Wall Line icon ─────────────────────────────────────────────
// A diagonal wall segment with perpendicular end-marks (architectural
// convention for wall endpoints). Clearly distinct from the rectangle icon.
export function WallLineIcon({ size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Main wall segment */}
      <line x1="4" y1="20" x2="20" y2="4" />
      {/* Start-point perpendicular mark */}
      <line x1="2" y1="18" x2="6" y2="22" />
      {/* End-point perpendicular mark */}
      <line x1="18" y1="2" x2="22" y2="6" />
    </svg>
  );
}

// ── Column icon ────────────────────────────────────────────────
// Square with an X — standard architectural symbol for a structural column.
export function ColumnIcon({ size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="5" width="14" height="14" rx="1" />
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  );
}

// ── Note / Annotation icon ─────────────────────────────────────
// Sticky-note shape with a folded corner and horizontal text lines.
export function NoteIcon({ size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Note body with folded corner */}
      <path d="M4 4h16v12l-4 4H4z" />
      <path d="M16 16v4" />
      <path d="M16 16h4" />
      {/* Text lines */}
      <line x1="8" y1="9" x2="16" y2="9" />
      <line x1="8" y1="13" x2="13" y2="13" />
    </svg>
  );
}
