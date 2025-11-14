import "@/app/globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import dynamic from 'next/dynamic';

// Dynamically load the client-side wallet providers to avoid pulling heavy
// browser-only wallet deps into the server build (prevents build-time errors
// referencing `indexedDB` or other browser globals).
const WalletProviders = dynamic(
  () => import('@/components/wallet-providers').then((mod) => mod.WalletProviders),
  { ssr: false }
);

export const metadata: Metadata = {
  title: "Somnia DeFi Metrics",
  description: "On-chain analytics dashboard powered by Somnia Data Streams."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <WalletProviders>
          {children}
        </WalletProviders>
      </body>
    </html>
  );
}
