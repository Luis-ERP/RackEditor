'use client';

import { useState } from 'react';

const VIDEOS = {
  en: {
    label: 'English',
    embedUrl: 'https://www.youtube.com/embed/-iDtHPkcNQk',
    watchUrl: 'https://youtu.be/-iDtHPkcNQk',
  },
  es: {
    label: 'Español',
    embedUrl: 'https://www.youtube.com/embed/ySaLnXNT8iE?si=0JK0FEtPZk3bo1_q',
    watchUrl: 'https://youtu.be/ySaLnXNT8iE?si=0JK0FEtPZk3bo1_q',
  },
};

const MODAL_OVERLAY_STYLE = {
  position: 'fixed',
  inset: 0,
  zIndex: 9500,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,0,0,0.5)',
  padding: '16px',
};

const MODAL_BODY_STYLE = {
  width: 'min(860px, 100%)',
  maxHeight: 'calc(100vh - 32px)',
  overflow: 'auto',
  background: 'var(--surface)',
  border: '1px solid var(--surface-border)',
  borderRadius: '14px',
  boxShadow: '0 18px 48px rgba(0,0,0,0.3)',
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
};

const BUTTON_BASE_STYLE = {
  borderRadius: '8px',
  border: '1px solid var(--surface-border)',
  padding: '8px 12px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
};

export default function FirstVisitTutorialModal({ isOpen, onClose }) {
  const [language, setLanguage] = useState('en');

  if (!isOpen) return null;

  const activeVideo = VIDEOS[language] ?? VIDEOS.en;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Short quick start tutorial"
      style={MODAL_OVERLAY_STYLE}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div style={MODAL_BODY_STYLE}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--app-text)' }}>
              Short Quick-Start Video
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--muted-text)' }}>
              This is a short intro video to help you learn how to use the app.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close tutorial video"
            style={{
              ...BUTTON_BASE_STYLE,
              width: '34px',
              height: '34px',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              color: 'var(--muted-text)',
            }}
          >
            X
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', color: 'var(--muted-text)' }}>
            Video language
          </span>
          <div
            role="tablist"
            aria-label="Tutorial video language"
            style={{
              display: 'inline-flex',
              border: '1px solid var(--surface-border)',
              borderRadius: '10px',
              overflow: 'hidden',
              background: 'var(--surface-muted)',
            }}
          >
            {Object.entries(VIDEOS).map(([key, value]) => {
              const active = language === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setLanguage(key)}
                  style={{
                    border: 0,
                    borderRight: key === 'en' ? '1px solid var(--surface-border)' : 0,
                    background: active ? '#2563eb' : 'transparent',
                    color: active ? '#fff' : 'var(--app-text)',
                    fontSize: '13px',
                    fontWeight: 600,
                    padding: '8px 12px',
                    cursor: 'pointer',
                  }}
                >
                  {value.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', borderRadius: '10px', overflow: 'hidden' }}>
          <iframe
            title="Rack Editor quick start tutorial"
            src={activeVideo.embedUrl}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
          <a
            href={activeVideo.watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...BUTTON_BASE_STYLE,
              textDecoration: 'none',
              color: 'var(--app-text)',
              background: 'var(--accent-soft)',
            }}
          >
            Open on YouTube
          </a>
          <button
            type="button"
            onClick={onClose}
            style={{
              ...BUTTON_BASE_STYLE,
              background: '#2563eb',
              border: '1px solid #2563eb',
              color: '#fff',
            }}
          >
            Continue to app
          </button>
        </div>
      </div>
    </div>
  );
}