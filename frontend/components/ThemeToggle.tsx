"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved =
      (document.documentElement.dataset.theme as "dark" | "light") || "dark";
    setTheme(saved);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("sb-theme", next);
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      onClick={toggle}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      aria-label="Toggle theme"
      style={{
        background: "transparent",
        border: "1px solid var(--border)",
        color: "var(--fg)",
        borderRadius: 8,
        width: 36,
        height: 36,
        cursor: "pointer",
        fontSize: 16,
      }}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
