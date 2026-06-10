"use client";

import { useState } from "react";
import { browserApiBase } from "@/lib/api";
import { Button, ErrorText, Field, inputStyle } from "@/components/ui";

export default function PasswordForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${browserApiBase}/api/auth/password-login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || "Login failed");
      }
      window.location.href = "/admin";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ textAlign: "left", marginTop: 8 }}>
      <div
        style={{
          fontSize: 12,
          color: "var(--muted)",
          marginBottom: 10,
          textAlign: "center",
        }}
      >
        Test-mode login
      </div>
      <ErrorText message={error} />
      <Field label="Email">
        <input
          style={inputStyle}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </Field>
      <Field label="Password">
        <input
          type="password"
          style={inputStyle}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </Field>
      <Button onClick={submit} disabled={busy || !email || !password}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </div>
  );
}
