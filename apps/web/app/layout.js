import './globals.css';

export const metadata = {
  title: 'Racks',
  description: 'Single-page Next.js app',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
