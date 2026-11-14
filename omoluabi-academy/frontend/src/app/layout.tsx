import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";
// Noto fonts position stacked Yoruba diacritics (e.g. ọ̀, ẹ́) correctly. The latin-ext and
// 'vietnamese' subsets contain the dotted letters ẹ ọ ṣ; files are bundled, not fetched from Google.
import "@fontsource/noto-sans/latin-400.css";
import "@fontsource/noto-sans/latin-500.css";
import "@fontsource/noto-sans/latin-600.css";
import "@fontsource/noto-sans/latin-ext-400.css";
import "@fontsource/noto-sans/latin-ext-500.css";
import "@fontsource/noto-sans/latin-ext-600.css";
import "@fontsource/noto-sans/vietnamese-400.css";
import "@fontsource/noto-sans/vietnamese-500.css";
import "@fontsource/noto-sans/vietnamese-600.css";
import "@fontsource/noto-serif/latin-600.css";
import "@fontsource/noto-serif/latin-ext-600.css";
import "@fontsource/noto-serif/vietnamese-600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ọmọlúàbí Business Academy · Admin",
  description: "Content operations dashboard for OMỌLÚÀBÍ BUSINESS ACADEMY",
  robots: { index: false, follow: false }, // private admin tool
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
