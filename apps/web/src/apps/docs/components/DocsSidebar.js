'use client';

import { useEffect, useState } from 'react';

const NAV_SECTIONS = [
  {
    group: 'Introduction',
    links: [
      { id: 'overview', label: 'Overview' },
      { id: 'roles', label: 'User Roles' },
      { id: 'workflow', label: 'Core Workflow' },
    ],
  },
  {
    group: 'Rack Design',
    links: [
      { id: 'key-concepts', label: 'Key Concepts' },
      { id: 'frame-rules', label: 'Frame Rules' },
      { id: 'beam-levels', label: 'Beam Levels' },
      { id: 'configurations', label: 'Configurations' },
      { id: 'accessories', label: 'Accessories' },
    ],
  },
  {
    group: 'Validation',
    links: [
      { id: 'validation-states', label: 'Validation States' },
      { id: 'compatibility-rules', label: 'Compatibility Rules' },
      { id: 'error-reference', label: 'Error Reference' },
    ],
  },
  {
    group: 'Bill of Materials',
    links: [
      { id: 'bom-overview', label: 'How the BOM Works' },
      { id: 'bom-quantities', label: 'Quantity Derivation' },
    ],
  },
  {
    group: 'Quoting',
    links: [
      { id: 'quote-lifecycle', label: 'Quote Lifecycle' },
      { id: 'pricing', label: 'Pricing Rules' },
      { id: 'adjustments', label: 'Discounts & Overrides' },
    ],
  },
  {
    group: 'Revisions',
    links: [
      { id: 'design-revisions', label: 'Design Revisions' },
      { id: 'quote-revisions', label: 'Quote Revisions' },
      { id: 'immutability', label: 'Immutability Policy' },
    ],
  },
];

const ALL_IDS = NAV_SECTIONS.flatMap((g) => g.links.map((l) => l.id));

export default function DocsSidebar() {
  const [active, setActive] = useState('overview');

  useEffect(() => {
    const container = document.querySelector('.docs-content');
    if (!container) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const topmost = visible.sort(
          (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
        )[0];
        setActive(topmost.target.id);
      },
      { root: container, rootMargin: '0px 0px -70% 0px', threshold: 0 },
    );

    ALL_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    // If the URL has a hash on first load, scroll the container to it.
    const initialHash = window.location.hash.slice(1);
    if (initialHash && ALL_IDS.includes(initialHash)) {
      const target = document.getElementById(initialHash);
      if (target) {
        target.scrollIntoView({ block: 'start' });
        setActive(initialHash);
      }
    }

    return () => observer.disconnect();
  }, []);

  const handleClick = (event, id) => {
    event.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActive(id);
    if (window.history?.replaceState) {
      window.history.replaceState(null, '', `#${id}`);
    }
  };

  return (
    <aside className="docs-sidebar">
      <div className="docs-sidebar-header">
        <a href="/docs" className="docs-sidebar-logo">
          <span className="docs-sidebar-logo-icon">R</span>
          RackEditor
        </a>
        <div className="docs-sidebar-subtitle">Documentation</div>
      </div>

      <nav className="docs-sidebar-nav">
        {NAV_SECTIONS.map((group) => (
          <div key={group.group} className="docs-nav-group">
            <div className="docs-nav-group-title">{group.group}</div>
            {group.links.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                className={`docs-nav-link${active === link.id ? ' active' : ''}`}
                onClick={(e) => handleClick(e, link.id)}
              >
                {link.label}
              </a>
            ))}
          </div>
        ))}
      </nav>

      <div className="docs-sidebar-footer">
        <a href="/" className="docs-back-link">
          ← Back to App
        </a>
      </div>
    </aside>
  );
}
