/* eslint-disable react-refresh/only-export-components */
import type { Metadata, Viewport } from 'next';

import { Geist, Geist_Mono } from 'next/font/google';

import { ServiceWorkerRegister, ThemeApplier } from '@/shared/ui';
import { Toaster } from '@/shared/ui/lib/Sonner';

import '@/shared/styles/globals.css';
import '@/shared/styles/cursor.css';
import '@/shared/styles/scrollbar.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Наши Сериалы | Брутальный Трекер',
  description: 'Отслеживаем сериалы вместе',
  manifest: '/manifest.json',
  icons: {
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'Наши Сериалы',
    description: 'Брутальный трекер для двоих',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#3b82f6',
};

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  return (
    <html suppressHydrationWarning lang='ru'>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try {
  var raw = localStorage.getItem('notre-cinema-ui-preferences');
  var theme = raw ? JSON.parse(raw).theme : null;
  document.documentElement.dataset.theme =
    theme === 'minimal' || theme === 'dark' ? theme : 'brutal';
} catch (error) {
  document.documentElement.dataset.theme = 'brutal';
}`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} brutal-font antialiased`}
      >
        <ThemeApplier />
        <ServiceWorkerRegister />
        {children}
        <Toaster />
      </body>
    </html>
  );
};

export default RootLayout;
