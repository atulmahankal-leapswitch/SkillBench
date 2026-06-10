"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserApiBase } from "@/lib/api";
import { api, ApiError, Page, ResultSummary } from "@/lib/client";
import { Badge, Button, ErrorText, PageHeader, td, th } from "@/components/ui";

export default function ResultsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ResultSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Page<ResultSummary>>(`/results`);
      setItems(data.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main>
      <PageHeader
        title="Results"
        action={
          <a href={`${browserApiBase}/api/results/export.csv`}>
            <Button variant="ghost">Export CSV</Button>
          </a>
        }
      />
      <ErrorText message={error} />

      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Candidate</th>
              <th style={th}>Test</th>
              <th style={th}>Score</th>
              <th style={th}>Result</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td style={td} colSpan={5}>
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td style={{ ...td, color: "var(--muted)" }} colSpan={5}>
                  No submitted attempts yet.
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr
                  key={r.attempt_id}
                  onClick={() => router.push(`/admin/results/${r.attempt_id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <td style={td}>
                    {r.candidate_name}
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>
                      {r.candidate_email}
                    </div>
                  </td>
                  <td style={td}>{r.test_title}</td>
                  <td style={td}>
                    {r.total_points}/{r.max_points} ({r.percent}%)
                  </td>
                  <td style={td}>
                    {r.needs_review ? (
                      <Badge>needs review</Badge>
                    ) : r.passed ? (
                      <span style={{ color: "#2ea043" }}>Passed</span>
                    ) : (
                      <span style={{ color: "#d83a3a" }}>Failed</span>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <Button
                      variant="ghost"
                      onClick={() => router.push(`/admin/results/${r.attempt_id}`)}
                    >
                      View
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
