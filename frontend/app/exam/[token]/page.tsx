"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { browserApiBase } from "@/lib/api";

type PublicQuestion = {
  id: string;
  type: "mcq" | "multi_select" | "text" | "coding";
  prompt: string;
  points: number;
  difficulty?: string;
  categories?: string[];
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
    single_display?: boolean;
    record_screen?: boolean;
  };
  branding: { display_name?: string; logo_url?: string; brand_color?: string };
};

type RunCaseResult = { passed: boolean; status: string; stdout: string; stderr: string };

type PermStatus = "idle" | "granted" | "denied";

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
  const [multiDisplay, setMultiDisplay] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  const [serverDown, setServerDown] = useState(false);
  const offlineAtRef = useRef<number | null>(null);
  const submittedRef = useRef(false);

  // Shared media streams acquired at the permission gate, reused by the
  // recording + snapshot effects so the candidate is only prompted once.
  const camStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  // `entered` = the candidate passed the permission gate in this session and
  // should see the live exam. On reopen (status already in_progress) this
  // starts false, so we show the startup screen with "Continue test".
  const [entered, setEntered] = useState(false);
  const [gateBusy, setGateBusy] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const [perm, setPerm] = useState<{
    camera: PermStatus;
    screen: PermStatus;
    display: PermStatus;
  }>({
    camera: "idle",
    screen: "idle",
    display: "idle",
  });

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

  const stopStreams = useCallback(() => {
    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current = null;
    screenStreamRef.current = null;
  }, []);

  // Release camera/screen when the candidate leaves the page.
  useEffect(() => stopStreams, [stopStreams]);

  const doSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    try {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      applyState(await call(`${token}/submit`, "POST"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      stopStreams();
    }
  }, [token, applyState, stopStreams]);

  const proctoring = state?.proctoring ?? {};
  const active = state?.status === "in_progress";
  // The live exam UI/monitoring only runs once the gate has been passed.
  const live = active && entered;

  // Countdown + auto-submit. Only runs in the live exam (not on the "Continue
  // test" screen, so the pending duration isn't reduced before entering), and
  // is frozen while disconnected or the server is unreachable.
  useEffect(() => {
    if (!live || disconnected || serverDown) return;
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
  }, [live, disconnected, serverDown, doSubmit]);

  // Connection drop → freeze the timer + block the exam; on reconnect, credit
  // the offline time back to the server deadline and resync.
  useEffect(() => {
    if (!live) return;
    const onOffline = () => {
      offlineAtRef.current = Date.now();
      setDisconnected(true);
    };
    const onOnline = async () => {
      const secs = offlineAtRef.current
        ? Math.round((Date.now() - offlineAtRef.current) / 1000)
        : 0;
      offlineAtRef.current = null;
      try {
        const s = await call(`${token}/resume`, "POST", { offline_seconds: secs });
        applyState(s);
      } catch {
        // If resume fails, fall back to a plain state refresh.
        try {
          applyState(await call(`${token}`, "GET"));
        } catch {
          /* stay disconnected until the next online event */
          return;
        }
      }
      setDisconnected(false);
    };
    if (!navigator.onLine) onOffline();
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, token]);

  // Server heartbeat: even when the browser reports online, the server itself
  // may be unreachable. Ping it; on a network failure show the "Connection
  // error" popup (and pause the timer) until it responds again.
  useEffect(() => {
    if (!live) return;
    let stop = false;
    let wasDown = false;
    const ping = async () => {
      try {
        const res = await fetch(`${browserApiBase}/api/exam/${token}`, { method: "GET" });
        const data = await res.json().catch(() => null);
        if (stop) return;
        setServerDown(false);
        // Resync the deadline once the server is reachable again.
        if (wasDown && res.ok && data) applyState(data as ExamState);
        wasDown = false;
      } catch {
        if (!stop) {
          setServerDown(true);
          wasDown = true;
        }
      }
    };
    ping();
    const id = setInterval(ping, 8000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [live, token, applyState]);

  // Tab/focus monitoring.
  useEffect(() => {
    if (!live || !proctoring.tab_switch) return;
    const onVis = () => (document.hidden ? report("tab_blur") : report("tab_focus"));
    const onBlur = () => report("focus_loss");
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
    };
  }, [live, proctoring.tab_switch, report]);

  // Copy/paste blocking.
  useEffect(() => {
    if (!live || !proctoring.block_copy_paste) return;
    const onCopy = (e: ClipboardEvent) => { e.preventDefault(); report("copy"); };
    const onPaste = (e: ClipboardEvent) => { e.preventDefault(); report("paste"); };
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
    };
  }, [live, proctoring.block_copy_paste, report]);

  // Fullscreen enforcement: the test always runs in fullscreen. If the
  // candidate isn't in fullscreen (or leaves it), block until they return.
  useEffect(() => {
    if (!live) return;
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
  }, [live, report]);

  // Continuous recording: record the whole screen AND the webcam at the same
  // time (so reviewers can watch the candidate's face while they work), reusing
  // the streams captured at the gate. Each kind uploads to its own backend
  // stream. Chunks that fail to upload (offline) are queued and flushed online.
  useEffect(() => {
    if (!live) return;

    function startRecorder(stream: MediaStream, kind: string): () => void {
      let recorder: MediaRecorder | null = null;
      // Seed the sequence from the wall clock so chunks from a later recording
      // session (a resume after closing the tab) get strictly-higher, unique
      // keys instead of overwriting the previous session's 0,1,2…
      let seq = Date.now();
      const queue: Blob[] = [];

      const upload = async (blob: Blob, n: number) => {
        const fd = new FormData();
        fd.append("seq", String(n));
        fd.append("kind", kind);
        fd.append("file", blob, `${kind}-${n}.webm`);
        const res = await fetch(`${browserApiBase}/api/exam/${token}/recording`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) throw new Error(String(res.status));
      };

      const onData = async (e: BlobEvent) => {
        if (!e.data || e.data.size === 0) return;
        try {
          await upload(e.data, seq++);
        } catch {
          queue.push(e.data);
        }
        while (navigator.onLine && queue.length) {
          const b = queue.shift()!;
          try {
            await upload(b, seq++);
          } catch {
            queue.unshift(b);
            break;
          }
        }
      };

      // isTypeSupported isn't always reliable for the captured stream, so try
      // candidates plus a no-options fallback; guard so a failure disables this
      // recorder rather than crashing the exam.
      const candidates = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
        "video/mp4",
      ];
      const ok = (() => {
        for (const mime of candidates) {
          if (!MediaRecorder.isTypeSupported(mime)) continue;
          try {
            recorder = new MediaRecorder(stream, { mimeType: mime });
            recorder.ondataavailable = onData;
            recorder.start(5000);
            return true;
          } catch {
            recorder = null;
          }
        }
        try {
          recorder = new MediaRecorder(stream);
          recorder.ondataavailable = onData;
          recorder.start(5000);
          return true;
        } catch {
          recorder = null;
          return false;
        }
      })();
      if (!ok) report(`${kind}_record_unsupported`);
      return () => {
        try {
          recorder?.stop();
        } catch {
          /* ignore */
        }
      };
    }

    const stops: Array<() => void> = [];
    if (proctoring.record_screen && screenStreamRef.current) {
      stops.push(startRecorder(screenStreamRef.current, "screen"));
    }
    if (proctoring.webcam && camStreamRef.current) {
      stops.push(startRecorder(camStreamRef.current, "camera"));
    }
    return () => stops.forEach((s) => s());
  }, [live, proctoring.record_screen, proctoring.webcam, report, token]);

  // Multiple-display detection: browsers can't disable extra monitors, but we
  // can detect an extended desktop (screen.isExtended) and block until single.
  useEffect(() => {
    if (!live || !proctoring.single_display) return;
    let reported = false;
    const check = () => {
      const extended = (window.screen as Screen & { isExtended?: boolean })
        .isExtended;
      setMultiDisplay(!!extended);
      if (extended && !reported) {
        reported = true;
        report("multi_display");
      } else if (!extended) {
        reported = false;
      }
    };
    check();
    const id = setInterval(check, 3000);
    const sc = window.screen as Screen & {
      addEventListener?: (t: string, f: () => void) => void;
      removeEventListener?: (t: string, f: () => void) => void;
    };
    sc.addEventListener?.("change", check);
    return () => {
      clearInterval(id);
      sc.removeEventListener?.("change", check);
    };
  }, [live, proctoring.single_display, report]);

  // Camera + screen snapshots every 20s, from the streams captured at the gate.
  useEffect(() => {
    if (!live || !proctoring.webcam) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    const els: HTMLVideoElement[] = [];

    function snapshot(video: HTMLVideoElement, type: string) {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      report(type, { image: canvas.toDataURL("image/jpeg", 0.5) });
    }

    (async () => {
      const videos: { el: HTMLVideoElement; type: string }[] = [];
      const sources: [MediaStream | null, string][] = [
        [camStreamRef.current, "webcam_snapshot"],
        [screenStreamRef.current, "screen_snapshot"],
      ];
      for (const [stream, type] of sources) {
        if (!stream) continue;
        const v = document.createElement("video");
        v.srcObject = stream;
        v.muted = true;
        await v.play().catch(() => {});
        els.push(v);
        videos.push({ el: v, type });
      }
      if (cancelled) return;
      const tick = () => videos.forEach((x) => snapshot(x.el, x.type));
      tick();
      timer = setInterval(tick, 20000);
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      els.forEach((v) => {
        v.pause();
        v.srcObject = null;
      });
    };
  }, [live, proctoring.webcam, report]);

  // A stream is only reusable if its video track is still live — if the
  // candidate clicked the browser's "Stop sharing", the track ends and we must
  // re-acquire it on the next (re)scan instead of starting without it.
  function isLive(s: MediaStream | null): boolean {
    return !!s && s.getVideoTracks().some((t) => t.readyState === "live");
  }
  function drop(ref: React.MutableRefObject<MediaStream | null>) {
    ref.current?.getTracks().forEach((t) => t.stop());
    ref.current = null;
  }

  // Acquire the required permissions. Screen capture must be the ENTIRE screen
  // (displaySurface "monitor"), not a window or browser tab.
  async function acquirePermissions() {
    const needCam = !!proctoring.webcam;
    const needScreen = !!(proctoring.webcam || proctoring.record_screen);

    // Single-display first — fail fast on a second monitor before starting any
    // camera/screen capture, so we don't begin sharing only to error out.
    if (proctoring.single_display) {
      const extended = (window.screen as Screen & { isExtended?: boolean })
        .isExtended;
      if (extended) {
        setPerm((p) => ({ ...p, display: "denied" }));
        throw new Error(
          "A second display was detected. Disconnect extra monitors to start the assessment.",
        );
      }
      setPerm((p) => ({ ...p, display: "granted" }));
    }

    if (needCam && !isLive(camStreamRef.current)) {
      drop(camStreamRef);
      try {
        camStreamRef.current = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        setPerm((p) => ({ ...p, camera: "granted" }));
      } catch {
        setPerm((p) => ({ ...p, camera: "denied" }));
        throw new Error("Camera access is required. Please allow your camera.");
      }
    }

    if (needScreen && !isLive(screenStreamRef.current)) {
      drop(screenStreamRef);
      let scr: MediaStream;
      try {
        scr = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: "monitor" } as MediaTrackConstraints,
          audio: false,
        });
      } catch {
        setPerm((p) => ({ ...p, screen: "denied" }));
        throw new Error("Screen sharing is required. Please share your screen.");
      }
      const surface = (
        scr.getVideoTracks()[0]?.getSettings() as
          | (MediaTrackSettings & { displaySurface?: string })
          | undefined
      )?.displaySurface;
      // When the browser reports the surface, enforce a full monitor share.
      if (surface && surface !== "monitor") {
        scr.getTracks().forEach((t) => t.stop());
        setPerm((p) => ({ ...p, screen: "denied" }));
        throw new Error(
          "Please share your entire screen (the whole monitor), not a window or a tab.",
        );
      }
      screenStreamRef.current = scr;
      setPerm((p) => ({ ...p, screen: "granted" }));
    }
  }

  // Gate: check permissions (and fullscreen), then start or resume the exam.
  async function enterExam() {
    setError(null);
    setGateError(null);
    setGateBusy(true);
    try {
      await acquirePermissions();
      // The test must run in fullscreen. Try here; if the browser rejects it
      // (e.g. the click's activation was consumed by the media prompt), the
      // fullscreen overlay below catches it and offers one-click re-entry.
      await document.documentElement.requestFullscreen?.().catch(() => {});
      if (state?.status === "not_started") {
        applyState(await call(`${token}/start`, "POST"));
      }
      setEntered(true);
    } catch (e) {
      setGateError((e as Error).message);
    } finally {
      setGateBusy(false);
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
      // A network-level failure (fetch throws TypeError) means the server is
      // unreachable — surface the Connection error popup immediately.
      if (e instanceof TypeError) setServerDown(true);
      else setError((e as Error).message);
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

  if (!entered) {
    const resuming = state.status === "in_progress";
    const needCam = !!proctoring.webcam;
    const needScreen = !!(proctoring.webcam || proctoring.record_screen);
    const needSingle = !!proctoring.single_display;
    const rmm = String(Math.floor(remaining / 60)).padStart(2, "0");
    const rss = String(remaining % 60).padStart(2, "0");
    return (
      <Centered accent={accent}>
        <div style={{ ...cardStyle, maxWidth: 540, textAlign: "left" }}>
          <Brand state={state} />
          <h1 style={{ margin: "14px 0 4px", fontSize: 30 }}>{state.test_title}</h1>
          <p style={{ color: "var(--muted)", marginTop: 0 }}>
            {resuming
              ? `Welcome back, ${state.candidate_name} — your assessment is in progress.`
              : `Hello ${state.candidate_name} 👋`}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "16px 0" }}>
            <Chip>⏱ {resuming ? `${rmm}:${rss} left` : `${state.duration_minutes} min`}</Chip>
            {needCam && <Chip>📷 Camera & screen</Chip>}
            <Chip>⛶ Fullscreen</Chip>
            {state.proctoring?.tab_switch && <Chip>👁 Tab monitored</Chip>}
          </div>

          {(needCam || needScreen || needSingle) && (
            <div style={{ margin: "8px 0 16px" }}>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>
                Before you {resuming ? "continue" : "begin"}, we need:
              </div>
              {needCam && <PermItem label="Camera access" status={perm.camera} />}
              {needScreen && (
                <PermItem
                  label="Screen sharing — your entire screen"
                  status={perm.screen}
                />
              )}
              {needSingle && (
                <PermItem label="Single display (no extra monitors)" status={perm.display} />
              )}
            </div>
          )}

          <ul style={{ color: "var(--muted)", lineHeight: 1.9, fontSize: 14 }}>
            {!resuming && <li>The timer starts when you click Begin.</li>}
            <li>Answers save automatically as you go.</li>
            {needScreen && (
              <li>
                When prompted, choose <strong>Entire Screen</strong> (not a window
                or tab) and share it.
              </li>
            )}
          </ul>

          {gateError && <p style={{ color: "#ff8a8a" }}>{gateError}</p>}
          {error && <p style={{ color: "#ff8a8a" }}>{error}</p>}
          <button
            onClick={enterExam}
            disabled={gateBusy}
            style={{
              ...btn(accent),
              width: "100%",
              marginTop: 8,
              opacity: gateBusy ? 0.7 : 1,
              cursor: gateBusy ? "default" : "pointer",
            }}
          >
            {gateBusy
              ? "Checking permissions…"
              : gateError
                ? resuming
                  ? "Rescan & continue test →"
                  : "Rescan & begin →"
                : resuming
                  ? "Continue test →"
                  : "Begin assessment →"}
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

      {multiDisplay && !fsBlocked && (
        <div style={overlayStyle}>
          <div style={{ ...cardStyle, maxWidth: 420, textAlign: "center" }}>
            <div style={{ fontSize: 40 }}>🖥️</div>
            <h2>One screen only</h2>
            <p style={{ color: "var(--muted)" }}>
              A second display was detected. Please disconnect extra monitors to
              continue the assessment.
            </p>
          </div>
        </div>
      )}

      {disconnected && (
        <div style={overlayStyle}>
          <div style={{ ...cardStyle, maxWidth: 420, textAlign: "center" }}>
            <div style={{ fontSize: 40 }}>📡</div>
            <h2>Connection lost</h2>
            <p style={{ color: "var(--muted)" }}>
              Your timer is <strong>paused</strong>. Stay on this page — the assessment will
              resume automatically once your connection is back.
            </p>
          </div>
        </div>
      )}

      {serverDown && !disconnected && (
        <div style={overlayStyle}>
          <div style={{ ...cardStyle, maxWidth: 420, textAlign: "center" }}>
            <div style={{ fontSize: 40 }}>⚠️</div>
            <h2>Connection error</h2>
            <p style={{ color: "var(--muted)" }}>
              We can&apos;t reach the server. Your timer is <strong>paused</strong> — keep
              this page open and it will reconnect automatically.
            </p>
          </div>
        </div>
      )}

      {/* Top bar: brand left · candidate + test centered · timer right */}
      <div style={{ ...topBar, display: "grid", gridTemplateColumns: "1fr auto 1fr" }}>
        <div style={{ justifySelf: "start" }}>
          <Brand state={state} compact />
        </div>
        <div style={{ textAlign: "center", minWidth: 0 }}>
          <div style={{ fontWeight: 700, lineHeight: 1.2 }}>{state.candidate_name}</div>
          <div
            style={{
              fontSize: 12,
              color: "var(--muted)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {state.test_title}
          </div>
        </div>
        <div
          style={{
            justifySelf: "end",
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

      <div style={{ display: "flex", alignItems: "flex-start" }}>
        <QuestionNav questions={state.questions} answers={answers} accent={accent} />
        <main style={{ flex: 1, minWidth: 0, padding: "24px 18px 96px" }}>
          <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
            {answered} of {state.questions.length} answered
          </div>
          {state.questions.map((q, i) => (
            <div key={q.id} id={`q-${i}`} style={{ ...cardStyle, marginBottom: 16, scrollMarginTop: 70 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ ...numBadge, background: accent }}>{i + 1}</span>
                <span style={{ color: "var(--muted)", fontSize: 13 }}>
                  {q.points} pt{q.points === 1 ? "" : "s"} · {q.type}
                </span>
                {q.difficulty && <DifficultyChip level={q.difficulty} />}
                {q.categories?.map((c) => <Chip key={c}>{c}</Chip>)}
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
      </div>

      {/* Sticky footer */}
      <div style={footerBar}>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>
          {saving ? "Saving…" : "✓ All changes saved"}
        </span>
        <button onClick={() => setConfirmSubmit(true)} style={btn(accent)}>
          Submit assessment
        </button>
      </div>

      {/* In-page confirmation (a native confirm() would drop fullscreen). */}
      {confirmSubmit && (
        <div style={overlayStyle}>
          <div style={{ ...cardStyle, maxWidth: 420, textAlign: "center" }}>
            <h2 style={{ marginTop: 0 }}>Submit assessment?</h2>
            <p style={{ color: "var(--muted)" }}>
              You won&apos;t be able to change your answers after submitting.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={() => setConfirmSubmit(false)} style={btnGhost}>
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmSubmit(false);
                  doSubmit();
                }}
                style={btn(accent)}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
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

function QuestionNav({
  questions,
  answers,
  accent,
}: {
  questions: PublicQuestion[];
  answers: Record<string, unknown>;
  accent: string;
}) {
  const go = (i: number) =>
    document.getElementById(`q-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  // Group questions (with their global index) by "<category>:<level>",
  // preserving first-seen order.
  const groups: { label: string; items: number[] }[] = [];
  const seen = new Map<string, number>();
  questions.forEach((q, i) => {
    const cat = q.categories?.[0] || "General";
    const level = q.difficulty || "—";
    const label = `${cat}:${level}`;
    let gi = seen.get(label);
    if (gi === undefined) {
      gi = groups.length;
      seen.set(label, gi);
      groups.push({ label, items: [] });
    }
    groups[gi].items.push(i);
  });

  return (
    <aside
      style={{
        position: "sticky",
        top: 60,
        alignSelf: "flex-start",
        width: 224,
        flexShrink: 0,
        maxHeight: "calc(100vh - 76px)",
        overflowY: "auto",
        padding: "24px 12px 24px 18px",
        borderRight: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: ".06em",
          marginBottom: 12,
        }}
      >
        Questions
      </div>
      {groups.map((g) => (
        <div key={g.label} style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 12,
              color: "var(--muted)",
              marginBottom: 7,
              textTransform: "capitalize",
            }}
          >
            {g.label}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {g.items.map((i) => {
              const done = answers[questions[i].id] != null;
              return (
                <button
                  key={i}
                  onClick={() => go(i)}
                  title={`Question ${i + 1}`}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 700,
                    border: `1px solid ${done ? accent : "var(--border)"}`,
                    background: done ? accent : "transparent",
                    color: done ? "#fff" : "var(--fg)",
                  }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </aside>
  );
}

function PermItem({ label, status }: { label: string; status: PermStatus }) {
  const icon = status === "granted" ? "✅" : status === "denied" ? "❌" : "•";
  const color =
    status === "denied" ? "#ff8a8a" : status === "granted" ? "#7ee787" : "var(--muted)";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 0",
        fontSize: 14,
        color,
      }}
    >
      <span style={{ width: 18, textAlign: "center" }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

// Color-coded difficulty: easy → green, medium → amber, hard → red.
const LEVEL_COLOR: Record<string, string> = {
  easy: "#3fb950",
  medium: "#d29922",
  hard: "#f85149",
};

function DifficultyChip({ level }: { level: string }) {
  const color = LEVEL_COLOR[level.toLowerCase()] ?? "var(--muted)";
  return (
    <span
      style={{
        background: `color-mix(in srgb, ${color} 18%, transparent)`,
        border: `1px solid ${color}`,
        color,
        borderRadius: 999,
        padding: "3px 11px",
        fontSize: 13,
        fontWeight: 600,
        textTransform: "capitalize",
      }}
    >
      {level}
    </span>
  );
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
