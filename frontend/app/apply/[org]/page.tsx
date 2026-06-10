"use client";

import { use, useEffect, useState } from "react";
import { browserApiBase } from "@/lib/api";

type ApplyInfo = {
  organization_name: string;
  display_name: string;
  logo_url: string;
  brand_color: string;
};

export default function ApplyPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = use(params);
  const [info, setInfo] = useState<ApplyInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${browserApiBase}/api/apply/${org}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setInfo(d);
        const app = d.display_name || d.organization_name;
        document.title = `Apply${app ? " · " + app : ""}`;
      })
      .catch(() => setNotFound(true));
  }, [org]);

  const accent = info?.brand_color || "#4f8cff";
  const brand = info?.display_name || info?.organization_name || "";

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${browserApiBase}/api/apply/${org}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          email,
          job_title: jobTitle,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.detail || "Submission failed");
      }
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const wrap: React.CSSProperties = {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    background: `radial-gradient(1200px 500px at 50% -10%, color-mix(in srgb, ${accent} 18%, var(--bg)), var(--bg))`,
  };
  const card: React.CSSProperties = {
    width: "100%",
    maxWidth: 460,
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: 28,
  };
  const field: React.CSSProperties = {
    width: "100%",
    padding: 12,
    background: "var(--bg)",
    color: "var(--fg)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    fontSize: 14,
    marginBottom: 12,
  };

  if (notFound)
    return (
      <main style={wrap}>
        <div style={{ ...card, textAlign: "center" }}>
          <h1>Application link not found</h1>
          <p style={{ color: "var(--muted)" }}>Please check the URL.</p>
        </div>
      </main>
    );

  if (done)
    return (
      <main style={wrap}>
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>✓</div>
          <h1 style={{ marginTop: 0 }}>Application received</h1>
          <p style={{ color: "var(--muted)" }}>
            Thanks for applying{brand ? ` to ${brand}` : ""}. We&apos;ll be in
            touch.
          </p>
        </div>
      </main>
    );

  return (
    <main style={wrap}>
      <div style={card}>
        {info?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={info.logo_url} alt={brand} style={{ maxHeight: 44, marginBottom: 12 }} />
        ) : (
          brand && (
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{brand}</div>
          )
        )}
        <h1 style={{ margin: "4px 0 2px", fontSize: 26 }}>Apply to job</h1>
        <p style={{ color: "var(--muted)", marginTop: 0, fontSize: 14 }}>
          Submit your details and we&apos;ll invite you to the assessment.
        </p>

        {error && (
          <p style={{ color: "#ffb4b4", fontSize: 13 }} role="alert">
            {error}
          </p>
        )}

        <input
          style={field}
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <input
          style={field}
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          style={field}
          placeholder="Job title you're applying for"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
        />
        <button
          onClick={submit}
          disabled={busy || !fullName.trim() || !email.trim()}
          style={{
            width: "100%",
            background: accent,
            color: "#fff",
            border: "none",
            padding: "12px 18px",
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy || !fullName.trim() || !email.trim() ? 0.6 : 1,
          }}
        >
          {busy ? "Submitting…" : "Submit application"}
        </button>
      </div>
    </main>
  );
}
