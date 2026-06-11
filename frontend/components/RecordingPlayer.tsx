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
  const [view, setView] = useState<View>(
    screenUrl ? "both" : "camera",
  );
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  // Camera PiP geometry (pixels, relative to the container).
  const [pip, setPip] = useState({ x: 16, y: 16, w: 260 });

  const containerRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef<HTMLVideoElement>(null);

  // If only one stream exists, force the corresponding single view.
  useEffect(() => {
    if (!screenUrl && cameraUrl) setView("camera");
    else if (screenUrl && !cameraUrl) setView("screen");
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

  // Track the primary video's time/duration for the seek bar.
  useEffect(() => {
    const p = primary();
    if (!p) return;
    const onTime = () => setCur(p.currentTime);
    const onMeta = () => setDur(p.duration || 0);
    const onEnd = () => setPlaying(false);
    p.addEventListener("timeupdate", onTime);
    p.addEventListener("loadedmetadata", onMeta);
    p.addEventListener("ended", onEnd);
    setDur(p.duration || 0);
    setCur(p.currentTime || 0);
    return () => {
      p.removeEventListener("timeupdate", onTime);
      p.removeEventListener("loadedmetadata", onMeta);
      p.removeEventListener("ended", onEnd);
    };
  }, [primary, screenUrl, cameraUrl]);

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
    containerRef.current?.requestFullscreen?.().catch(() => {});
  }

  // ── PiP drag / resize ──────────────────────────────────────────────────────
  function startDrag(e: React.PointerEvent) {
    if ((e.target as HTMLElement).dataset.resize) return; // resize handle wins
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX;
    const sy = e.clientY;
    const ox = pip.x;
    const oy = pip.y;
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
    <div>
      {/* Shared control bar (top) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
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
              onClick={() => setView(v)}
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
        }}
      >
        {screenUrl && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            ref={screenRef}
            src={screenUrl}
            playsInline
            style={{
              width: "100%",
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
                    width: "100%",
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
              style={{ width: "100%", display: "block" }}
            />
            {view === "both" && (
              <div
                data-resize="1"
                onPointerDown={startResize}
                title="Drag to resize"
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: 0,
                  width: 16,
                  height: 16,
                  cursor: "nwse-resize",
                  background:
                    "linear-gradient(135deg, transparent 50%, rgba(255,255,255,.8) 50%)",
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
