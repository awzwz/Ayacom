import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ИС УТО — Система маршрутизации",
  description: "Интеллектуальная система управления спецтехникой",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
