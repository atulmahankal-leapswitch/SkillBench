"use client";

import { browserApiBase } from "@/lib/api";

export default function LogoutButton() {
  async function logout() {
    await fetch(`${browserApiBase}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "/login";
  }

  return (
    <button
      onClick={logout}
      style={{
        background: "transparent",
        color: "var(--fg)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "6px 12px",
        cursor: "pointer",
        fontSize: 14,
      }}
    >
      Sign out
    </button>
  );
}
