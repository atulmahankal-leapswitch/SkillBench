import type { Metadata } from "next";
import "./globals.css";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "SkillBench";

export const metadata: Metadata = {
  title: appName,
  description: "Assessment platform for hiring and internal evaluation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
