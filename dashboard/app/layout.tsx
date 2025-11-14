"use client";

import "@/app/globals.css";
import { ReactNode } from "react";
import { WalletProviders } from "@/components/wallet-providers";

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
