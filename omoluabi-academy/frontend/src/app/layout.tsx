import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ọmọlúàbí Business Academy — Admin",
  description: "Content operations dashboard for OMỌLÚÀBÍ BUSINESS ACADEMY",
  robots: { index: false, follow: false }, // private admin tool
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b-4 border-gold bg-navy text-cream">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
            <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-gold font-display text-lg font-bold text-navy">
              Ọ
            </span>
            <div>
              <p className="font-display text-lg font-semibold tracking-wide">OMỌLÚÀBÍ BUSINESS ACADEMY</p>
              <p className="text-xs text-gold-100">Ẹ̀kọ́ iṣẹ́ òwò ní èdè Yorùbá · Admin</p>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
