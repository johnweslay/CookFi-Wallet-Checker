import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NFT Mint Eligibility Checker",
  description: "Check your wallet's eligibility for upcoming and live NFT mints — EVM and Solana.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
