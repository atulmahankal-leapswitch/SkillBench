"use client";

import { useEffect, useState } from "react";
import {
  api,
  ApiError,
  Candidate,
  Page,
  Schedule,
  TestSummary,
} from "@/lib/client";
import {
  Badge,
  Button,
  ErrorText,
  Field,
  inputStyle,
  Modal,
  PageHeader,
  td,
  th,
} from "@/components/ui";

function toLocalInput(d: Date): string {
  // yyyy-MM-ddThh:mm for <input type=datetime-local>
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function SchedulesPage() {
  const [items, setItems] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [testId, setTestId] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Page<Schedule>>(`/schedules`);
      setItems(data.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openCreate() {
    setError(null);
    const [t, c] = await Promise.all([
      api.get<Page<TestSummary>>(`/tests?limit=100`),
      api.get<Page<Candidate>>(`/candidates?limit=100`),
    ]);
    setTests(t.items);
    setCandidates(c.items);
    setTestId("");
    setCandidateId("");
    const now = new Date();
    const later = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    setStartAt(toLocalInput(now));
    setEndAt(toLocalInput(later));
    setShowForm(true);
  }

  async function reschedule(s: Schedule) {
    setError(null);
    const [t, c] = await Promise.all([
      api.get<Page<TestSummary>>(`/tests?limit=100`),
      api.get<Page<Candidate>>(`/candidates?limit=100`),
    ]);
    setTests(t.items);
    setCandidates(c.items);
    setTestId(s.test.id);
    setCandidateId(s.candidate.id);
    const now = new Date();
    const later = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    setStartAt(toLocalInput(now));
    setEndAt(toLocalInput(later));
    setShowForm(true);
  }

  async function save() {
    setError(null);
    try {
      await api.post(`/schedules`, {
        test_id: testId,
        candidate_id: candidateId,
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
      });
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Save failed");
    }
  }

  async function cancel(s: Schedule) {
    if (!confirm("Cancel this schedule and revoke its invite?")) return;
    try {
      await api.post(`/schedules/${s.id}/cancel`, {});
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Cancel failed");
    }
  }

  async function resend(s: Schedule) {
    try {
      await api.post(`/schedules/${s.id}/resend`, {});
      await load();
      alert("Invitation re-sent.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Resend failed");
    }
  }

  function copyLink(s: Schedule) {
    if (!s.invitation) return;
    const url = `${window.location.origin}/exam/${s.invitation.token}`;
    navigator.clipboard?.writeText(url);
    // Show "Copied" on this row's button briefly, then revert (no alert).
    setCopiedId(s.id);
    setTimeout(() => setCopiedId((c) => (c === s.id ? null : c)), 1500);
  }

  return (
    <main>
      <PageHeader
        title="Schedules"
        action={<Button onClick={openCreate}>+ Schedule a test</Button>}
      />
      <ErrorText message={!showForm ? error : null} />

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
              <th style={th}>Window</th>
              <th style={th}>Status</th>
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
                  No schedules yet.
                </td>
              </tr>
            ) : (
              items.map((s) => (
                <tr key={s.id}>
                  <td style={td}>
                    {s.candidate.full_name}
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>
                      {s.candidate.email}
                    </div>
                  </td>
                  <td style={td}>{s.test.title}</td>
                  <td style={{ ...td, fontSize: 12 }}>
                    {new Date(s.start_at).toLocaleString()}
                    <br />→ {new Date(s.end_at).toLocaleString()}
                  </td>
                  <td style={td}>
                    <Badge>{s.status}</Badge>
                  </td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    <Button variant="ghost" onClick={() => copyLink(s)}>
                      {copiedId === s.id ? "Copied" : "Copy link"}
                    </Button>{" "}
                    {s.status === "scheduled" || s.status === "in_progress" ? (
                      <>
                        <Button variant="ghost" onClick={() => resend(s)}>
                          Resend
                        </Button>{" "}
                        <Button variant="danger" onClick={() => cancel(s)}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button variant="ghost" onClick={() => reschedule(s)}>
                        Reschedule
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title="Schedule a test" onClose={() => setShowForm(false)}>
          <ErrorText message={error} />
          <Field label="Test">
            <select
              style={inputStyle}
              value={testId}
              onChange={(e) => setTestId(e.target.value)}
            >
              <option value="">Select a test…</option>
              {tests.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.duration_minutes} min)
                </option>
              ))}
            </select>
          </Field>
          <Field label="Candidate">
            <select
              style={inputStyle}
              value={candidateId}
              onChange={(e) => setCandidateId(e.target.value)}
            >
              <option value="">Select a candidate…</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} — {c.email}
                </option>
              ))}
            </select>
          </Field>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <Field label="Start">
                <input
                  type="datetime-local"
                  style={inputStyle}
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="End">
                <input
                  type="datetime-local"
                  style={inputStyle}
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                />
              </Field>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={!testId || !candidateId || !startAt || !endAt}
            >
              Schedule & invite
            </Button>
          </div>
        </Modal>
      )}
    </main>
  );
}
