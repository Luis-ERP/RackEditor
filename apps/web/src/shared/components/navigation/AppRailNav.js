'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  DraftingCompass,
  Calculator,
  Handshake,
  Boxes,
  Smartphone,
  Users,
  Bot,
  Moon,
  Sun,
} from 'lucide-react';
import { useAppTheme } from '@/src/shared/theme/AppThemeProvider';

const navItems = [
  { href: '/editor', label: 'CAD', Icon: DraftingCompass },
  { href: '/quoter', label: 'Quoter', Icon: Calculator },
  { href: '/hubspot', label: 'HubSpot', Icon: Handshake },
  { href: '/catalog', label: 'Catalog', Icon: Boxes },
  { href: '/quick-cad-bom', label: 'Quick', Icon: Smartphone },
  { href: '/clients', label: 'Clients', Icon: Users },
  { href: '/chatbot', label: 'AI', Icon: Bot },
];

export default function AppRailNav() {
  const pathname = usePathname();
  const { isDark, toggleTheme } = useAppTheme();

  return (
    <aside
      style={{
        width: 56,
        minWidth: 56,
        height: '100vh',
        borderRight: '1px solid var(--surface-border)',
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 12,
        gap: 8,
      }}
      aria-label="Primary navigation"
    >
      {navItems.map(({ href, label, Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            aria-label={label}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: active ? 'var(--app-text)' : 'var(--muted-text)',
              background: active ? 'var(--accent-soft)' : 'transparent',
              border: active ? '1px solid var(--surface-border)' : '1px solid transparent',
              textDecoration: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Icon size={18} strokeWidth={2.2} />
          </Link>
        );
      })}

      <button
        type="button"
        onClick={toggleTheme}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        style={{
          marginTop: 'auto',
          width: 36,
          height: 36,
          borderRadius: 10,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--app-text)',
          background: 'var(--accent-soft)',
          border: '1px solid var(--surface-border)',
          cursor: 'pointer',
        }}
      >
        {isDark ? <Sun size={18} strokeWidth={2.2} /> : <Moon size={18} strokeWidth={2.2} />}
      </button>
    </aside>
  );
}
