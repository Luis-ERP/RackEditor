'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import CadWorkspacePage from '@/src/apps/cad/CadWorkspacePage';
import TutorialPanel from '@/src/apps/tutorials/components/TutorialPanel';
import { LAB_REGISTRY } from '@/src/apps/tutorials/labRegistry';
import { getTutorialStore } from '@/src/apps/tutorials/tutorialSingleton';
import '@/src/apps/tutorials/styles/tutorial.css';

export default function TutorialLabPage() {
  const { labId } = useParams();
  const lab = LAB_REGISTRY[labId];

  useEffect(() => {
    if (!lab) return;
    const store = getTutorialStore();
    // Only start if not already running this lab (e.g. after hot-reload)
    const current = store.getState();
    if (current.activeLab?.id !== lab.id) {
      store.startLab(lab);
    }
  }, [lab]);

  if (!lab) {
    return (
      <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
        <h1>Lab not found</h1>
        <p>
          <a href="/tutorials">← Back to Labs</a>
        </p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <CadWorkspacePage />
      {/* TutorialPanel reads store state internally; no props needed for layout/rack refs
          because the panel subscribes to the singleton stores directly. */}
      <TutorialPanel />
    </div>
  );
}
