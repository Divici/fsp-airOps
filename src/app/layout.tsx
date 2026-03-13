import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FSP AirOps",
  description: "AI-assisted scheduling optimization for flight schools",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
