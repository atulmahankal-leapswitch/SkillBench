import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { fetchCurrentUser } from "@/lib/api";
import LogoutButton from "./logout-button";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/candidates", label: "Candidates" },
  { href: "/admin/questions", label: "Questions" },
  { href: "/admin/tests", label: "Tests" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const user = await fetchCurrentUser(cookieStore.toString());

  if (!user) {
    redirect("/login");
  }

  return (
    <div>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 24px",
          borderBottom: "1px solid var(--border)",
          background: "var(--card)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <strong>SkillBench</strong>
          <nav style={{ display: "flex", gap: 18 }}>
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{ color: "var(--muted)", fontSize: 14 }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "var(--muted)", fontSize: 14 }}>
            {user.email}
          </span>
          <LogoutButton />
        </div>
      </header>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "32px 24px" }}>
        {children}
      </div>
    </div>
  );
}
