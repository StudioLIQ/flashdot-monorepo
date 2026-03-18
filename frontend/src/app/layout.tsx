import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import "./globals.css";
import { NavigationShell } from "../components/NavigationShell";
import { NotificationProvider } from "../providers/NotificationProvider";
import { QueryProvider } from "../providers/QueryProvider";
import { SettingsProvider } from "../providers/SettingsProvider";
import { ThemeProvider } from "../providers/ThemeProvider";
import { ToastProvider } from "../providers/ToastProvider";
import { WalletModalProvider } from "../providers/WalletModalProvider";
import { WalletProvider } from "../providers/WalletProvider";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "FlashDot",
  description: "Bonded cross-chain flash loan coordinator on Polkadot Hub",
  applicationName: "FlashDot",
  metadataBase: new URL("https://flashdot.vercel.app"),
  openGraph: {
    title: "FlashDot",
    description: "Bonded cross-chain flash loan coordinator on Polkadot Hub",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "FlashDot bonded cross-chain flash loan",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FlashDot",
    description: "Bonded cross-chain flash loan coordinator on Polkadot Hub",
    images: ["/opengraph-image"],
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5fff8" },
    { media: "(prefers-color-scheme: dark)", color: "#07110f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): JSX.Element {
  return (
    <html lang="en">
      <body className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} font-sans`}>
        <ThemeProvider>
          <SettingsProvider>
            <NotificationProvider>
              <QueryProvider>
                <WalletProvider>
                  <WalletModalProvider>
                    <ToastProvider>
                      <NavigationShell>{children}</NavigationShell>
                    </ToastProvider>
                  </WalletModalProvider>
                </WalletProvider>
              </QueryProvider>
            </NotificationProvider>
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
