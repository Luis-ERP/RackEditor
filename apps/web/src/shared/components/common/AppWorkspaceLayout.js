import AppRailNav from '@/src/shared/components/navigation/AppRailNav';

export default function AppWorkspaceLayout({ children }) {
  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <AppRailNav />
      <main style={{ flex: 1, minWidth: 0, minHeight: 0 }}>{children}</main>
    </div>
  );
}
