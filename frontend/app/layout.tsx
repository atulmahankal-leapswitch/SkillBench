import type { Metadata, Viewport } from "next";
import "./globals.css";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "SkillBench";

export const metadata: Metadata = {
  // Pages set their own title; it renders as "<page>:<app>".
  title: { default: appName, template: `%s:${appName}` },
  description: "Assessment platform for hiring and internal evaluation.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Resolve the theme before paint to avoid a flash. Preference is
            system | light | dark (default system → follow the OS). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var p=localStorage.getItem('sb-theme')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.dataset.theme=d?'dark':'light';r.dataset.themePref=p;}catch(e){document.documentElement.dataset.theme='dark';}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
