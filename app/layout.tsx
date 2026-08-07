import type { Metadata } from "next";
import { Shippori_Mincho_B1, Zen_Maru_Gothic } from "next/font/google";
import "./globals.css";

const display = Shippori_Mincho_B1({
  weight: "700",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = Zen_Maru_Gothic({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Touhou Ensemble",
  description:
    "Five hidden in the scene. Find them all before the spell breaks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${body.variable} font-body antialiased`}
      >
        {children}
      </body>
    </html>
  );
}