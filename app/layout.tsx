import type { Metadata } from 'next';
import './globals.css';
import './admin.css';

export const metadata: Metadata = {
  title: 'Aminia Hope Foundation | Believe in a brighter future',
  description:
    'Community-based programmes for children, families and communities in Entebbe, Katabi and Busabaga, Uganda. Discover Aminia Kids, our work and ways to help.',
  icons: {
    icon: '/images/brand-icon-8608b9d4bb7c.png',
    shortcut: '/images/brand-icon-8608b9d4bb7c.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
