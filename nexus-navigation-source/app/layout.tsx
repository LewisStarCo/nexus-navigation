import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://nexus-navigation.vercel.app"),
  title: "Nexus · Personal Workspace",
  description: "将数字资源访问、今日专注与时间安排统一在一个安静的个人工作空间。",
  openGraph: {
    title: "Nexus · Personal Workspace",
    description: "Navigation = Access · Workspace = Action",
    type: "website",
    images: [{ url: "/og-v16.png", width: 1731, height: 909, alt: "Nexus Personal Workspace" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexus · Personal Workspace",
    description: "Navigation = Access · Workspace = Action",
    images: ["/og-v16.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
