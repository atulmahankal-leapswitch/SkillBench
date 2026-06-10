"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError, QuestionResult, ResultDetail } from "@/lib/client";
import { Badge, Button, ErrorText, inputStyle } from "@/components/ui";

type Integrity = {
  risk_score: number;
  level: string;
  max_similarity: number;
  proctoring: Record<string, number>;
  matches: { question_id: string; max_similarity: number; flagged: boolean }[];
};
type Proctor = {
  events: { id: string; type: string; at: string; has_image: boolean }[];
  summary: Record<string, number>;
};

const DIFFS = ["easy", "medium", "hard"] as const;

function optStyle(correct: boolean, selectedWrong: boolean): React.CSSProperties {
  const border = correct
    ? "2px solid #2ea043"
    : selectedWrong
      ? "2px solid #d83a3a"
      : "1px solid var(--border)";
  return { border, borderRadius: 8, padding: "8px 10px", marginBottom: 6 };
}

const card: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 18,
  marginBottom: 16,
};
const sectionTitle: React.CSSProperties = { margin: "0 0 12px", fontSize: 16 };

export default function ResultDetailPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = use(params);
  return (
    <Suspense fallback={null}>
      <ResultDetailInner attemptId={attemptId} />
    </Suspense>
  );
}

function ResultDetailInner({ attemptId }: { attemptId: string }) {
  const [d, setD] = useState<ResultDetail | null>(null);
  const [integrity, setIntegrity] = useState<Integrity | null>(null);
  const [proctor, setProctor] = useState<Proctor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});

  async function load() {
    try {
      const det = await api.get<ResultDetail>(`/results/${attemptId}`);
      setD(det);
      const ov: Record<string, string> = {};
      const fb: Record<string, string> = {};
      det.questions.forEach((q) => {
        ov[q.id] = String(q.points_awarded);
        fb[q.id] = q.feedback;
      });
      setOverrides(ov);
      setFeedbacks(fb);
      api.get<Integrity>(`/results/${attemptId}/integrity`).then(setIntegrity).catch(() => {});
      api.get<Proctor>(`/results/${attemptId}/proctor`).then(setProctor).catch(() => {});
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load");
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  async function saveOverride(q: QuestionResult) {
    try {
      const det = await api.patch<ResultDetail>(
        `/results/${attemptId}/questions/${q.id}`,
        { points_awarded: Number(overrides[q.id]), feedback: feedbacks[q.id] ?? "" }
      );
      setD(det);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Override failed");
    }
  }

  async function viewSnapshot(eventId: string) {
    try {
      const r = await api.get<{ image: string }>(
        `/results/${attemptId}/proctor/${eventId}/image`
      );
      const w = window.open();
      if (w) w.document.write(`<img src="${r.image}" style="max-width:100%" />`);
    } catch {
      /* ignore */
    }
  }

  if (error) return <main style={{ padding: 24 }}><ErrorText message={error} /></main>;
  if (!d) return <main style={{ padding: 24 }}>Loading…</main>;

  const correct = d.questions.filter((q) => q.is_correct === true).length;
  const when = d.submitted_at ?? d.graded_at;

  // --- Remarks breakdown: Category × Easy/Medium/Hard (correct/given) ---------
  type Cell = { correct: number; given: number };
  const blank = (): Cell => ({ correct: 0, given: 0 });
  const byCat = new Map<string, { diffs: Record<string, Cell>; total: Cell }>();
  for (const q of d.questions) {
    const cat = q.category || "Uncategorized";
    const diff = (q.difficulty || "").toLowerCase();
    if (!byCat.has(cat)) {
      byCat.set(cat, { diffs: { easy: blank(), medium: blank(), hard: blank() }, total: blank() });
    }
    const row = byCat.get(cat)!;
    const cell = row.diffs[diff] ?? (row.diffs[diff] = blank());
    cell.given += 1;
    row.total.given += 1;
    if (q.is_correct === true) {
      cell.correct += 1;
      row.total.correct += 1;
    }
  }
  const fmt = (c: Cell) => `${c.correct}/${c.given}`;
  const cellStyle: React.CSSProperties = { padding: "8px 12px", borderTop: "1px solid var(--border)" };
  const headCell: React.CSSProperties = { padding: "8px 12px", textAlign: "left", color: "var(--muted)", fontWeight: 600, fontSize: 13 };

  return (
    <main style={{ maxWidth: 900, margin: "0 auto" }}>
      <Link href="/admin/results" style={{ fontSize: 13 }}>
        ← Back to results
      </Link>

      <h1 style={{ margin: "10px 0 2px", fontSize: 24 }}>
        {d.candidate_name} : {d.test_title}
      </h1>
      <div style={{ color: "var(--muted)", marginBottom: 18 }}>
        {when ? new Date(when).toLocaleString() : "—"} ·{" "}
        <strong>{correct}/{d.questions.length}</strong> · {d.percent}% ·{" "}
        {d.needs_review ? (
          <Badge>needs review</Badge>
        ) : d.passed ? (
          <span style={{ color: "#2ea043" }}>Passed</span>
        ) : (
          <span style={{ color: "#d83a3a" }}>Failed</span>
        )}{" "}
        <span style={{ color: "var(--muted)" }}>(pass {d.pass_mark}%)</span>
      </div>

      {/* Remarks — per-category score by difficulty */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h3 style={sectionTitle}>Remarks</h3>
          <span style={{ color: "var(--muted)", fontSize: 12 }}>correct / given</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <th style={headCell}>Category</th>
                {DIFFS.map((dlbl) => (
                  <th key={dlbl} style={{ ...headCell, textTransform: "capitalize" }}>{dlbl}</th>
                ))}
                <th style={headCell}>Total</th>
              </tr>
            </thead>
            <tbody>
              {[...byCat.entries()].map(([cat, row]) => (
                <tr key={cat}>
                  <td style={cellStyle}>{cat}</td>
                  {DIFFS.map((dlbl) => (
                    <td key={dlbl} style={cellStyle}>{fmt(row.diffs[dlbl])}</td>
                  ))}
                  <td style={{ ...cellStyle, fontWeight: 600 }}>{fmt(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Integrity */}
      <div style={card}>
        <h3 style={sectionTitle}>Integrity</h3>
        {integrity ? (
          <>
            <p style={{ margin: "0 0 6px" }}>
              Risk:{" "}
              <strong
                style={{
                  color:
                    integrity.level === "high"
                      ? "#d83a3a"
                      : integrity.level === "medium"
                        ? "#d8a23a"
                        : "#2ea043",
                }}
              >
                {integrity.level} ({integrity.risk_score}/100)
              </strong>{" "}
              · max similarity {Math.round(integrity.max_similarity * 100)}%
            </p>
            {proctor && proctor.events.length > 0 && (
              <>
                <div style={{ color: "var(--muted)", fontSize: 13 }}>
                  {Object.entries(proctor.summary).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                </div>
                <div style={{ maxHeight: 160, overflow: "auto", marginTop: 6 }}>
                  {proctor.events.map((e) => (
                    <div key={e.id} style={{ fontSize: 12, color: "var(--muted)" }}>
                      {new Date(e.at).toLocaleTimeString()} — {e.type}
                      {e.has_image && (
                        <>
                          {" "}
                          <a href="#" onClick={(ev) => { ev.preventDefault(); viewSnapshot(e.id); }}>
                            snapshot
                          </a>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <p style={{ color: "var(--muted)", margin: 0 }}>No integrity data.</p>
        )}
      </div>

      {/* Questions */}
      <h3 style={{ fontSize: 16, margin: "0 0 12px" }}>Questions</h3>
      {d.questions.map((q, i) => {
        const options = (q.payload.options as { key: string; text: string }[]) ?? [];
        const correctKeys = (q.payload.correct_keys as string[]) ?? [];
        const selected = (q.response.selected_keys as string[]) ?? [];
        return (
          <div key={q.id} style={card}>
            <div style={{ color: "var(--muted)", fontSize: 13, display: "flex", justifyContent: "space-between" }}>
              <span>
                Q{i + 1} · {q.type}
                {q.category ? ` · ${q.category}` : ""}
                {q.difficulty ? ` · ${q.difficulty}` : ""}
              </span>
              <span>
                {q.points_awarded}/{q.max_points} pts{" "}
                {q.is_correct === true ? "✅" : q.is_correct === false ? "❌" : ""}
              </span>
            </div>
            <div style={{ fontSize: 16, margin: "6px 0 12px", whiteSpace: "pre-wrap" }}>
              {q.prompt}
            </div>

            {options.length > 0 ? (
              options.map((o) => {
                const isCorrect = correctKeys.includes(o.key);
                const isSelectedWrong = selected.includes(o.key) && !isCorrect;
                return (
                  <div key={o.key} style={optStyle(isCorrect, isSelectedWrong)}>
                    {selected.includes(o.key) ? "◉" : "○"} {o.text}
                    {isCorrect && <span style={{ color: "#2ea043", fontSize: 12 }}> · correct</span>}
                    {isSelectedWrong && (
                      <span style={{ color: "#d83a3a", fontSize: 12 }}> · candidate&apos;s choice</span>
                    )}
                  </div>
                );
              })
            ) : (
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  background: "var(--bg)",
                  border: `2px solid ${q.is_correct === true ? "#2ea043" : q.is_correct === false ? "#d83a3a" : "var(--border)"}`,
                  borderRadius: 8,
                  padding: 10,
                  fontSize: 13,
                }}
              >
                {String(q.response.text ?? q.response.code ?? "(no answer)")}
              </pre>
            )}

            {/* Admin grade override + remark */}
            <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
              <input
                type="number"
                title="Points awarded"
                style={{ ...inputStyle, width: 90 }}
                value={overrides[q.id] ?? ""}
                onChange={(e) => setOverrides({ ...overrides, [q.id]: e.target.value })}
              />
              <input
                style={inputStyle}
                placeholder="Feedback / remark"
                value={feedbacks[q.id] ?? ""}
                onChange={(e) => setFeedbacks({ ...feedbacks, [q.id]: e.target.value })}
              />
              <Button onClick={() => saveOverride(q)}>Save</Button>
              {q.needs_review && <Badge>needs review</Badge>}
            </div>
          </div>
        );
      })}
    </main>
  );
}
