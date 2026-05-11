import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
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
    <html lang="en" className={geist.variable} suppressHydrationWarning>
      {/* Inline script prevents flash of wrong theme before React hydrates */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var ts=localStorage.getItem('ttek-theme');var t=ts?JSON.parse(ts).state?.theme:'system';var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');var as=localStorage.getItem('ttek-auth');var brand=as?JSON.parse(as).state?.school?.accent_color:null;if(brand)document.documentElement.style.setProperty('--brand',brand);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-gray-50 font-sans antialiased dark:bg-gray-950 dark:text-gray-100">
        <Providers>
          {children}
          <PWARegister />
        </Providers>
      </body>
    </html>
  );
}
