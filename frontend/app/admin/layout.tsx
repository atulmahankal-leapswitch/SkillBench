import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { fetchCurrentUser } from "@/lib/api";
import TopBar from "@/components/TopBar";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/candidates", label: "Candidates" },
  { href: "/admin/questions", label: "Questions" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/tests", label: "Tests" },
  { href: "/admin/schedules", label: "Schedules" },
  { href: "/admin/results", label: "Results" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/users", label: "Users & Roles" },
  { href: "/admin/settings", label: "Settings" },
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

  const brandName =
    user.organization.display_name || user.organization.name || "SkillBench";

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          background: "var(--card)",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {user.organization.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.organization.logo_url}
              alt={brandName}
              style={{ maxHeight: 28, maxWidth: 150 }}
            />
          ) : (
            <span style={{ fontWeight: 700, fontSize: 18 }}>{brandName}</span>
          )}
        </div>

        <nav
          style={{
            padding: "12px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            flex: 1,
          }}
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                color: "var(--fg)",
                padding: "9px 12px",
                borderRadius: 8,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <TopBar email={user.email} fullName={user.full_name} />
        <main style={{ flex: 1 }}>
          <div style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 28px" }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
