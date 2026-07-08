'use client';

import { X } from 'lucide-react';

const FEEDBACK_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSf37Cr4gRTj3vSkQlyywRt8vZR6oL6rjAAYcdFY8u2wC_W-ww/viewform?embedded=true';

const btn = (extra = {}) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  padding: '8px 14px',
  transition: 'opacity 0.15s',
  ...extra,
});

export default function FeedbackModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Send feedback"
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--surface-border)',
          borderRadius: 14,
          padding: 16,
          width: 680,
          maxWidth: 'calc(100vw - 32px)',
          height: 'calc(100vh - 32px)',
          maxHeight: 900,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, color: 'var(--app-text)', fontSize: 15 }}>
            Send Feedback
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={btn({
              width: 28,
              height: 28,
              padding: 0,
              borderRadius: 7,
              background: 'transparent',
              border: '1px solid transparent',
              color: 'var(--muted-text)',
            })}
          >
            <X size={15} />
          </button>
        </div>

        <iframe
          title="Feedback Form"
          src={FEEDBACK_FORM_URL}
          width="640"
          height="1233"
          frameBorder="0"
          marginHeight="0"
          marginWidth="0"
          style={{
            width: '100%',
            height: '100%',
            minHeight: 560,
            border: 'none',
            borderRadius: 10,
            background: 'var(--surface-muted)',
          }}
        >
          Loading...
        </iframe>
      </div>
    </div>
  );
}
