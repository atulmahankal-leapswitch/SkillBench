"use client";

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
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

// Status → colour (mirrors the recruit-ai scheme).
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
  const [monthParam, setMonthParam] = useUrlParam("month", monthKey(new Date()));
  const [statusFilter, setStatusFilter] = useUrlParam("status", "");
  const [urlSearch, setUrlSearch] = useUrlParam("q", "");

  const [items, setItems] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchBox, setSearchBox] = useState(urlSearch);
  const [selected, setSelected] = useState<Schedule | null>(null);

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

  // ── Month grid (6 weeks) ───────────────────────────────────────────────────
  const [yy, mm] = monthParam.split("-").map(Number);
  const monthDate = new Date(yy || new Date().getFullYear(), (mm || 1) - 1, 1);
  const todayKey = ymd(new Date());

  const byDay = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    for (const s of items) {
      const key = ymd(new Date(s.start_at));
      (map.get(key) ?? map.set(key, []).get(key)!).push(s);
    }
    return map;
  }, [items]);

  const cells: Date[] = [];
  const start = new Date(monthDate);
  start.setDate(1 - monthDate.getDay()); // back to Sunday
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }

  function shiftMonth(delta: number) {
    const d = new Date(monthDate);
    d.setMonth(d.getMonth() + delta);
    setMonthParam(monthKey(d));
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
    const later = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
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
    alert("Invite link copied.");
  }

  const monthLabel = monthDate.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <main>
      <PageHeader
        title="Schedules"
        action={<Button onClick={() => openCreate()}>+ Schedule a test</Button>}
      />

      {/* Toolbar: month nav + search + status filter */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <Button variant="ghost" onClick={() => shiftMonth(-1)}>
          ‹
        </Button>
        <strong style={{ minWidth: 150, textAlign: "center" }}>{monthLabel}</strong>
        <Button variant="ghost" onClick={() => shiftMonth(1)}>
          ›
        </Button>
        <Button variant="ghost" onClick={() => setMonthParam(monthKey(new Date()))}>
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
        <Button variant="ghost" onClick={() => setUrlSearch(searchBox.trim())}>
          Search
        </Button>
        <select
          style={{ ...inputStyle, maxWidth: 160 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      <ErrorText message={!showForm ? error : null} />

      {/* Calendar grid */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              style={{
                padding: "8px 10px",
                fontSize: 12,
                color: "var(--muted)",
                fontWeight: 600,
                borderBottom: "1px solid var(--border)",
                textAlign: "center",
              }}
            >
              {w}
            </div>
          ))}
          {cells.map((d, i) => {
            const key = ymd(d);
            const inMonth = d.getMonth() === monthDate.getMonth();
            const dayItems = byDay.get(key) ?? [];
            return (
              <div
                key={i}
                style={{
                  minHeight: 96,
                  padding: 6,
                  borderBottom: "1px solid var(--border)",
                  borderRight: (i + 1) % 7 === 0 ? "none" : "1px solid var(--border)",
                  background: inMonth ? "transparent" : "var(--bg)",
                  opacity: inMonth ? 1 : 0.5,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: key === todayKey ? 700 : 400,
                    color: key === todayKey ? "var(--accent)" : "var(--muted)",
                    marginBottom: 4,
                    textAlign: "right",
                  }}
                >
                  {d.getDate()}
                </div>
                {dayItems.slice(0, 4).map((s) => (
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
                      color: "#fff",
                      background: STATUS_COLOR[s.status] ?? "#4f8cff",
                      textDecoration: s.status === "cancelled" ? "line-through" : "none",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {new Date(s.start_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    {s.candidate.full_name}
                  </button>
                ))}
                {dayItems.length > 4 && (
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                    +{dayItems.length - 4} more
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {loading && (
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>Loading…</p>
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
          <p style={{ marginBottom: 14 }}>
            <Badge>{selected.status}</Badge>
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="ghost" onClick={() => copyLink(selected)}>
              Copy link
            </Button>
            {(selected.status === "scheduled" || selected.status === "in_progress") && (
              <>
                <Button variant="ghost" onClick={() => act("resend", selected)}>
                  Resend
                </Button>
                <Button
                  variant="danger"
                  onClick={() =>
                    act("cancel", selected, "Cancel this schedule and revoke its invite?")
                  }
                >
                  Cancel
                </Button>
              </>
            )}
            {(selected.status === "completed" ||
              selected.status === "expired" ||
              selected.status === "cancelled") && (
              <Button variant="ghost" onClick={() => openCreate(selected)}>
                Reschedule
              </Button>
            )}
          </div>
        </Modal>
      )}

      {/* Create / reschedule modal */}
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
