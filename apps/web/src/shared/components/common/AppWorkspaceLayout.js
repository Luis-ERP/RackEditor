'use client';

import { useEffect, useState } from 'react';
import AppRailNav from '@/src/shared/components/navigation/AppRailNav';
import FirstVisitTutorialModal from '@/src/shared/components/common/FirstVisitTutorialModal';
import { AppThemeProvider } from '@/src/shared/theme/AppThemeProvider';
import { projectStore } from '@/src/apps/cad/services/project/projectStore';

const FIRST_VISIT_VIDEO_KEY = 'rack-editor:tutorial-video-modal:v1';

export default function AppWorkspaceLayout({ children }) {
  const [showTutorialModal, setShowTutorialModal] = useState(false);

  // Initialise the project system once after the first client-side render.
  // Children's effects run first (bottom-up), so CadWorkspacePage's canvas-
  // restore listener is already registered when init() fires its event here.
  useEffect(() => {
    projectStore.init();
  }, []);

  useEffect(() => {
    try {
      const alreadySeen = window.localStorage.getItem(FIRST_VISIT_VIDEO_KEY) === '1';
      if (!alreadySeen) setShowTutorialModal(true);
    } catch {
      // Ignore storage access issues and keep the app usable.
    }
  }, []);

  const dismissTutorialModal = () => {
    try {
      window.localStorage.setItem(FIRST_VISIT_VIDEO_KEY, '1');
    } catch {
      // Ignore storage access issues and keep the app usable.
    }
    setShowTutorialModal(false);
  };

  return (
    <AppThemeProvider>
      <div
        style={{
          display: 'flex',
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
          background: 'var(--app-bg)',
          color: 'var(--app-text)',
        }}
      >
        <AppRailNav />
        <main style={{ flex: 1, minWidth: 0, minHeight: 0 }}>{children}</main>
      </div>
      <FirstVisitTutorialModal isOpen={showTutorialModal} onClose={dismissTutorialModal} />
    </AppThemeProvider>
  );
}
