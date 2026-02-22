import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClawHealth — Team Hub",
  description: "Shared task board for Albert, Manny, and Jeff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#fafafa] text-[#1a1a2e] min-h-screen">{children}</body>
    </html>
  );
}
