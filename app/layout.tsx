import type { Metadata } from "next";
import localFont from "next/font/local";
import AppShell from "@/components/layout/AppShell";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import "./globals.css";

const display = localFont({
  src: "./fonts/cormorant-garamond-latin.woff2",
  variable: "--font-cormorant",
  weight: "400 600",
  display: "swap",
});

const sans = localFont({
  src: "./fonts/manrope-latin.woff2",
  variable: "--font-manrope",
  weight: "400 700",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ARCA — Private Collection",
    template: "%s — ARCA",
  },
  description:
    "A private digital vault for curating, valuing, and preserving card collections.",
};

const themeScript = `
  try {
    const stored = localStorage.getItem('arca-theme');
    document.documentElement.dataset.theme = stored === 'light' ? 'light' : 'dark';
  } catch (_) {
    document.documentElement.dataset.theme = 'dark';
  }
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${display.variable} ${sans.variable} antialiased`}>
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
