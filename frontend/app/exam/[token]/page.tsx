"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { browserApiBase } from "@/lib/api";

type PublicQuestion = {
  id: string;
  type: "mcq" | "multi_select" | "text" | "coding";
  prompt: string;
  points: number;
  options?: { key: string; text: string }[];
  multiple?: boolean;
  max_chars?: number | null;
  starter_code?: Record<string, string> | null;
  sample_test_cases?: { input: string; expected: string }[] | null;
};

type ExamState = {
  status: "not_started" | "in_progress" | "submitted" | "expired";
  test_title: string;
  candidate_name: string;
  duration_minutes: number;
  started_at: string | null;
  expires_at: string | null;
  server_now: string;
  remaining_seconds: number;
  questions: PublicQuestion[];
  answers: Record<string, unknown>;
  proctoring: {
    webcam?: boolean;
    tab_switch?: boolean;
    fullscreen?: boolean;
    block_copy_paste?: boolean;
  };
  branding: { display_name?: string; logo_url?: string; brand_color?: string };
};

type RunCaseResult = { passed: boolean; status: string; stdout: string; stderr: string };

const APP = process.env.NEXT_PUBLIC_APP_NAME ?? "SkillBench";

async function call(path: string, method: string, body?: unknown) {
  const res = await fetch(`${browserApiBase}/api/exam/${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || res.statusText);
  return data;
}

export default function ExamPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [state, setState] = useState<ExamState | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fsBlocked, setFsBlocked] = useState(false);
  const submittedRef = useRef(false);

  const accent = state?.branding?.brand_color || "#4f8cff";

  const applyState = useCallback((s: ExamState) => {
    setState(s);
    setAnswers(s.answers || {});
    setRemaining(s.remaining_seconds);
    const app = process.env.NEXT_PUBLIC_APP_NAME ?? s.branding?.display_name ?? "SkillBench";
    document.title = `${s.test_title}:${app}`;
  }, []);

  useEffect(() => {
    call(`${token}`, "GET").then(applyState).catch((e) => setError(e.message));
  }, [token, applyState]);

  const report = useCallback(
    (type: string, meta?: Record<string, unknown>) => {
      call(`${token}/proctor`, "POST", { type, meta }).catch(() => {});
    },
    [token]
  );

  const doSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    try {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      applyState(await call(`${token}/submit`, "POST"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token, applyState]);

  const proctoring = state?.proctoring ?? {};
  const active = state?.status === "in_progress";

  // Countdown + auto-submit.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          doSubmit();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [active, doSubmit]);

  // Tab/focus monitoring.
  useEffect(() => {
    if (!active || !proctoring.tab_switch) return;
    const onVis = () => (document.hidden ? report("tab_blur") : report("tab_focus"));
    const onBlur = () => report("focus_loss");
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
    };
  }, [active, proctoring.tab_switch, report]);

  // Copy/paste blocking.
  useEffect(() => {
    if (!active || !proctoring.block_copy_paste) return;
    const onCopy = (e: ClipboardEvent) => { e.preventDefault(); report("copy"); };
    const onPaste = (e: ClipboardEvent) => { e.preventDefault(); report("paste"); };
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
    };
  }, [active, proctoring.block_copy_paste, report]);

  // Fullscreen enforcement: if the candidate leaves fullscreen, block until they return.
  useEffect(() => {
    if (!active || !proctoring.fullscreen) return;
    const onFs = () => {
      if (!document.fullscreenElement) {
        setFsBlocked(true);
        report("fullscreen_exit");
      } else {
        setFsBlocked(false);
      }
    };
    document.addEventListener("fullscreenchange", onFs);
    if (!document.fullscreenElement) setFsBlocked(true);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [active, proctoring.fullscreen, report]);

  // Camera + screen snapshots every 20s.
  useEffect(() => {
    if (!active || !proctoring.webcam) return;
    const streams: MediaStream[] = [];
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    function snapshot(video: HTMLVideoElement, type: string) {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      report(type, { image: canvas.toDataURL("image/jpeg", 0.5) });
    }

    (async () => {
      const videos: { el: HTMLVideoElement; type: string }[] = [];
      // Camera
      try {
        const cam = await navigator.mediaDevices.getUserMedia({ video: true });
        streams.push(cam);
        const v = document.createElement("video");
        v.srcObject = cam; v.muted = true; await v.play();
        videos.push({ el: v, type: "webcam_snapshot" });
      } catch { report("webcam_denied"); }
      // Screen
      try {
        const scr = await navigator.mediaDevices.getDisplayMedia({ video: true });
        streams.push(scr);
        const v = document.createElement("video");
        v.srcObject = scr; v.muted = true; await v.play();
        videos.push({ el: v, type: "screen_snapshot" });
      } catch { report("screen_denied"); }

      if (cancelled) return;
      const tick = () => videos.forEach((x) => snapshot(x.el, x.type));
      tick();
      timer = setInterval(tick, 20000);
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    };
  }, [active, proctoring.webcam, report]);

  async function start() {
    setError(null);
    try {
      if (proctoring.fullscreen) {
        await document.documentElement.requestFullscreen?.().catch(() => {});
      }
      applyState(await call(`${token}/start`, "POST"));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function reenterFullscreen() {
    try {
      await document.documentElement.requestFullscreen?.();
      setFsBlocked(false);
      report("fullscreen_enter");
    } catch {
      /* user must allow */
    }
  }

  async function saveAnswer(questionId: string, response: unknown) {
    setAnswers((a) => ({ ...a, [questionId]: response }));
    setSaving(true);
    try {
      await call(`${token}/answer`, "PUT", { question_id: questionId, response });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (error && !state) return <Centered accent={accent}>{error}</Centered>;
  if (!state) return <Centered accent={accent}>Loading…</Centered>;

  if (state.status === "submitted" || state.status === "expired") {
    return (
      <Centered accent={accent}>
        <div style={{ fontSize: 52, marginBottom: 8 }}>
          {state.status === "submitted" ? "✓" : "⏱"}
        </div>
        <h1 style={{ margin: 0 }}>
          {state.status === "submitted"
            ? "Submitted — thank you!"
            : "Time's up — submitted automatically"}
        </h1>
        <p style={{ color: "var(--muted)" }}>
          Thanks, {state.candidate_name}. You may close this window.
        </p>
      </Centered>
    );
  }

  if (state.status === "not_started") {
    return (
      <Centered accent={accent}>
        <div style={{ ...cardStyle, maxWidth: 540, textAlign: "left" }}>
          <Brand state={state} />
          <h1 style={{ margin: "14px 0 4px", fontSize: 30 }}>{state.test_title}</h1>
          <p style={{ color: "var(--muted)", marginTop: 0 }}>
            Hello {state.candidate_name} 👋
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "16px 0" }}>
            <Chip>⏱ {state.duration_minutes} min</Chip>
            {state.proctoring?.webcam && <Chip>📷 Camera & screen</Chip>}
            {state.proctoring?.fullscreen && <Chip>⛶ Fullscreen</Chip>}
            {state.proctoring?.tab_switch && <Chip>👁 Tab monitored</Chip>}
          </div>
          <ul style={{ color: "var(--muted)", lineHeight: 1.9, fontSize: 14 }}>
            <li>The timer starts when you click Begin.</li>
            <li>Answers save automatically as you go.</li>
            {state.proctoring?.webcam && (
              <li>You&apos;ll be asked to share your camera and screen.</li>
            )}
          </ul>
          {error && <p style={{ color: "#ff8a8a" }}>{error}</p>}
          <button onClick={start} style={{ ...btn(accent), width: "100%", marginTop: 8 }}>
            Begin assessment →
          </button>
        </div>
      </Centered>
    );
  }

  // in_progress
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const answered = state.questions.filter((q) => answers[q.id] != null).length;
  const pct = Math.round((answered / Math.max(1, state.questions.length)) * 100);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {fsBlocked && (
        <div style={overlayStyle}>
          <div style={{ ...cardStyle, maxWidth: 420, textAlign: "center" }}>
            <div style={{ fontSize: 40 }}>⛶</div>
            <h2>Fullscreen required</h2>
            <p style={{ color: "var(--muted)" }}>
              This assessment must run in fullscreen. Click below to continue.
            </p>
            <button onClick={reenterFullscreen} style={btn(accent)}>
              Return to fullscreen
            </button>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div style={topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Brand state={state} compact />
          <strong style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {state.test_title}
          </strong>
        </div>
        <div
          style={{
            fontVariantNumeric: "tabular-nums",
            fontSize: 18,
            fontWeight: 700,
            color: remaining < 60 ? "#ff6b6b" : "var(--fg)",
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 999,
            padding: "6px 14px",
          }}
        >
          ⏱ {mm}:{ss}
        </div>
      </div>
      {/* Progress */}
      <div style={{ height: 4, background: "var(--border)" }}>
        <div style={{ height: 4, width: `${pct}%`, background: accent, transition: "width .3s" }} />
      </div>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "24px 18px 96px" }}>
        <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
          {answered} of {state.questions.length} answered
        </div>
        {state.questions.map((q, i) => (
          <div key={q.id} style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ ...numBadge, background: accent }}>{i + 1}</span>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>
                {q.points} pt{q.points === 1 ? "" : "s"} · {q.type}
              </span>
            </div>
            <p style={{ fontSize: 16, whiteSpace: "pre-wrap", marginTop: 0 }}>{q.prompt}</p>
            <QuestionInput
              q={q}
              value={answers[q.id]}
              accent={accent}
              onChange={(resp) => saveAnswer(q.id, resp)}
              onRun={async (code, language) => {
                const r = await call(`${token}/run`, "POST", {
                  question_id: q.id, language, code,
                });
                return (r as { results: RunCaseResult[] }).results;
              }}
            />
          </div>
        ))}
      </main>

      {/* Sticky footer */}
      <div style={footerBar}>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>
          {saving ? "Saving…" : "✓ All changes saved"}
        </span>
        <button
          onClick={() => confirm("Submit your assessment?") && doSubmit()}
          style={btn(accent)}
        >
          Submit assessment
        </button>
      </div>
    </div>
  );
}

function QuestionInput({
  q, value, onChange, onRun, accent,
}: {
  q: PublicQuestion;
  value: unknown;
  onChange: (resp: unknown) => void;
  onRun?: (code: string, language: string) => Promise<RunCaseResult[]>;
  accent: string;
}) {
  const [runResults, setRunResults] = useState<RunCaseResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const codeRef = useRef<string>(
    (value as { code?: string })?.code ?? q.starter_code?.python ?? ""
  );

  if (q.type === "mcq" || q.type === "multi_select") {
    const selected = ((value as { selected_keys?: string[] })?.selected_keys ?? []) as string[];
    function toggle(key: string) {
      if (q.multiple) {
        const set = new Set(selected);
        set.has(key) ? set.delete(key) : set.add(key);
        onChange({ selected_keys: [...set] });
      } else onChange({ selected_keys: [key] });
    }
    return (
      <div>
        {q.options?.map((o) => {
          const on = selected.includes(o.key);
          return (
            <label
              key={o.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 14px",
                marginBottom: 8,
                borderRadius: 10,
                cursor: "pointer",
                border: on ? `2px solid ${accent}` : "1px solid var(--border)",
                background: on ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
              }}
            >
              <input
                type={q.multiple ? "checkbox" : "radio"}
                checked={on}
                onChange={() => toggle(o.key)}
              />
              {o.text}
            </label>
          );
        })}
      </div>
    );
  }
  if (q.type === "text") {
    return (
      <textarea
        defaultValue={(value as { text?: string })?.text ?? ""}
        onBlur={(e) => onChange({ text: e.target.value })}
        maxLength={q.max_chars ?? undefined}
        placeholder="Type your answer…"
        style={{ ...field, minHeight: 130 }}
      />
    );
  }
  // coding
  async function run() {
    if (!onRun) return;
    setRunning(true);
    try {
      onChange({ language: "python", code: codeRef.current });
      setRunResults(await onRun(codeRef.current, "python"));
    } finally {
      setRunning(false);
    }
  }
  return (
    <div>
      {q.sample_test_cases?.[0] && (
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
          Sample: in <code>{q.sample_test_cases[0].input}</code> → out{" "}
          <code>{q.sample_test_cases[0].expected}</code>
        </div>
      )}
      <textarea
        defaultValue={codeRef.current}
        onChange={(e) => (codeRef.current = e.target.value)}
        onBlur={(e) => onChange({ language: "python", code: e.target.value })}
        style={{ ...field, minHeight: 180, fontFamily: "monospace" }}
      />
      {onRun && (
        <div style={{ marginTop: 8 }}>
          <button onClick={run} disabled={running} style={btnGhost}>
            {running ? "Running…" : "▶ Run sample tests"}
          </button>
          {runResults?.map((r, i) => (
            <div key={i} style={{ fontSize: 13, marginTop: 6, color: "var(--muted)" }}>
              Test {i + 1}: {r.passed ? "✅" : "❌"} {r.status}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Brand({ state, compact }: { state: ExamState; compact?: boolean }) {
  const logo = state.branding?.logo_url;
  const name = state.branding?.display_name;
  if (logo)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt={name || "logo"} style={{ height: compact ? 24 : 40 }} />;
  if (name) return <span style={{ fontWeight: 700 }}>{name}</span>;
  return <span style={{ fontWeight: 700, color: "var(--muted)" }}>{APP}</span>;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 999,
      padding: "4px 12px", fontSize: 13,
    }}>{children}</span>
  );
}

function Centered({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <main style={{
      minHeight: "100vh", display: "grid", placeItems: "center", padding: 24,
      textAlign: "center",
      background: `radial-gradient(1200px 500px at 50% -10%, color-mix(in srgb, ${accent} 18%, var(--bg)), var(--bg))`,
    }}>
      <div>{children}</div>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)",
  borderRadius: 16, padding: 24,
};
const field: React.CSSProperties = {
  width: "100%", padding: 12, background: "var(--bg)", color: "var(--fg)",
  border: "1px solid var(--border)", borderRadius: 10, fontSize: 14,
};
const topBar: React.CSSProperties = {
  position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center",
  justifyContent: "space-between", gap: 12, padding: "12px 18px",
  background: "var(--card)", borderBottom: "1px solid var(--border)",
};
const footerBar: React.CSSProperties = {
  position: "fixed", bottom: 0, left: 0, right: 0, display: "flex",
  alignItems: "center", justifyContent: "space-between", padding: "12px 18px",
  background: "var(--card)", borderTop: "1px solid var(--border)", zIndex: 10,
};
const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", display: "grid",
  placeItems: "center", zIndex: 100, padding: 24,
};
const numBadge: React.CSSProperties = {
  display: "grid", placeItems: "center", width: 26, height: 26, borderRadius: "50%",
  color: "#fff", fontSize: 13, fontWeight: 700, flexShrink: 0,
};
function btn(accent: string): React.CSSProperties {
  return {
    background: accent, color: "#fff", border: "none", padding: "12px 20px",
    borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer",
  };
}
const btnGhost: React.CSSProperties = {
  background: "transparent", color: "var(--fg)", border: "1px solid var(--border)",
  padding: "8px 14px", borderRadius: 8, fontSize: 14, cursor: "pointer",
};
