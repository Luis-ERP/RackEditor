'use client';

import { useEffect } from 'react';
import AppRailNav from '@/src/shared/components/navigation/AppRailNav';
import { AppThemeProvider } from '@/src/shared/theme/AppThemeProvider';
import { projectStore } from '@/src/apps/cad/services/project/projectStore';

export default function AppWorkspaceLayout({ children }) {
  // Initialise the project system once after the first client-side render.
  // Children's effects run first (bottom-up), so CadWorkspacePage's canvas-
  // restore listener is already registered when init() fires its event here.
  useEffect(() => {
    projectStore.init();
  }, []);

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
    </AppThemeProvider>
  );
}
