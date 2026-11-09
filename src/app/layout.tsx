import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GAME_TITLE } from "@/config/game";
import { DEFAULT_LOCALE, t } from "@/ui/i18n";
import { SettingsRoot } from "@/ui/settings/SettingsRoot";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: GAME_TITLE,
  description: t("home.tagline"),
  // Private game for friends: keep it out of search engines (docs/03 §6).
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang={DEFAULT_LOCALE}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SettingsRoot>{children}</SettingsRoot>
      </body>
    </html>
  );
}
