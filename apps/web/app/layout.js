import './globals.css';
import AppWorkspaceLayout from '@/src/shared/components/common/AppWorkspaceLayout';

export const metadata = {
  title: 'Racks',
  description: 'Single-page Next.js app',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppWorkspaceLayout>{children}</AppWorkspaceLayout>
      </body>
    </html>
  );
}
