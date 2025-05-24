
import type {Metadata} from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/components/ThemeProvider';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Day Architect',
  description: 'Plan your day effectively with Day Architect.',
  icons: {
    icon: [ // Using an array for more explicit SVG definition
      { url: '/icon.svg', type: 'image/svg+xml', sizes: 'any' }
    ],
    shortcut: '/icon.svg', // Legacy browsers
    apple: '/icon.svg',    // Apple touch icon
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
          </AuthProvider>
          <Toaster />
          <div className="fixed bottom-4 right-4 text-xs text-muted-foreground opacity-50 select-none pointer-events-none">
            Ajay Darisi
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
