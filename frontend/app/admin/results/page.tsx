"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { browserApiBase } from "@/lib/api";
import { api, ApiError, Page, ResultSummary, TestSummary } from "@/lib/client";
import { Badge, Button, ErrorText, inputStyle, PageHeader, td, th } from "@/components/ui";

type SortKey = "finished" | "candidate" | "test" | "score";
type ResultFilter = "" | "passed" | "failed" | "needs_review";

export default function ResultsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ResultSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [result, setResult] = useState<ResultFilter>("");
  const [minScore, setMinScore] = useState("");
  const [sort, setSort] = useState<SortKey>("finished");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [testMenu, setTestMenu] = useState(false);

  useEffect(() => {
    api
      .get<Page<TestSummary>>(`/tests?limit=100`)
      .then((d) => setTests(d.items))
      .catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q.trim()) p.set("q", q.trim());
      if (result) p.set("result", result);
      if (minScore !== "") p.set("min_percent", minScore);
      selectedTests.forEach((id) => p.append("test_id", id));
      p.set("sort", sort);
      p.set("order", order);
      const data = await api.get<Page<ResultSummary>>(`/results?${p.toString()}`);
      setItems(data.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  // Reload on any filter/sort change (debounced for the text inputs).
  const first = useRef(true);
  useEffect(() => {
    const delay = first.current ? 0 : 300;
    first.current = false;
    const t = setTimeout(load, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, selectedTests, result, minScore, sort, order]);

  function toggleSort(key: SortKey) {
    if (sort === key) setOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setOrder(key === "candidate" || key === "test" ? "asc" : "desc");
    }
  }

  function toggleTest(id: string) {
    setSelectedTests((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const arrow = (key: SortKey) => (sort === key ? (order === "asc" ? " ▲" : " ▼") : "");
  const sortTh = (key: SortKey): React.CSSProperties => ({
    ...th,
    cursor: "pointer",
    userSelect: "none",
    color: sort === key ? "var(--fg)" : undefined,
  });

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

      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <input
          style={{ ...inputStyle, maxWidth: 240 }}
          placeholder="Search candidate name or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        {/* Multiple test filter (checkboxes) */}
        <div style={{ position: "relative" }}>
          <Button variant="ghost" onClick={() => setTestMenu((v) => !v)}>
            Tests{selectedTests.length ? ` (${selectedTests.length})` : ""} ▾
          </Button>
          {testMenu && (
            <>
              <div
                onClick={() => setTestMenu(false)}
                style={{ position: "fixed", inset: 0, zIndex: 30 }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  zIndex: 31,
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 10,
                  minWidth: 240,
                  maxHeight: 320,
                  overflowY: "auto",
                  boxShadow: "0 8px 24px rgba(0,0,0,.35)",
                }}
              >
                {tests.length === 0 && (
                  <div style={{ color: "var(--muted)", fontSize: 13 }}>No tests</div>
                )}
                {tests.map((t) => (
                  <label
                    key={t.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "5px 4px",
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTests.includes(t.id)}
                      onChange={() => toggleTest(t.id)}
                    />
                    {t.title}
                  </label>
                ))}
                {selectedTests.length > 0 && (
                  <button
                    onClick={() => setSelectedTests([])}
                    style={{
                      marginTop: 6,
                      background: "transparent",
                      border: "none",
                      color: "var(--accent)",
                      cursor: "pointer",
                      fontSize: 13,
                      padding: "4px 0",
                    }}
                  >
                    Clear selection
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <select
          style={{ ...inputStyle, maxWidth: 170 }}
          value={result}
          onChange={(e) => setResult(e.target.value as ResultFilter)}
        >
          <option value="">All results</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
          <option value="needs_review">Needs review</option>
        </select>

        <input
          type="number"
          min={0}
          max={100}
          style={{ ...inputStyle, maxWidth: 130 }}
          placeholder="Min score %"
          value={minScore}
          onChange={(e) => setMinScore(e.target.value)}
        />

        {(q || selectedTests.length || result || minScore) && (
          <Button
            variant="ghost"
            onClick={() => {
              setQ("");
              setSelectedTests([]);
              setResult("");
              setMinScore("");
            }}
          >
            Reset
          </Button>
        )}
      </div>

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
              <th style={sortTh("candidate")} onClick={() => toggleSort("candidate")}>
                Candidate{arrow("candidate")}
              </th>
              <th style={sortTh("test")} onClick={() => toggleSort("test")}>
                Test{arrow("test")}
              </th>
              <th style={sortTh("score")} onClick={() => toggleSort("score")}>
                Score{arrow("score")}
              </th>
              <th style={th}>Result</th>
              <th style={sortTh("finished")} onClick={() => toggleSort("finished")}>
                Finished{arrow("finished")}
              </th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td style={td} colSpan={6}>
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td style={{ ...td, color: "var(--muted)" }} colSpan={6}>
                  No matching results.
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
                  <td style={{ ...td, color: "var(--muted)", whiteSpace: "nowrap" }}>
                    {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "—"}
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
