import Link from "next/link";
import { cookies } from "next/headers";
import { fetchCurrentUser, serverApiBase } from "@/lib/api";
import type { Page, ResultSummary } from "@/lib/client";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function Stat({ label, value, hint, href }: { label: string; value: React.ReactNode; hint?: string; href?: string }) {
  const inner = (
    <Card title={label}>
      <div style={{ fontSize: 30, fontWeight: 700 }}>{value}</div>
      {hint && <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{hint}</div>}
    </Card>
  );
  return href ? <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>{inner}</Link> : inner;
}

async function fetchPage<T>(path: string, cookie: string): Promise<Page<T>> {
  const empty: Page<T> = { items: [], total: 0, limit: 0, offset: 0 };
  try {
    const res = await fetch(`${serverApiBase}/api${path}`, {
      headers: { cookie },
      cache: "no-store",
    });
    if (!res.ok) return empty;
    return (await res.json()) as Page<T>;
  } catch {
    return empty;
  }
}

export default async function AdminDashboard() {
  const cookieStore = await cookies();
  const cookie = cookieStore.toString();
  const user = (await fetchCurrentUser(cookie))!;

  const [tests, candidates, schedules, results] = await Promise.all([
    fetchPage<unknown>("/tests?limit=1", cookie),
    fetchPage<unknown>("/candidates?limit=1", cookie),
    fetchPage<{ status: string }>("/schedules?limit=200", cookie),
    fetchPage<ResultSummary>("/results?limit=200", cookie),
  ]);

  const graded = results.items;
  const passed = graded.filter((r) => r.passed).length;
  const needsReview = graded.filter((r) => r.needs_review).length;
  const passRate = graded.length ? Math.round((passed / graded.length) * 100) : 0;

  const scheduleStatus = schedules.items.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});
  const upcoming = scheduleStatus["scheduled"] ?? 0;
  const inProgress = scheduleStatus["in_progress"] ?? 0;

  const recent = [...graded]
    .sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""))
    .slice(0, 6);

  return (
    <main>
      <h1 style={{ marginTop: 0 }}>Welcome, {user.full_name || user.email}</h1>
      <p style={{ color: "var(--muted)" }}>
        {user.organization.name} · assessment overview
      </p>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginTop: 20,
        }}
      >
        <Stat label="Tests" value={tests.total} href="/admin/tests" />
        <Stat label="Candidates" value={candidates.total} href="/admin/candidates" />
        <Stat
          label="Schedules"
          value={schedules.total}
          hint={`${upcoming} upcoming · ${inProgress} in progress`}
          href="/admin/schedules"
        />
        <Stat label="Attempts graded" value={results.total} href="/admin/results" />
        <Stat label="Pass rate" value={`${passRate}%`} hint={`${passed}/${graded.length} passed`} />
        <Stat
          label="Needs review"
          value={needsReview}
          hint={needsReview ? "awaiting grading" : "all graded"}
          href="/admin/results"
        />
      </section>

      <h2 style={{ fontSize: 16, margin: "28px 0 12px" }}>Recent results</h2>
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {recent.length === 0 ? (
          <div style={{ padding: 20, color: "var(--muted)" }}>No attempts yet.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <tbody>
              {recent.map((r) => (
                <tr key={r.attempt_id}>
                  <td style={{ padding: "10px 16px", borderTop: "1px solid var(--border)" }}>
                    <Link href={`/admin/results/${r.attempt_id}`} style={{ color: "inherit" }}>
                      {r.candidate_name}
                    </Link>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>{r.test_title}</div>
                  </td>
                  <td style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", textAlign: "right" }}>
                    {r.percent}%
                  </td>
                  <td style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", textAlign: "right" }}>
                    {r.needs_review ? (
                      <span style={{ color: "var(--muted)" }}>review</span>
                    ) : r.passed ? (
                      <span style={{ color: "#2ea043" }}>pass</span>
                    ) : (
                      <span style={{ color: "#d83a3a" }}>fail</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", textAlign: "right", color: "var(--muted)", fontSize: 12 }}>
                    {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
