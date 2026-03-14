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
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'CAD', Icon: DraftingCompass },
  { href: '/quoter', label: 'Quoter', Icon: Calculator },
  { href: '/hubspot', label: 'HubSpot', Icon: Handshake },
  { href: '/catalog', label: 'Catalog', Icon: Boxes },
  { href: '/quick-cad-bom', label: 'Quick', Icon: Smartphone },
  { href: '/clients', label: 'Clients', Icon: Users },
  { href: '/chatbot', label: 'AI', Icon: Bot },
];

export default function AppRailNav() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: 56,
        minWidth: 56,
        height: '100vh',
        borderRight: '1px solid #e2e8f0',
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 12,
        gap: 8,
      }}
      aria-label="Primary navigation"
    >
      {navItems.map(({ href, label, Icon }) => {
        const active = pathname === href;
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
              color: active ? '#0f172a' : '#64748b',
              background: active ? '#e2e8f0' : 'transparent',
              border: active ? '1px solid #cbd5e1' : '1px solid transparent',
              textDecoration: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Icon size={18} strokeWidth={2.2} />
          </Link>
        );
      })}
    </aside>
  );
}
