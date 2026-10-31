import type { Metadata } from 'next';
import WebsiteAdmin from '@/components/website-admin';
export const metadata: Metadata = {
  title: 'Website Admin | Aminia Hope Foundation',
  robots: { index: false, follow: false },
  manifest: '/admin.webmanifest',
  appleWebApp: { capable: true, title: 'AHF Admin', statusBarStyle: 'default' },
  icons: { apple: '/icons/admin-192.png' },
};
export default function Page() {
  return <WebsiteAdmin />;
}
