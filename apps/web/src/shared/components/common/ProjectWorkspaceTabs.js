'use client';

import Link from 'next/link';
import { PenLine, Calculator, Box } from 'lucide-react';

const TABS = [
  { key: 'design', label: 'Design', Icon: PenLine, suffix: '/design' },
  { key: 'quote', label: 'Quote', Icon: Calculator, suffix: '/quote' },
  { key: '3d', label: '3D', Icon: Box, suffix: '/3d', comingSoon: true },
];

export default function ProjectWorkspaceTabs({ projectId, activePath, projectName }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        borderBottom: '1px solid var(--surface-border)',
        background: 'var(--surface)',
        height: 44,
        flexShrink: 0,
        paddingLeft: 16,
        gap: 4,
      }}
    >
      {projectName && (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--muted-text)',
            paddingRight: 12,
            borderRight: '1px solid var(--surface-border)',
            marginRight: 12,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 180,
          }}
        >
          {projectName}
        </span>
      )}
      {TABS.map(({ key, label, Icon, suffix, comingSoon }) => {
        const href = `/project/${projectId}${suffix}`;
        const isActive = activePath?.endsWith(suffix);

        return (
          <Link
            key={key}
            href={href}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 14px',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--app-text)' : comingSoon ? 'var(--muted-text)' : 'var(--muted-text)',
              borderBottom: isActive ? '2px solid var(--app-text)' : '2px solid transparent',
              opacity: comingSoon && !isActive ? 0.6 : 1,
              transition: 'color 0.15s, opacity 0.15s',
              position: 'relative',
              whiteSpace: 'nowrap',
            }}
          >
            <Icon size={14} strokeWidth={2.2} />
            {label}
            {comingSoon && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--muted-text)',
                  background: 'var(--accent-soft)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: 4,
                  padding: '1px 4px',
                  lineHeight: 1.4,
                }}
              >
                Soon
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
