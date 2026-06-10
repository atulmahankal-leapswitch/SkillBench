"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { browserApiBase } from "@/lib/api";

export default function ProfileMenu({
  email,
  fullName,
}: {
  email: string;
  fullName: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const initials = (fullName || email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  async function logout() {
    await fetch(`${browserApiBase}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "/login";
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Profile menu"
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "var(--accent)",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        {initials || "U"}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 44,
            minWidth: 200,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            overflow: "hidden",
            zIndex: 100,
          }}
        >
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{fullName || "User"}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", wordBreak: "break-all" }}>
              {email}
            </div>
          </div>
          <Link
            href="/admin/profile"
            onClick={() => setOpen(false)}
            style={{
              display: "block",
              padding: "10px 14px",
              color: "var(--fg)",
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            Profile
          </Link>
          <button
            onClick={logout}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "10px 14px",
              background: "transparent",
              border: "none",
              borderTop: "1px solid var(--border)",
              color: "#ff8a8a",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
