import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BHB Business Centre | Offices and Accounts",
  description: "Physical and virtual office leases, documents, incoming checks and business expenses in AED.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
