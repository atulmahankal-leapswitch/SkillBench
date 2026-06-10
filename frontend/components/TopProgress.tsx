"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Thin top loading bar shown while navigating between pages. Starts on an
 * internal link click and completes when the route (path or query) changes.
 * No external dependency. Must be rendered inside a <Suspense> boundary
 * (uses useSearchParams).
 */
export default function TopProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const routeKey = `${pathname}?${search.toString()}`;

  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  function start() {
    if (timer.current) clearInterval(timer.current);
    setVisible(true);
    setWidth(8);
    timer.current = setInterval(() => {
      // ease toward 90% while the next page loads
      setWidth((w) => (w < 90 ? w + (90 - w) * 0.12 : w));
    }, 200);
  }

  function done() {
    if (timer.current) clearInterval(timer.current);
    setWidth(100);
    setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 250);
  }

  // Begin on same-origin link clicks (sidebar/nav/Links).
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const a = (e.target as HTMLElement)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      const target = a.getAttribute("target");
      if (!href || !href.startsWith("/") || target === "_blank") return;
      if (href === window.location.pathname + window.location.search) return;
      start();
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Complete once the route actually changes.
  useEffect(() => {
    if (visible) done();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  if (!visible) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: 3,
        width: `${width}%`,
        background: "var(--accent)",
        boxShadow: "0 0 8px var(--accent)",
        zIndex: 9999,
        transition: "width 0.2s ease",
      }}
    />
  );
}
