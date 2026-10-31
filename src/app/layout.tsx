import type { Metadata } from "next";
import { Bricolage_Grotesque, Martian_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const sans = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = Martian_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const dynamic = "force-dynamic"; // per-request CSP nonce needs dynamic rendering
export const metadata: Metadata = {
  title: "Bandari Check: catch paperwork errors before the port does",
  description: "Cross-checks bill of lading, invoice and packing list for Mombasa clearing agents and drafts the fix message in English and Swahili.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <header className="wall">
          <div className="wrap bar">
            <Link href="/" className="brand"><span className="mark" aria-hidden="true" /><strong>Bandari Check</strong></Link>
            <p className="privacy">Uploaded files are read in memory and never saved.</p>
            <nav aria-label="Main"><Link href="/">Audit</Link><Link href="/history">Impact</Link></nav>
          </div>
        </header>
        {children}
        <footer className="wrap fine">Decision support only. A licensed clearing agent decides what to lodge. Built end to end with Claude.</footer>
      </body>
    </html>
  );
}
