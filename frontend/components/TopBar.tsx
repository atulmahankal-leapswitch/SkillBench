"use client";

import { usePathname } from "next/navigation";
import ProfileMenu from "./ProfileMenu";
import ThemeToggle from "./ThemeToggle";

const TITLES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/candidates": "Candidates",
  "/admin/questions": "Questions",
  "/admin/tests": "Tests",
  "/admin/schedules": "Schedules",
  "/admin/results": "Results",
  "/admin/analytics": "Analytics",
  "/admin/users": "Users & Roles",
  "/admin/settings": "Settings",
  "/admin/profile": "Profile",
};

export default function TopBar({
  email,
  fullName,
}: {
  email: string;
  fullName: string;
}) {
  const pathname = usePathname();
  // Longest matching prefix wins (so nested routes still resolve a title).
  const title =
    TITLES[pathname] ??
    Object.entries(TITLES)
      .filter(([p]) => pathname.startsWith(p) && p !== "/admin")
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ??
    "Admin";

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 24px",
        background: "var(--card)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <h1 style={{ margin: 0, fontSize: 18 }}>{title}</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <ThemeToggle />
        <ProfileMenu email={email} fullName={fullName} />
      </div>
    </header>
  );
}
