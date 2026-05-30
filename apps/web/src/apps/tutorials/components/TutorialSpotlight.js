'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Renders a full-page semi-transparent overlay with a transparent cutout
 * around the element matched by `selector`. Uses box-shadow to avoid SVG mask
 * complexity. Tracks element position via ResizeObserver + scroll.
 */
export default function TutorialSpotlight({ selector }) {
  const [rect, setRect] = useState(null);
  const observerRef = useRef(null);

  useEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }

    function measure() {
      const el = document.querySelector(selector);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }

    measure();

    observerRef.current = new ResizeObserver(measure);
    const el = document.querySelector(selector);
    if (el) observerRef.current.observe(el);

    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);

    return () => {
      observerRef.current?.disconnect();
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [selector]);

  if (!selector || !rect) return null;

  const PAD = 6;
  const top = rect.top - PAD;
  const left = rect.left - PAD;
  const width = rect.width + PAD * 2;
  const height = rect.height + PAD * 2;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        pointerEvents: 'none',
        boxShadow: `0 0 0 9999px rgba(0,0,0,0.55)`,
        borderRadius: 0,
        clipPath: `polygon(
          0% 0%,
          0% 100%,
          ${left}px 100%,
          ${left}px ${top}px,
          ${left + width}px ${top}px,
          ${left + width}px ${top + height}px,
          ${left}px ${top + height}px,
          ${left}px 100%,
          100% 100%,
          100% 0%
        )`,
      }}
      aria-hidden="true"
    />
  );
}
