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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
