"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type View = "both" | "screen" | "camera";

function fmt(s: number) {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const ss = String(Math.floor(s % 60)).padStart(2, "0");
  return `${m}:${ss}`;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Synced playback of the screen + camera recordings with a single shared
 * control bar (play/pause + seek). In "both" mode the camera plays as a
 * draggable, resizable picture-in-picture over the screen. Fullscreen supported.
 */
export default function RecordingPlayer({
  screenUrl,
  cameraUrl,
}: {
  screenUrl: string | null;
  cameraUrl: string | null;
}) {
  const [view, setView] = useState<View>("both");
  const userPicked = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  // Camera PiP geometry (pixels, relative to the container). Until the user
  // drags it, it's anchored to the bottom-right corner (placed=false).
  const [pip, setPip] = useState({ x: 16, y: 16, w: 260, placed: false });
  const [isFs, setIsFs] = useState(false);

  const fsRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef<HTMLVideoElement>(null);

  // Default selection once we know which streams exist: Both when both are
  // present, otherwise the single available one. Skipped after a manual pick.
  useEffect(() => {
    if (userPicked.current) return;
    if (screenUrl && cameraUrl) setView("both");
    else if (cameraUrl) setView("camera");
    else if (screenUrl) setView("screen");
  }, [screenUrl, cameraUrl]);

  const primary = useCallback((): HTMLVideoElement | null => {
    return view === "camera" ? cameraRef.current : screenRef.current;
  }, [view]);

  const visibles = useCallback((): HTMLVideoElement[] => {
    const v: HTMLVideoElement[] = [];
    if (view !== "camera" && screenRef.current) v.push(screenRef.current);
    if (view !== "screen" && cameraRef.current) v.push(cameraRef.current);
    return v;
  }, [view]);

  // MediaRecorder webm files report duration=Infinity until you seek past the
  // end. Force the browser to compute the real duration once metadata loads.
  useEffect(() => {
    const fix = (v: HTMLVideoElement | null) => {
      if (!v) return undefined;
      const onMeta = () => {
        if (v.duration === Infinity || isNaN(v.duration)) {
          const onSeeked = () => {
            v.removeEventListener("seeked", onSeeked);
            v.currentTime = 0;
          };
          v.addEventListener("seeked", onSeeked);
          try {
            v.currentTime = 1e101;
          } catch {
            /* ignore */
          }
        }
      };
      v.addEventListener("loadedmetadata", onMeta);
      if (v.readyState >= 1) onMeta();
      return () => v.removeEventListener("loadedmetadata", onMeta);
    };
    const cleanups = [fix(screenRef.current), fix(cameraRef.current)];
    return () => cleanups.forEach((c) => c?.());
  }, [screenUrl, cameraUrl]);

  // Track the primary video's time/duration for the seek bar.
  useEffect(() => {
    const p = primary();
    if (!p) return;
    const onTime = () => setCur(p.currentTime);
    const onDur = () => {
      if (isFinite(p.duration)) setDur(p.duration);
    };
    const onEnd = () => setPlaying(false);
    p.addEventListener("timeupdate", onTime);
    p.addEventListener("loadedmetadata", onDur);
    p.addEventListener("durationchange", onDur);
    p.addEventListener("ended", onEnd);
    onDur();
    setCur(p.currentTime || 0);
    return () => {
      p.removeEventListener("timeupdate", onTime);
      p.removeEventListener("loadedmetadata", onDur);
      p.removeEventListener("durationchange", onDur);
      p.removeEventListener("ended", onEnd);
    };
  }, [primary, screenUrl, cameraUrl]);

  // Track fullscreen so the layout can keep the video + control bar fitting.
  useEffect(() => {
    const onFs = () => setIsFs(document.fullscreenElement === fsRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Pause everything when switching view; the user re-presses play.
  useEffect(() => {
    [screenRef.current, cameraRef.current].forEach((v) => v?.pause());
    setPlaying(false);
  }, [view]);

  function togglePlay() {
    const vids = visibles();
    if (!vids.length) return;
    if (playing) {
      vids.forEach((v) => v.pause());
      setPlaying(false);
    } else {
      const p = primary();
      // Sync the others to the primary before playing together.
      vids.forEach((v) => {
        if (p && v !== p) v.currentTime = p.currentTime;
      });
      vids.forEach((v) => v.play().catch(() => {}));
      setPlaying(true);
    }
  }

  function seek(t: number) {
    visibles().forEach((v) => {
      v.currentTime = t;
    });
    setCur(t);
  }

  function fullscreen() {
    // Toggle: the wrapper (control bar + stage) so the controls stay visible.
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else fsRef.current?.requestFullscreen?.().catch(() => {});
  }

  // Keep the camera PiP placed sensibly: bottom-right by default, and clamped
  // within the stage whenever it resizes (e.g. entering/leaving fullscreen) so
  // a camera dragged while fullscreen doesn't end up off-screen afterwards.
  const reposition = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const W = c.clientWidth;
    const H = c.clientHeight;
    setPip((p) => {
      const camH = cameraRef.current?.clientHeight || p.w * 0.6;
      if (!p.placed) {
        return { ...p, x: Math.max(0, W - p.w - 16), y: Math.max(0, H - camH - 16) };
      }
      return {
        ...p,
        x: clamp(p.x, 0, Math.max(0, W - p.w)),
        y: clamp(p.y, 0, Math.max(0, H - camH)),
      };
    });
  }, []);

  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    reposition();
    const ro = new ResizeObserver(() => reposition());
    ro.observe(c);
    return () => ro.disconnect();
  }, [reposition, isFs, view, pip.w, pip.placed, screenUrl, cameraUrl]);

  // ── PiP drag / resize ──────────────────────────────────────────────────────
  function startDrag(e: React.PointerEvent) {
    if ((e.target as HTMLElement).dataset.resize) return; // resize handle wins
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX;
    const sy = e.clientY;
    const ox = pip.x;
    const oy = pip.y;
    if (!pip.placed) setPip((p) => ({ ...p, placed: true }));
    const camH = (cameraRef.current?.clientHeight ?? pip.w * 0.6) || pip.w * 0.6;
    const move = (ev: PointerEvent) => {
      setPip((p) => ({
        ...p,
        x: clamp(ox + ev.clientX - sx, 0, rect.width - p.w),
        y: clamp(oy + ev.clientY - sy, 0, rect.height - camH),
      }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function startResize(e: React.PointerEvent) {
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    const sx = e.clientX;
    const ow = pip.w;
    const move = (ev: PointerEvent) => {
      setPip((p) => ({
        ...p,
        w: clamp(ow + ev.clientX - sx, 120, (rect?.width ?? 1000) * 0.85),
      }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const btn: React.CSSProperties = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    color: "var(--fg)",
    borderRadius: 8,
    height: 34,
    minWidth: 34,
    padding: "0 10px",
    cursor: "pointer",
    fontSize: 14,
  };

  const hasBoth = !!(screenUrl && cameraUrl);

  return (
    <div
      ref={fsRef}
      style={{
        background: "var(--bg)",
        ...(isFs
          ? {
              height: "100vh",
              display: "flex",
              flexDirection: "column",
              padding: 8,
              boxSizing: "border-box",
            }
          : {}),
      }}
    >
      {/* Shared control bar (top) — inside the fullscreen wrapper so it stays
          visible in fullscreen. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
          padding: 2,
          flexWrap: "wrap",
        }}
      >
        <button onClick={togglePlay} style={btn} aria-label="Play / pause">
          {playing ? "⏸" : "▶"}
        </button>
        <input
          type="range"
          min={0}
          max={dur || 0}
          step={0.1}
          value={cur}
          onChange={(e) => seek(Number(e.target.value))}
          style={{ flex: 1, minWidth: 140, accentColor: "var(--accent)" }}
        />
        <span
          style={{
            fontSize: 12,
            color: "var(--muted)",
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {fmt(cur)} / {fmt(dur)}
        </span>
        {hasBoth &&
          (["both", "screen", "camera"] as const).map((v) => (
            <button
              key={v}
              onClick={() => {
                userPicked.current = true;
                setView(v);
              }}
              style={{
                ...btn,
                textTransform: "capitalize",
                borderColor: view === v ? "var(--accent)" : "var(--border)",
                background:
                  view === v
                    ? "color-mix(in srgb, var(--accent) 16%, transparent)"
                    : "var(--card)",
              }}
            >
              {v}
            </button>
          ))}
        <button onClick={fullscreen} style={btn} aria-label="Fullscreen">
          ⛶
        </button>
      </div>

      {/* Stage (full width) */}
      <div
        ref={containerRef}
        style={{
          position: "relative",
          width: "100%",
          background: "#000",
          borderRadius: 8,
          overflow: "hidden",
          lineHeight: 0,
          ...(isFs
            ? {
                flex: 1,
                minHeight: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }
            : {}),
        }}
      >
        {screenUrl && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            ref={screenRef}
            src={screenUrl}
            playsInline
            onContextMenu={(e) => e.preventDefault()}
            controlsList="nodownload noplaybackrate"
            preload="auto"
            style={{
              width: isFs ? "auto" : "100%",
              maxWidth: "100%",
              maxHeight: isFs ? "100%" : undefined,
              objectFit: "contain",
              display: view === "camera" ? "none" : "block",
            }}
          />
        )}

        {cameraUrl && (
          <div
            onPointerDown={view === "both" ? startDrag : undefined}
            style={
              view === "both"
                ? {
                    position: "absolute",
                    // Always top-left anchored (reposition() keeps it
                    // bottom-right by default) so the resize corner is free.
                    left: pip.x,
                    top: pip.y,
                    width: pip.w,
                    cursor: "move",
                    border: "2px solid rgba(255,255,255,.7)",
                    borderRadius: 8,
                    overflow: "hidden",
                    boxShadow: "0 4px 16px rgba(0,0,0,.5)",
                    zIndex: 5,
                    background: "#000",
                  }
                : {
                    width: isFs ? "auto" : "100%",
                    maxHeight: isFs ? "100%" : undefined,
                    display: view === "screen" ? "none" : "block",
                  }
            }
          >
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={cameraRef}
              src={cameraUrl}
              playsInline
              muted={view === "both"}
              onContextMenu={(e) => e.preventDefault()}
              controlsList="nodownload noplaybackrate"
            preload="auto"
              style={{
                width: "100%",
                maxHeight: isFs && view !== "both" ? "100%" : undefined,
                objectFit: "contain",
                display: "block",
              }}
            />
            {view === "both" && (
              <div
                data-resize="1"
                onPointerDown={startResize}
                title="Drag corner to resize"
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: 0,
                  width: 22,
                  height: 22,
                  cursor: "nwse-resize",
                  background:
                    "linear-gradient(135deg, transparent 45%, rgba(255,255,255,.9) 45%)",
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
