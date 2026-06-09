import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchCurrentUser } from "@/lib/api";
import LogoutButton from "./logout-button";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const user = await fetchCurrentUser(cookieHeader);

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
        <strong>SkillBench Admin</strong>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "var(--muted)", fontSize: 14 }}>
            {user.email}
          </span>
          <LogoutButton />
        </div>
      </header>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
        {children}
      </div>
    </div>
  );
}
