"use client";

import { useEffect, useState } from "react";

type Pref = "system" | "light" | "dark";

const ORDER: Pref[] = ["system", "light", "dark"];
const ICON: Record<Pref, string> = { system: "🖥️", light: "☀️", dark: "🌙" };
const LABEL: Record<Pref, string> = { system: "System", light: "Light", dark: "Dark" };

function systemDark() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function resolve(pref: Pref): "dark" | "light" {
  if (pref === "system") return systemDark() ? "dark" : "light";
  return pref;
}

export default function ThemeToggle() {
  // Default to "system"; the pre-paint script in layout sets data-theme-pref.
  const [pref, setPref] = useState<Pref>("system");

  useEffect(() => {
    const saved = document.documentElement.dataset.themePref as Pref | undefined;
    if (saved && ORDER.includes(saved)) setPref(saved);
  }, []);

  // Apply the resolved theme whenever the preference changes, and (when on
  // "system") keep following the OS as it changes.
  useEffect(() => {
    document.documentElement.dataset.theme = resolve(pref);
    document.documentElement.dataset.themePref = pref;
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      document.documentElement.dataset.theme = systemDark() ? "dark" : "light";
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
    setPref(next);
    try {
      localStorage.setItem("sb-theme", next);
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      onClick={cycle}
      title={`Theme: ${LABEL[pref]} (click to change)`}
      aria-label={`Theme: ${LABEL[pref]}`}
      style={{
        background: "transparent",
        border: "1px solid var(--border)",
        color: "var(--fg)",
        borderRadius: 8,
        height: 36,
        padding: "0 10px",
        cursor: "pointer",
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span style={{ fontSize: 16 }}>{ICON[pref]}</span>
      <span>{LABEL[pref]}</span>
    </button>
  );
}
