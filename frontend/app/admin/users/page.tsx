"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client";
import { Badge, Button, ErrorText, PageHeader, td, th } from "@/components/ui";

type Role = { id: string; name: string; description: string };
type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  last_login_at: string | null;
  roles: Role[];
};

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setRoles(await api.get<Role[]>("/users/roles"));
      setUsers(await api.get<AdminUser[]>("/users"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleRole(u: AdminUser, roleId: string) {
    const has = u.roles.some((r) => r.id === roleId);
    const role_ids = has
      ? u.roles.filter((r) => r.id !== roleId).map((r) => r.id)
      : [...u.roles.map((r) => r.id), roleId];
    setSavingId(u.id);
    setError(null);
    try {
      const updated = await api.patch<AdminUser>(`/users/${u.id}`, { role_ids });
      setUsers((list) => list.map((x) => (x.id === u.id ? updated : x)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Update failed");
    } finally {
      setSavingId(null);
    }
  }

  async function toggleActive(u: AdminUser) {
    setSavingId(u.id);
    setError(null);
    try {
      const updated = await api.patch<AdminUser>(`/users/${u.id}`, {
        is_active: !u.is_active,
      });
      setUsers((list) => list.map((x) => (x.id === u.id ? updated : x)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Update failed");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main>
      <PageHeader title="Users & Roles" />
      <p style={{ color: "var(--muted)", marginTop: -8 }}>
        Members join automatically when they sign in with an allowed
        organisation email. Assign roles to control access.
      </p>
      <ErrorText message={error} />

      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
          marginTop: 12,
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>User</th>
              <th style={th}>Roles</th>
              <th style={th}>Active</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td style={td} colSpan={3}>
                  Loading…
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} style={{ opacity: savingId === u.id ? 0.6 : 1 }}>
                  <td style={td}>
                    {u.full_name || "—"}
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>
                      {u.email}
                    </div>
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      {roles.map((r) => {
                        const checked = u.roles.some((x) => x.id === r.id);
                        return (
                          <label
                            key={r.id}
                            title={r.description}
                            style={{ fontSize: 13, color: "var(--muted)" }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleRole(u, r.id)}
                            />{" "}
                            {r.name}
                          </label>
                        );
                      })}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      {u.roles.map((r) => (
                        <Badge key={r.id}>{r.name}</Badge>
                      ))}
                    </div>
                  </td>
                  <td style={td}>
                    <Button
                      variant={u.is_active ? "ghost" : "danger"}
                      onClick={() => toggleActive(u)}
                    >
                      {u.is_active ? "Active" : "Disabled"}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
