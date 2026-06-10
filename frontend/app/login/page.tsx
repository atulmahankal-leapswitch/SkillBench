import type { Metadata } from "next";
import { browserApiBase } from "@/lib/api";
import PasswordForm from "./password-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  domain_not_allowed:
    "That email isn't on an allowed organisation domain.",
  email_unverified: "Your Google email isn't verified.",
  account_disabled: "This account has been disabled.",
  bad_state: "Sign-in session expired. Please try again.",
  oauth_failed: "Sign-in was cancelled or failed.",
  token_exchange_failed: "Could not complete sign-in with Google.",
};

// Only honor internal absolute paths — guards against open redirects.
function safeNext(value: string | undefined): string {
  return value && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/admin";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; testmode?: string; redirect?: string }>;
}) {
  const { error, testmode, redirect } = await searchParams;
  const message = error ? (ERRORS[error] ?? "Sign-in failed.") : null;
  const isTestMode = testmode !== undefined;
  const next = safeNext(redirect);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: 32,
          textAlign: "center",
        }}
      >
        <h1 style={{ margin: "0 0 4px", fontSize: 28 }}>SkillBench</h1>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          Admin sign-in
        </p>

        {message && (
          <p
            role="alert"
            style={{
              background: "#3a1d1d",
              border: "1px solid #6b2b2b",
              color: "#ffb4b4",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 14,
            }}
          >
            {message}
          </p>
        )}

        {isTestMode ? (
          <PasswordForm next={next} />
        ) : (
          <a
            href={`${browserApiBase}/api/auth/google/login?next=${encodeURIComponent(next)}`}
            style={{
              display: "block",
              marginTop: 20,
              padding: "12px 16px",
              background: "var(--accent)",
              color: "#fff",
              borderRadius: 8,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Continue with Google
          </a>
        )}

        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 18 }}>
          {isTestMode
            ? "Test-mode bootstrap login (local setup only)."
            : "Restricted to your organisation's email domain."}
        </p>
      </div>
    </main>
  );
}
