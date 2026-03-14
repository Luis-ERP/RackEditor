'use client';

import AppRailNav from '@/src/shared/components/navigation/AppRailNav';
import { AppThemeProvider } from '@/src/shared/theme/AppThemeProvider';

export default function AppWorkspaceLayout({ children }) {
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
