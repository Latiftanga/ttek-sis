import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Providers from "@/components/Providers";
import PWARegister from "@/components/layout/PWARegister";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "TTEK-SIS | Tagnatek Student Information System",
  description: "School management system for Ghanaian schools",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TTEK-SIS",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#059669" },
    { media: "(prefers-color-scheme: dark)", color: "#064e3b" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={geist.variable} suppressHydrationWarning data-scroll-behavior="smooth">
      {/* Loads /theme-init.js before hydration to prevent FOUC */}
      <head>
        <Script
          id="ttek-theme-init"
          src="/theme-init.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="min-h-screen bg-gray-50 font-sans antialiased dark:bg-gray-950 dark:text-gray-100" suppressHydrationWarning>
        <Providers>
          {children}
          <PWARegister />
        </Providers>
      </body>
    </html>
  );
}
