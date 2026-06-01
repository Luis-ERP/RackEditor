'use client';

import { Box } from 'lucide-react';

export default function ThreeDPlaceholderPage() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--surface-border)',
          borderRadius: 16,
          padding: '48px 64px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          maxWidth: 480,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: 'var(--accent-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box size={32} style={{ color: 'var(--app-text)' }} />
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--app-text)',
          }}
        >
          3D Renderer — Coming Soon
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: 'var(--app-text-secondary, var(--app-text))',
            lineHeight: 1.6,
            opacity: 0.7,
          }}
        >
          A three-dimensional view of your rack layout will appear here.
        </p>
      </div>
    </div>
  );
}
