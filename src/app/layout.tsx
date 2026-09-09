import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AdReel AI - Werbevideos für TikTok, Reels und Shorts",
    template: "%s · AdReel AI",
  },
  description:
    "Aus deiner Idee wird in Minuten ein fertiges Werbevideo - inklusive Skript, Visuals, Voice-over und Untertiteln.",
  applicationName: "AdReel AI",
};

export const viewport: Viewport = {
  themeColor: "#050508",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#10101c",
              border: "1px solid #1f1f33",
              color: "#f6f6fb",
            },
          }}
        />
      </body>
    </html>
  );
}
