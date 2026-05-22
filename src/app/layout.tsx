import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BOTC Storyteller",
  description: "Blood on the Clocktower storyteller controller",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}