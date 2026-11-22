import { QuickAdd } from "@container";
import { APP_MODE_SCRIPT } from "@helper";
import { routing } from "@i18n";
import { AppShell } from "@layout";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { locale } from "next/root-params";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

// Cache Components needs every root param value up front; the proxy picks one per request from the cookie.
export const generateStaticParams = () => routing.locales.map((locale) => ({ locale }));

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: { default: "Canibuy", template: "%s · Canibuy" }, description: t("description") };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    // suppressHydrationWarning: APP_MODE_SCRIPT adds `.dark` / color-scheme before React hydrates.
    <html
      lang={await locale()}
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static script built from our own code, no user input */}
        <script dangerouslySetInnerHTML={{ __html: APP_MODE_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider>
          <AppShell quickAdd={<QuickAdd />}>{children}</AppShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
