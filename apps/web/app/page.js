'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

export default function HomePage() {
  const [state, setState] = useState({
    loading: true,
    status: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadHealth() {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/health/`);
        if (!cancelled) {
          setState({
            loading: false,
            status: response.data?.status ?? 'unknown',
            error: null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            loading: false,
            status: null,
            error: error?.response?.data?.detail ?? error.message ?? 'Request failed',
          });
        }
      }
    }

    loadHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      style={{
        height: '100%',
        overflow: 'auto',
        padding: '40px',
        background: 'linear-gradient(135deg, #f7f5ef 0%, #edf7f1 45%, #f5fbff 100%)',
      }}
    >
      <div
        style={{
          maxWidth: '760px',
          margin: '0 auto',
          padding: '32px',
          border: '1px solid #d7e3da',
          borderRadius: '24px',
          background: 'rgba(255, 255, 255, 0.92)',
          boxShadow: '0 24px 80px rgba(15, 23, 42, 0.08)',
        }}
      >
        <p
          style={{
            marginBottom: '12px',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#4d6b57',
          }}
        >
          RackEditor API Check
        </p>
        <h1
          style={{
            marginBottom: '16px',
            fontSize: 'clamp(2rem, 4vw, 3.5rem)',
            lineHeight: 1,
            color: '#18281e',
          }}
        >
          Frontend to Django connection
        </h1>
        <p style={{ marginBottom: '28px', fontSize: '1rem', lineHeight: 1.6, color: '#425466' }}>
          The homepage makes a browser request to the Django REST health endpoint using the configured API base
          URL. If CORS and the backend are wired correctly, the status below should resolve to <code>ok</code>.
        </p>

        <div
          style={{
            padding: '20px',
            borderRadius: '18px',
            background: '#18281e',
            color: '#f6fbf8',
          }}
        >
          <div style={{ marginBottom: '10px', fontSize: '0.9rem', color: '#9dc4a9' }}>API base URL</div>
          <div style={{ marginBottom: '20px', fontSize: '1rem', fontWeight: 600 }}>{API_BASE_URL}</div>
          <div style={{ fontSize: '0.9rem', color: '#9dc4a9' }}>Health response</div>
          <div style={{ marginTop: '10px', fontSize: '1.5rem', fontWeight: 700 }}>
            {state.loading ? 'Loading...' : state.status ?? 'Unavailable'}
          </div>
          {state.error ? (
            <pre
              style={{
                marginTop: '16px',
                padding: '14px',
                overflowX: 'auto',
                borderRadius: '14px',
                background: 'rgba(148, 163, 184, 0.14)',
                color: '#fecaca',
                whiteSpace: 'pre-wrap',
              }}
            >
              {state.error}
            </pre>
          ) : null}
        </div>
      </div>
    </section>
  );
}
