import "@/app/globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import { WalletProviders } from "@/components/wallet-providers";

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
