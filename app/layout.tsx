import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "PharmaLIMS",
    template: "%s · PharmaLIMS",
  },
  description: "Enterprise Pharmaceutical Laboratory Information Management System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}