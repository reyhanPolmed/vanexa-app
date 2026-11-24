import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const manrope = localFont({ src: "./fonts/manrope-variable.ttf", variable: "--font-manrope", display: "swap", weight: "200 800" });

export const metadata: Metadata = {
  title: "Vanexa — Latihan bersama",
  description: "Kelola soal dan persiapkan latihan pengetahuan bersama kelompok Anda.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
