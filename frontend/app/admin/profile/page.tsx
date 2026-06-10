import { cookies } from "next/headers";
import { fetchCurrentUser } from "@/lib/api";
import { Badge } from "@/components/ui";

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const user = (await fetchCurrentUser(cookieStore.toString()))!;

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div style={{ display: "flex", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ width: 160, color: "var(--muted)", fontSize: 14 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{value}</div>
    </div>
  );

  return (
    <main>
      <h1 style={{ marginTop: 0 }}>Profile</h1>
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "8px 20px",
          maxWidth: 640,
        }}
      >
        <Row label="Name" value={user.full_name || "—"} />
        <Row label="Email" value={user.email} />
        <Row
          label="Organisation"
          value={`${user.organization.display_name || user.organization.name} (${user.organization.primary_domain})`}
        />
        <Row
          label="Roles"
          value={user.roles.map((r) => <Badge key={r.id}>{r.name}</Badge>)}
        />
        <Row
          label="Permissions"
          value={
            <span style={{ color: "var(--muted)", lineHeight: 1.8 }}>
              {user.permissions.join(", ")}
            </span>
          }
        />
      </div>
    </main>
  );
}
