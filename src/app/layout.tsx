import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "血染钟楼说书人工具",
  description: "血染钟楼说书人控制台",
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
