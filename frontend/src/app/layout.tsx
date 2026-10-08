import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AppThemeProvider } from '@/context/app-theme-context';

export const metadata: Metadata = {
  title: 'RADIUS PRO — ISP Management Panel',
  description: 'Production-quality ISP RADIUS Management and NOC Monitoring Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AppThemeProvider>
            {children}
          </AppThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
