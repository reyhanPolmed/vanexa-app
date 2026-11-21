import type { Metadata } from "next";
import "./globals.css";

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
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
