import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs'
import Script from 'next/script'
import { InstallPrompt } from '@/components/ui/InstallPrompt'
import { CursorGlow } from '@/components/ui/CursorGlow'
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
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
  themeColor: "#0A0908", // --ink
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      <html
        lang="en"
        className={`${inter.variable} ${jetbrainsMono.variable} ${playfair.variable} dark h-full antialiased`}
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
                    // Unregister any stale service workers first, then register the new one.
                    // This clears old cache-first handlers that caused ERR_FAILED on dev server restarts.
                    navigator.serviceWorker.getRegistrations().then(function(registrations) {
                      var unregisterAll = registrations.map(function(r) {
                        // Keep only our current sw.js; unregister anything else
                        if (!r.active || !r.active.scriptURL.endsWith('/sw.js')) {
                          return r.unregister();
                        }
                        return Promise.resolve();
                      });
                      return Promise.all(unregisterAll);
                    }).then(function() {
                      return navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
                    }).catch(function(err) {
                      console.warn('SW registration failed:', err);
                    });
                  });
                }
              `,
            }}
          />
          <InstallPrompt />
          <CursorGlow />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
