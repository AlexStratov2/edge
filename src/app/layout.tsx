import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Edge — Football Betting Stats",
  description: "Automated football statistics and value-bet detection dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">
        <NavBar />
        <main className="relative z-10 mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
        <footer className="relative z-10 mx-auto w-full max-w-[1200px] px-4 pb-10 pt-4 sm:px-6">
          <p className="text-xs text-muted">
            Data: Football-Data.co.uk (results, odds &amp; stats) · ClubElo (ratings). For
            research and entertainment only — no bet is a sure thing. Bet responsibly.
          </p>
        </footer>
      </body>
    </html>
  );
}
