"use client";

import { useEffect, useState } from "react";
import { api, ApiError, Page, TestSummary } from "@/lib/client";
import { Button, ErrorText, inputStyle, PageHeader } from "@/components/ui";

type Overview = {
  candidates: number;
  tests: number;
  attempts: number;
  graded: number;
  avg_percent: number;
  pass_rate: number;
  needs_review: number;
};

type TestStats = {
  title: string;
  pass_mark: number;
  attempts: number;
  avg_percent: number;
  median_percent: number;
  min_percent: number;
  max_percent: number;
  pass_rate: number;
  avg_duration_seconds: number;
  distribution: number[];
};

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 18,
        minWidth: 130,
      }}
    >
      <div style={{ color: "var(--muted)", fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [ov, setOv] = useState<Overview | null>(null);
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [testId, setTestId] = useState("");
  const [stats, setStats] = useState<TestStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setOv(await api.get<Overview>("/analytics/overview"));
        setTests((await api.get<Page<TestSummary>>("/tests?limit=100")).items);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Failed to load");
      }
    })();
  }, []);

  async function loadTest(id: string) {
    setTestId(id);
    setStats(null);
    if (!id) return;
    try {
      setStats(await api.get<TestStats>(`/analytics/tests/${id}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load test stats");
    }
  }

  const maxBucket = stats ? Math.max(1, ...stats.distribution) : 1;

  return (
    <main>
      <PageHeader title="Analytics" />
      <ErrorText message={error} />

      {ov && (
        <section
          style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 28 }}
        >
          <Card label="Candidates" value={ov.candidates} />
          <Card label="Tests" value={ov.tests} />
          <Card label="Attempts" value={ov.attempts} />
          <Card label="Avg score" value={`${ov.avg_percent}%`} />
          <Card label="Pass rate" value={`${ov.pass_rate}%`} />
          <Card label="Needs review" value={ov.needs_review} />
        </section>
      )}

      <h2 style={{ fontSize: 18 }}>Per-test benchmarking</h2>
      <select
        style={{ ...inputStyle, maxWidth: 320, marginBottom: 16 }}
        value={testId}
        onChange={(e) => loadTest(e.target.value)}
      >
        <option value="">Select a test…</option>
        {tests.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title}
          </option>
        ))}
      </select>

      {stats && (
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
            <Card label="Attempts" value={stats.attempts} />
            <Card label="Avg" value={`${stats.avg_percent}%`} />
            <Card label="Median" value={`${stats.median_percent}%`} />
            <Card label="Min / Max" value={`${stats.min_percent}/${stats.max_percent}`} />
            <Card label="Pass rate" value={`${stats.pass_rate}%`} />
            <Card
              label="Avg time"
              value={`${Math.round(stats.avg_duration_seconds / 60)}m`}
            />
          </div>

          <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 6 }}>
            Score distribution (deciles)
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 140 }}>
            {stats.distribution.map((count, i) => (
              <div
                key={i}
                style={{ flex: 1, textAlign: "center" }}
                title={`${i * 10}–${i * 10 + 10}%: ${count}`}
              >
                <div
                  style={{
                    height: `${(count / maxBucket) * 110}px`,
                    background: "var(--accent)",
                    borderRadius: "4px 4px 0 0",
                  }}
                />
                <div style={{ fontSize: 10, color: "var(--muted)" }}>{i * 10}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
