import { cookies } from "next/headers";
import { fetchCurrentUser } from "@/lib/api";

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export default async function AdminDashboard() {
  const cookieStore = await cookies();
  // The layout already guards auth; user is present here.
  const user = (await fetchCurrentUser(cookieStore.toString()))!;

  return (
    <main>
      <h1 style={{ marginTop: 0 }}>Welcome, {user.full_name || user.email}</h1>
      <p style={{ color: "var(--muted)" }}>
        Organisation: <strong>{user.organization.name}</strong> (
        {user.organization.primary_domain})
      </p>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
          marginTop: 24,
        }}
      >
        <Card title="Roles">
          {user.roles.length ? (
            user.roles.map((r) => (
              <span
                key={r.id}
                style={{
                  display: "inline-block",
                  background: "#1d2740",
                  color: "var(--accent)",
                  borderRadius: 999,
                  padding: "2px 10px",
                  marginRight: 6,
                  fontSize: 13,
                }}
              >
                {r.name}
              </span>
            ))
          ) : (
            <span style={{ color: "var(--muted)" }}>No roles assigned</span>
          )}
        </Card>

        <Card title={`Permissions (${user.permissions.length})`}>
          <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.8 }}>
            {user.permissions.join(", ") || "—"}
          </div>
        </Card>
      </section>

      <p style={{ color: "var(--muted)", marginTop: 32, fontSize: 14 }}>
        Phase 01 — auth & RBAC. Candidates, questions, and tests arrive in the
        next phases.
      </p>
    </main>
  );
}
