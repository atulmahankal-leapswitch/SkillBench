"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  api,
  ApiError,
  Candidate,
  Page,
  Schedule,
  TestSummary,
} from "@/lib/client";
import { useUrlParam } from "@/lib/url";
import {
  Badge,
  Button,
  ErrorText,
  Field,
  inputStyle,
  Modal,
  PageHeader,
} from "@/components/ui";

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function startOfWeek(d: Date): Date {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - s.getDay()); // back to Sunday
  return s;
}

const STATUS_COLOR: Record<string, string> = {
  scheduled: "#4f8cff",
  in_progress: "#d8a23a",
  completed: "#2ea043",
  expired: "#8b949e",
  cancelled: "#d83a3a",
};
const STATUSES = ["scheduled", "in_progress", "completed", "expired", "cancelled"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SchedulesPage() {
  return (
    <Suspense fallback={null}>
      <SchedulesCalendar />
    </Suspense>
  );
}

function SchedulesCalendar() {
  const [weekParam, setWeekParam] = useUrlParam("week", ymd(startOfWeek(new Date())));
  const [statusFilter, setStatusFilter] = useUrlParam("status", "");
  const [urlSearch, setUrlSearch] = useUrlParam("q", "");

  const [items, setItems] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchBox, setSearchBox] = useState(urlSearch);
  const [selected, setSelected] = useState<Schedule | null>(null);
  const [copied, setCopied] = useState(false);

  // Create-schedule modal state.
  const [showForm, setShowForm] = useState(false);
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [testId, setTestId] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");

  const filterKey = `${statusFilter}|${urlSearch}`;

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: "500" });
      if (statusFilter) qs.set("status", statusFilter);
      if (urlSearch) qs.set("q", urlSearch);
      const data = await api.get<Page<Schedule>>(`/schedules?${qs}`);
      setItems(data.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSearchBox(urlSearch);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  // ── Week setup ──────────────────────────────────────────────────────────────
  const weekStart = useMemo(() => {
    const [y, m, d] = weekParam.split("-").map(Number);
    const parsed = y && m && d ? new Date(y, m - 1, d) : new Date();
    return startOfWeek(parsed);
  }, [weekParam]);

  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const weekEnd = days[6];
  const todayKey = ymd(new Date());

  // Schedules in this week, bucketed by "dayKey|hour"; hour range auto-fits.
  const { byCell, hours } = useMemo(() => {
    const startMs = weekStart.getTime();
    const endMs = days[6].getTime() + 24 * 3600 * 1000;
    const cell = new Map<string, Schedule[]>();
    let lo = 9;
    let hi = 17;
    for (const s of items) {
      const d = new Date(s.start_at);
      if (d.getTime() < startMs || d.getTime() >= endMs) continue;
      const k = `${ymd(d)}|${d.getHours()}`;
      (cell.get(k) ?? cell.set(k, []).get(k)!).push(s);
      lo = Math.min(lo, d.getHours());
      hi = Math.max(hi, d.getHours());
    }
    const hrs = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
    return { byCell: cell, hours: hrs };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, weekParam]);

  function shiftWeek(deltaDays: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + deltaDays);
    setWeekParam(ymd(startOfWeek(d)));
  }

  // ── Create / actions ───────────────────────────────────────────────────────
  async function openCreate(prefill?: Schedule) {
    setError(null);
    const [t, c] = await Promise.all([
      api.get<Page<TestSummary>>(`/tests?limit=100`),
      api.get<Page<Candidate>>(`/candidates?limit=100`),
    ]);
    setTests(t.items);
    setCandidates(c.items);
    setTestId(prefill?.test.id ?? "");
    setCandidateId(prefill?.candidate.id ?? "");
    const now = new Date();
    const later = new Date(now.getTime() + 3600 * 1000); // default 1-hour window
    setStartAt(toLocalInput(now));
    setEndAt(toLocalInput(later));
    setSelected(null);
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

  async function act(path: string, s: Schedule, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    try {
      await api.post(`/schedules/${s.id}/${path}`, {});
      setSelected(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Action failed");
    }
  }

  function copyLink(s: Schedule) {
    if (!s.invitation) return;
    navigator.clipboard.writeText(`${window.location.origin}/exam/${s.invitation.token}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const rangeLabel = `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <main>
      <PageHeader
        title="Schedules"
        action={<Button onClick={() => openCreate()}>+ Schedule a test</Button>}
      />

      {/* Toolbar: week nav + search + status filter */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <Button variant="ghost" onClick={() => shiftWeek(-7)}>‹</Button>
        <strong style={{ minWidth: 170, textAlign: "center" }}>{rangeLabel}</strong>
        <Button variant="ghost" onClick={() => shiftWeek(7)}>›</Button>
        <Button variant="ghost" onClick={() => setWeekParam(ymd(startOfWeek(new Date())))}>
          Today
        </Button>
        <div style={{ flex: 1 }} />
        <input
          style={{ ...inputStyle, maxWidth: 220 }}
          placeholder="Search candidate or test…"
          value={searchBox}
          onChange={(e) => setSearchBox(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setUrlSearch(searchBox.trim())}
        />
        <Button variant="ghost" onClick={() => setUrlSearch(searchBox.trim())}>Search</Button>
        <select
          style={{ ...inputStyle, maxWidth: 160 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
      </div>

      <ErrorText message={!showForm ? error : null} />

      {/* Week grid: time column + 7 days */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "auto",
        }}
      >
        <div style={{ minWidth: 760 }}>
          {/* Header row */}
          <div style={{ display: "grid", gridTemplateColumns: "64px repeat(7, 1fr)", borderBottom: "1px solid var(--border)" }}>
            <div />
            {days.map((d) => {
              const isToday = ymd(d) === todayKey;
              return (
                <div
                  key={ymd(d)}
                  style={{
                    padding: "8px 6px",
                    textAlign: "center",
                    borderLeft: "1px solid var(--border)",
                    background: isToday ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
                  }}
                >
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {WEEKDAYS[d.getDay()]}
                  </div>
                  <div style={{ fontWeight: isToday ? 700 : 500, color: isToday ? "var(--accent)" : "var(--fg)" }}>
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hour rows */}
          {hours.map((h) => (
            <div
              key={h}
              style={{ display: "grid", gridTemplateColumns: "64px repeat(7, 1fr)", borderBottom: "1px solid var(--border)" }}
            >
              <div style={{ padding: "6px 8px", fontSize: 11, color: "var(--muted)", textAlign: "right" }}>
                {h % 12 === 0 ? 12 : h % 12}
                {h < 12 ? "am" : "pm"}
              </div>
              {days.map((d) => {
                const cellItems = byCell.get(`${ymd(d)}|${h}`) ?? [];
                return (
                  <div
                    key={ymd(d) + h}
                    style={{ minHeight: 52, padding: 4, borderLeft: "1px solid var(--border)" }}
                  >
                    {cellItems.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSelected(s)}
                        title={`${s.candidate.full_name} · ${s.test.title} · ${s.status}`}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          border: "none",
                          cursor: "pointer",
                          borderRadius: 6,
                          padding: "3px 6px",
                          marginBottom: 3,
                          fontSize: 11,
                          lineHeight: 1.3,
                          color: "#fff",
                          background: STATUS_COLOR[s.status] ?? "#4f8cff",
                          textDecoration: s.status === "cancelled" ? "line-through" : "none",
                          opacity: s.status === "cancelled" || s.status === "expired" ? 0.8 : 1,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{s.candidate.full_name}</span>
                        <span style={{ display: "block", opacity: 0.9, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {s.test.title}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {loading && (
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>Loading…</p>
      )}
      {!loading && items.length === 0 && (
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>
          No schedules match.
        </p>
      )}

      {/* Schedule detail + actions */}
      {selected && (
        <Modal title="Schedule" onClose={() => setSelected(null)}>
          <p style={{ margin: "0 0 4px" }}>
            <strong>{selected.candidate.full_name}</strong>{" "}
            <span style={{ color: "var(--muted)" }}>{selected.candidate.email}</span>
          </p>
          <p style={{ margin: "0 0 4px" }}>{selected.test.title}</p>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>
            {new Date(selected.start_at).toLocaleString()} →{" "}
            {new Date(selected.end_at).toLocaleString()}
          </p>
          {selected.finished_at && (
            <p style={{ color: "var(--muted)", fontSize: 13, margin: "2px 0 0" }}>
              Completed {new Date(selected.finished_at).toLocaleString()}
            </p>
          )}
          <p style={{ marginBottom: 14 }}>
            <Badge>{selected.status}</Badge>
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {selected.attempt_id && (
              <Link
                href={`/admin/results/${selected.attempt_id}`}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  background: "var(--accent)",
                  color: "#fff",
                  textDecoration: "none",
                }}
              >
                View result →
              </Link>
            )}
            <Button variant="ghost" onClick={() => copyLink(selected)}>{copied ? "Copied!" : "Copy link"}</Button>
            {(selected.status === "scheduled" || selected.status === "in_progress") && (
              <>
                <Button variant="ghost" onClick={() => act("resend", selected)}>Resend</Button>
                <Button
                  variant="danger"
                  onClick={() => act("cancel", selected, "Cancel this schedule and revoke its invite?")}
                >
                  Cancel
                </Button>
              </>
            )}
            {(selected.status === "completed" || selected.status === "expired" || selected.status === "cancelled") && (
              <Button variant="ghost" onClick={() => openCreate(selected)}>Reschedule</Button>
            )}
          </div>
        </Modal>
      )}

      {/* Create / reschedule modal */}
      {showForm && (
        <Modal title="Schedule a test" onClose={() => setShowForm(false)}>
          <ErrorText message={error} />
          <Field label="Test">
            <select style={inputStyle} value={testId} onChange={(e) => setTestId(e.target.value)}>
              <option value="">Select a test…</option>
              {tests.map((t) => (
                <option key={t.id} value={t.id}>{t.title} ({t.duration_minutes} min)</option>
              ))}
            </select>
          </Field>
          <Field label="Candidate">
            <select style={inputStyle} value={candidateId} onChange={(e) => setCandidateId(e.target.value)}>
              <option value="">Select a candidate…</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>{c.full_name} — {c.email}</option>
              ))}
            </select>
          </Field>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <Field label="Start">
                <input type="datetime-local" style={inputStyle} value={startAt} onChange={(e) => setStartAt(e.target.value)} />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="End">
                <input type="datetime-local" style={inputStyle} value={endAt} onChange={(e) => setEndAt(e.target.value)} />
              </Field>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={save} disabled={!testId || !candidateId || !startAt || !endAt}>
              Schedule & invite
            </Button>
          </div>
        </Modal>
      )}
    </main>
  );
}
