import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexus · Personal Workspace",
  description: "将数字资源访问、今日专注与时间安排统一在一个安静的个人工作空间。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
