"use client";

import { useEffect, useState } from "react";
import { browserApiBase } from "@/lib/api";
import {
  api,
  ApiError,
  Page,
  QuestionResult,
  ResultDetail,
  ResultSummary,
} from "@/lib/client";
import {
  Badge,
  Button,
  ErrorText,
  inputStyle,
  Modal,
  PageHeader,
  td,
  th,
} from "@/components/ui";

function respText(r: Record<string, unknown>): string {
  if (r.text) return String(r.text);
  if (r.selected_keys) return (r.selected_keys as string[]).join(", ");
  if (r.code) return String(r.code);
  return JSON.stringify(r);
}

export default function ResultsPage() {
  const [items, setItems] = useState<ResultSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<ResultDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [proctor, setProctor] = useState<{
    events: { id: string; type: string; at: string; has_image: boolean }[];
    summary: Record<string, number>;
  } | null>(null);
  const [integrity, setIntegrity] = useState<{
    risk_score: number;
    level: string;
    max_similarity: number;
    matches: { question_id: string; max_similarity: number; flagged: boolean }[];
  } | null>(null);

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

  async function open(attemptId: string) {
    setError(null);
    try {
      const d = await api.get<ResultDetail>(`/results/${attemptId}`);
      setDetail(d);
      const ov: Record<string, string> = {};
      const fb: Record<string, string> = {};
      d.questions.forEach((q) => {
        ov[q.id] = String(q.points_awarded);
        fb[q.id] = q.feedback;
      });
      setOverrides(ov);
      setFeedbacks(fb);
      try {
        setProctor(await api.get(`/results/${attemptId}/proctor`));
      } catch {
        setProctor(null);
      }
      try {
        setIntegrity(await api.get(`/results/${attemptId}/integrity`));
      } catch {
        setIntegrity(null);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load detail");
    }
  }

  async function viewSnapshot(eventId: string) {
    if (!detail) return;
    try {
      const r = await api.get<{ image: string }>(
        `/results/${detail.attempt_id}/proctor/${eventId}/image`
      );
      const w = window.open();
      if (w) w.document.write(`<img src="${r.image}" />`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Snapshot failed");
    }
  }

  async function saveOverride(q: QuestionResult) {
    if (!detail) return;
    try {
      const d = await api.patch<ResultDetail>(
        `/results/${detail.attempt_id}/questions/${q.id}`,
        {
          points_awarded: Number(overrides[q.id]),
          feedback: feedbacks[q.id] ?? "",
        }
      );
      setDetail(d);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Override failed");
    }
  }

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
                <tr key={r.attempt_id}>
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
                      <span style={{ color: "#7ee787" }}>Passed</span>
                    ) : (
                      <span style={{ color: "#ff8a8a" }}>Failed</span>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <Button variant="ghost" onClick={() => open(r.attempt_id)}>
                      View
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {detail && (
        <Modal
          title={`${detail.candidate_name} — ${detail.test_title}`}
          onClose={() => setDetail(null)}
        >
          <p style={{ color: "var(--muted)" }}>
            {detail.total_points}/{detail.max_points} ({detail.percent}%) · pass
            mark {detail.pass_mark}% ·{" "}
            {detail.needs_review ? (
              <Badge>needs review</Badge>
            ) : detail.passed ? (
              <span style={{ color: "#7ee787" }}>Passed</span>
            ) : (
              <span style={{ color: "#ff8a8a" }}>Failed</span>
            )}
          </p>

          {detail.questions.map((q, i) => (
            <div
              key={q.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 12,
                marginBottom: 10,
              }}
            >
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                Q{i + 1} · {q.type} ·{" "}
                {q.is_correct === true
                  ? "✅"
                  : q.is_correct === false
                    ? "❌"
                    : "—"}{" "}
                {q.points_awarded}/{q.max_points}
              </div>
              <div style={{ margin: "6px 0", whiteSpace: "pre-wrap" }}>
                {q.prompt}
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                Response: <code>{respText(q.response)}</code>
              </div>
              {(q.type === "mcq" || q.type === "multi_select") &&
                Array.isArray(q.payload.correct_keys) && (
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>
                    Correct: {(q.payload.correct_keys as string[]).join(", ")}
                  </div>
                )}
              {(q.needs_review || q.type === "text" || q.type === "coding") && (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 8,
                    alignItems: "center",
                  }}
                >
                  <input
                    type="number"
                    style={{ ...inputStyle, width: 90 }}
                    value={overrides[q.id] ?? ""}
                    onChange={(e) =>
                      setOverrides({ ...overrides, [q.id]: e.target.value })
                    }
                  />
                  <input
                    style={inputStyle}
                    placeholder="Feedback (optional)"
                    value={feedbacks[q.id] ?? ""}
                    onChange={(e) =>
                      setFeedbacks({ ...feedbacks, [q.id]: e.target.value })
                    }
                  />
                  <Button onClick={() => saveOverride(q)}>Save</Button>
                </div>
              )}
            </div>
          ))}

          {integrity && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 16 }}>Integrity</h3>
              <p style={{ fontSize: 14 }}>
                Risk:{" "}
                <strong
                  style={{
                    color:
                      integrity.level === "high"
                        ? "#ff8a8a"
                        : integrity.level === "medium"
                          ? "#ffcf6b"
                          : "#7ee787",
                  }}
                >
                  {integrity.level} ({integrity.risk_score}/100)
                </strong>{" "}
                · max similarity {Math.round(integrity.max_similarity * 100)}%
              </p>
              {integrity.matches.filter((m) => m.flagged).length > 0 && (
                <p style={{ color: "#ffb4b4", fontSize: 13 }}>
                  ⚠ {integrity.matches.filter((m) => m.flagged).length} answer(s)
                  highly similar to another submission.
                </p>
              )}
            </div>
          )}

          {proctor && proctor.events.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 16 }}>Proctoring</h3>
              <p style={{ color: "var(--muted)", fontSize: 13 }}>
                {Object.entries(proctor.summary)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ")}
              </p>
              <div style={{ maxHeight: 180, overflow: "auto" }}>
                {proctor.events.map((e) => (
                  <div
                    key={e.id}
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                      padding: "2px 0",
                    }}
                  >
                    {new Date(e.at).toLocaleTimeString()} — {e.type}
                    {e.has_image && (
                      <>
                        {" "}
                        <a
                          href="#"
                          onClick={(ev) => {
                            ev.preventDefault();
                            viewSnapshot(e.id);
                          }}
                        >
                          view snapshot
                        </a>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>
      )}
    </main>
  );
}
