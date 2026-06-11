import type { Metadata } from "next";
import { browserApiBase, fetchAuthConfig } from "@/lib/api";
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
  google_not_configured:
    "Google sign-in isn't configured yet. An administrator must set it up in Settings → Login / SSO.",
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
  searchParams: Promise<{ error?: string; passmode?: string; redirect?: string }>;
}) {
  const { error, passmode, redirect } = await searchParams;
  const message = error ? (ERRORS[error] ?? "Sign-in failed.") : null;
  const next = safeNext(redirect);

  const config = await fetchAuthConfig();
  // Password login only appears with the explicit ?passmode URL hint (and only
  // when the backend allows it) — a fallback when Google OAuth isn't working.
  // The Google button is always shown; when it isn't configured it links back
  // here with an error instead of hitting the backend's raw 503.
  const showPassword = config.password_login && passmode !== undefined;
  const googleHref = config.google
    ? `${browserApiBase}/api/auth/google/login?next=${encodeURIComponent(next)}`
    : "/login?error=google_not_configured";

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

        <a
          href={googleHref}
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

        {showPassword && <PasswordForm next={next} />}

        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 18 }}>
          Restricted to your organisation&apos;s email domain.
        </p>
      </div>
    </main>
  );
}
