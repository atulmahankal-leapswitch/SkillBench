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
  branding: {
    display_name?: string;
    logo_url?: string;
    brand_color?: string;
  };
};

const card: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 20,
  marginBottom: 16,
};

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

export default function ExamPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [state, setState] = useState<ExamState | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submittedRef = useRef(false);

  const applyState = useCallback((s: ExamState) => {
    setState(s);
    setAnswers(s.answers || {});
    setRemaining(s.remaining_seconds);
    const app =
      process.env.NEXT_PUBLIC_APP_NAME ?? s.branding?.display_name ?? "SkillBench";
    document.title = `${s.test_title}:${app}`;
  }, []);

  useEffect(() => {
    call(`${token}`, "GET")
      .then(applyState)
      .catch((e) => setError(e.message));
  }, [token, applyState]);

  const doSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    try {
      const s = await call(`${token}/submit`, "POST");
      applyState(s);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token, applyState]);

  // Countdown while in progress; auto-submit at zero.
  useEffect(() => {
    if (state?.status !== "in_progress") return;
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
  }, [state?.status, doSubmit]);

  const report = useCallback(
    (type: string, meta?: Record<string, unknown>) => {
      // Fire-and-forget; proctoring must never block the exam.
      call(`${token}/proctor`, "POST", { type, meta }).catch(() => {});
    },
    [token]
  );

  const proctoring = state?.proctoring ?? {};
  const active = state?.status === "in_progress";

  // Tab / focus monitoring.
  useEffect(() => {
    if (!active || !proctoring.tab_switch) return;
    const onVis = () =>
      document.hidden ? report("tab_blur") : report("tab_focus");
    const onBlur = () => report("focus_loss");
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
    };
  }, [active, proctoring.tab_switch, report]);

  // Copy / paste blocking.
  useEffect(() => {
    if (!active || !proctoring.block_copy_paste) return;
    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      report("copy");
    };
    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      report("paste");
    };
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
    };
  }, [active, proctoring.block_copy_paste, report]);

  // Fullscreen-exit detection.
  useEffect(() => {
    if (!active || !proctoring.fullscreen) return;
    const onFs = () => {
      if (!document.fullscreenElement) report("fullscreen_exit");
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [active, proctoring.fullscreen, report]);

  // Webcam snapshots every 30s.
  useEffect(() => {
    if (!active || !proctoring.webcam) return;
    let stream: MediaStream | null = null;
    let video: HTMLVideoElement | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (cancelled) return;
        video = document.createElement("video");
        video.srcObject = stream;
        video.muted = true;
        await video.play();
        const snap = () => {
          if (!video) return;
          const canvas = document.createElement("canvas");
          canvas.width = 320;
          canvas.height = 240;
          canvas
            .getContext("2d")
            ?.drawImage(video, 0, 0, canvas.width, canvas.height);
          report("webcam_snapshot", {
            image: canvas.toDataURL("image/jpeg", 0.5),
          });
        };
        snap();
        interval = setInterval(snap, 30000);
      } catch {
        report("webcam_denied");
      }
    })();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active, proctoring.webcam, report]);

  async function start() {
    setError(null);
    try {
      const s = await call(`${token}/start`, "POST");
      applyState(s);
      if (s.proctoring?.fullscreen) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function saveAnswer(questionId: string, response: unknown) {
    setAnswers((a) => ({ ...a, [questionId]: response }));
    setSaving(true);
    try {
      await call(`${token}/answer`, "PUT", {
        question_id: questionId,
        response,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (error && !state) {
    return <Centered>{error}</Centered>;
  }
  if (!state) return <Centered>Loading…</Centered>;

  if (state.status === "submitted" || state.status === "expired") {
    return (
      <Centered>
        <h1>
          {state.status === "submitted"
            ? "Your responses have been submitted."
            : "Time is up — your attempt was submitted automatically."}
        </h1>
        <p style={{ color: "var(--muted)" }}>
          Thank you, {state.candidate_name}. You may close this window.
        </p>
      </Centered>
    );
  }

  const brandColor = state.branding?.brand_color;
  const beginBtn = brandColor
    ? { ...primaryBtn, background: brandColor }
    : primaryBtn;

  if (state.status === "not_started") {
    return (
      <Centered>
        <div style={{ ...card, maxWidth: 520 }}>
          {state.branding?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={state.branding.logo_url}
              alt={state.branding.display_name || "logo"}
              style={{ maxHeight: 48, marginBottom: 12 }}
            />
          ) : (
            state.branding?.display_name && (
              <div style={{ color: "var(--muted)", marginBottom: 8 }}>
                {state.branding.display_name}
              </div>
            )
          )}
          <h1 style={{ marginTop: 0 }}>{state.test_title}</h1>
          <p>Hello {state.candidate_name},</p>
          <ul style={{ color: "var(--muted)", lineHeight: 1.8 }}>
            <li>Duration: {state.duration_minutes} minutes</li>
            <li>The timer starts when you click Begin.</li>
            <li>Your answers save automatically.</li>
            {state.proctoring?.webcam && (
              <li>This assessment is proctored and will use your webcam.</li>
            )}
          </ul>
          {error && <p style={{ color: "#ffb4b4" }}>{error}</p>}
          <button onClick={start} style={beginBtn}>
            Begin assessment
          </button>
        </div>
      </Centered>
    );
  }

  // in_progress
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "24px 20px 80px" }}>
      <div
        style={{
          position: "sticky",
          top: 0,
          background: "var(--bg)",
          padding: "12px 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--border)",
          zIndex: 10,
        }}
      >
        <strong>{state.test_title}</strong>
        <span
          style={{
            fontVariantNumeric: "tabular-nums",
            color: remaining < 60 ? "#ff8a8a" : "var(--fg)",
            fontSize: 18,
          }}
        >
          ⏱ {mm}:{ss}
        </span>
      </div>

      {state.questions.map((q, i) => (
        <div key={q.id} style={card}>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            Question {i + 1} · {q.points} pt{q.points === 1 ? "" : "s"} · {q.type}
          </div>
          <p style={{ fontSize: 16, whiteSpace: "pre-wrap" }}>{q.prompt}</p>
          <QuestionInput
            q={q}
            value={answers[q.id]}
            onChange={(resp) => saveAnswer(q.id, resp)}
            onRun={async (code, language) => {
              const res = await call(`${token}/run`, "POST", {
                question_id: q.id,
                language,
                code,
              });
              return (res as { results: RunCaseResult[] }).results;
            }}
          />
        </div>
      ))}

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>
          {saving ? "Saving…" : "All changes saved"}
        </span>
        <button
          onClick={() => confirm("Submit your assessment?") && doSubmit()}
          style={primaryBtn}
        >
          Submit assessment
        </button>
      </div>
    </main>
  );
}

type RunCaseResult = {
  passed: boolean;
  status: string;
  stdout: string;
  stderr: string;
};

function QuestionInput({
  q,
  value,
  onChange,
  onRun,
}: {
  q: PublicQuestion;
  value: unknown;
  onChange: (resp: unknown) => void;
  onRun?: (code: string, language: string) => Promise<RunCaseResult[]>;
}) {
  const [runResults, setRunResults] = useState<RunCaseResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const codeRef = useRef<string>(
    (value as { code?: string })?.code ?? q.starter_code?.python ?? ""
  );

  if (q.type === "mcq" || q.type === "multi_select") {
    const selected = ((value as { selected_keys?: string[] })?.selected_keys ??
      []) as string[];
    function toggle(key: string) {
      if (q.multiple) {
        const set = new Set(selected);
        set.has(key) ? set.delete(key) : set.add(key);
        onChange({ selected_keys: [...set] });
      } else {
        onChange({ selected_keys: [key] });
      }
    }
    return (
      <div>
        {q.options?.map((o) => (
          <label
            key={o.key}
            style={{ display: "block", padding: "6px 0", cursor: "pointer" }}
          >
            <input
              type={q.multiple ? "checkbox" : "radio"}
              checked={selected.includes(o.key)}
              onChange={() => toggle(o.key)}
            />{" "}
            {o.text}
          </label>
        ))}
      </div>
    );
  }
  if (q.type === "text") {
    const text = (value as { text?: string })?.text ?? "";
    return (
      <textarea
        defaultValue={text}
        onBlur={(e) => onChange({ text: e.target.value })}
        maxLength={q.max_chars ?? undefined}
        style={{ ...fieldStyle, minHeight: 120 }}
      />
    );
  }
  // coding
  async function run() {
    if (!onRun) return;
    setRunError(null);
    setRunning(true);
    try {
      onChange({ language: "python", code: codeRef.current });
      setRunResults(await onRun(codeRef.current, "python"));
    } catch (e) {
      setRunError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      {q.sample_test_cases && q.sample_test_cases.length > 0 && (
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
          Sample: in <code>{q.sample_test_cases[0].input}</code> → out{" "}
          <code>{q.sample_test_cases[0].expected}</code>
        </div>
      )}
      <textarea
        defaultValue={codeRef.current}
        onChange={(e) => (codeRef.current = e.target.value)}
        onBlur={(e) => onChange({ language: "python", code: e.target.value })}
        style={{ ...fieldStyle, minHeight: 180, fontFamily: "monospace" }}
      />
      {onRun && (
        <div style={{ marginTop: 8 }}>
          <button onClick={run} disabled={running} style={primaryBtn}>
            {running ? "Running…" : "Run sample tests"}
          </button>
          {runError && (
            <p style={{ color: "#ffb4b4", fontSize: 13 }}>{runError}</p>
          )}
          {runResults?.map((r, i) => (
            <div
              key={i}
              style={{ fontSize: 13, marginTop: 6, color: "var(--muted)" }}
            >
              Test {i + 1}: {r.passed ? "✅" : "❌"} {r.status}
              {r.stdout && (
                <pre style={{ whiteSpace: "pre-wrap", margin: "4px 0" }}>
                  {r.stdout}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div>{children}</div>
    </main>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px",
  background: "var(--bg)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 14,
};

const primaryBtn: React.CSSProperties = {
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  padding: "10px 18px",
  borderRadius: 8,
  fontSize: 15,
  cursor: "pointer",
};
