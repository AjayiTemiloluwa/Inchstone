import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Lora } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs'
import Script from 'next/script'
import { InstallPrompt } from '@/components/layout/InstallPrompt'
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Inchstone App",
  description: "A Christian productivity framework",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <head>
          <link rel="manifest" href="/manifest.json" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <link rel="apple-touch-icon" href="/api/icon?sizes=192x192" />
        </head>
        <body className="min-h-full flex flex-col bg-paper text-ink font-sans">
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  try {
                    var stored = localStorage.getItem('theme');
                    if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                      document.documentElement.classList.add('dark');
                    }
                  } catch (e) {}
                })();
              `,
            }}
          />
          <Script
            id="register-sw"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js');
                  });
                }
              `,
            }}
          />
          <InstallPrompt />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
