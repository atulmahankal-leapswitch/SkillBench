"use client";

import { Suspense, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client";
import { useUrlParam } from "@/lib/url";
import {
  Badge,
  Button,
  ErrorText,
  Field,
  inputStyle,
  PageHeader,
  td,
  th,
} from "@/components/ui";
import LogoUpload from "@/components/LogoUpload";

type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  last_used_at: string | null;
  revoked_at: string | null;
};
type Webhook = { id: string; url: string; events: string[]; active: boolean };
type AISettings = {
  provider: string;
  model: string;
  api_key_set: boolean;
  api_key_masked: string;
  available_providers: string[];
  models: Record<string, string[]>;
  providers_needing_key: string[];
};
type RecSettings = {
  provider: string;
  s3_bucket: string;
  s3_region: string;
  s3_endpoint: string;
  s3_access_key_set: boolean;
  s3_secret_set: boolean;
};

const SCOPES = ["candidate:read", "result:read"];
const EVENTS = ["attempt.submitted", "result.ready"];
const TABS = [
  "Branding",
  "AI Provider",
  "Recording",
  "Login / SSO",
  "API Keys",
  "Webhooks",
] as const;
type Tab = (typeof TABS)[number];
const TAB_SLUG: Record<Tab, string> = {
  Branding: "branding",
  "AI Provider": "ai",
  Recording: "recording",
  "Login / SSO": "sso",
  "API Keys": "api-keys",
  Webhooks: "webhooks",
};
const SLUG_TAB: Record<string, Tab> = Object.fromEntries(
  Object.entries(TAB_SLUG).map(([t, s]) => [s, t as Tab])
);

const PROVIDER_LABELS: Record<string, string> = {
  "": "Disabled",
  anthropic: "Anthropic (Claude API)",
  claude_code_sdk: "Claude Code SDK",
  openai: "OpenAI",
  stub: "Stub (testing only)",
};

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsInner />
    </Suspense>
  );
}

function SettingsInner() {
  const [tabSlug, setTabSlug] = useUrlParam("tab", "branding");
  const tab: Tab = SLUG_TAB[tabSlug] ?? "Branding";
  const setTab = (t: Tab) => setTabSlug(TAB_SLUG[t]);
  const [error, setError] = useState<string | null>(null);

  // Branding
  const [brand, setBrand] = useState({ display_name: "", logo_url: "", brand_color: "" });
  const [brandSaved, setBrandSaved] = useState(false);

  // AI
  const [ai, setAi] = useState<AISettings>({
    provider: "",
    model: "",
    api_key_set: false,
    api_key_masked: "",
    available_providers: [],
    models: {},
    providers_needing_key: [],
  });
  const [aiKey, setAiKey] = useState("");
  const [aiSaved, setAiSaved] = useState(false);
  const [claudeAuth, setClaudeAuth] = useState<{
    authenticated: boolean;
    email?: string | null;
    subscription_type?: string | null;
    expires_at?: string | null;
    reason?: string;
  } | null>(null);

  // Recording storage
  const [rec, setRec] = useState<RecSettings>({
    provider: "",
    s3_bucket: "",
    s3_region: "",
    s3_endpoint: "",
    s3_access_key_set: false,
    s3_secret_set: false,
  });
  const [recAccessKey, setRecAccessKey] = useState("");
  const [recSecret, setRecSecret] = useState("");
  const [recSaved, setRecSaved] = useState(false);
  const [recTest, setRecTest] = useState<{ ok: boolean; detail: string } | null>(null);
  const [recTesting, setRecTesting] = useState(false);

  // Login / SSO (Google OAuth)
  const [sso, setSso] = useState<{
    google_client_id: string;
    google_client_secret_set: boolean;
    google_domain: string;
    redirect_uri: string;
  }>({
    google_client_id: "",
    google_client_secret_set: false,
    google_domain: "",
    redirect_uri: "",
  });
  const [ssoSecret, setSsoSecret] = useState("");
  const [ssoSaved, setSsoSaved] = useState(false);

  // Keys + webhooks
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [hooks, setHooks] = useState<Webhook[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>([]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [hookUrl, setHookUrl] = useState("");
  const [hookEvents, setHookEvents] = useState<string[]>([]);

  async function load() {
    try {
      setBrand(await api.get("/branding"));
      setAi(await api.get<AISettings>("/settings/ai"));
      setRec(await api.get<RecSettings>("/settings/recording"));
      setSso(await api.get("/settings/sso"));
      setKeys(await api.get<ApiKey[]>("/integrations/api-keys"));
      setHooks(await api.get<Webhook[]>("/integrations/webhooks"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load");
    }
  }
  useEffect(() => {
    load();
  }, []);

  function toggle(list: string[], v: string, set: (l: string[]) => void) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  async function saveBrand() {
    setError(null);
    try {
      setBrand(await api.put("/branding", brand));
      setBrandSaved(true);
      setTimeout(() => setBrandSaved(false), 2000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Save failed");
    }
  }

  function changeProvider(p: string) {
    const models = ai.models[p] || [];
    const model = models.includes(ai.model) ? ai.model : (models[0] ?? "");
    setAi({ ...ai, provider: p, model });
    if (p === "claude_code_sdk") loadClaudeAuth();
  }

  async function loadClaudeAuth() {
    try {
      setClaudeAuth(await api.get("/settings/claude-auth"));
    } catch {
      setClaudeAuth(null);
    }
  }

  async function claudeLogout() {
    if (!confirm("Sign out Claude on the host? Re-login needs `claude login`.")) return;
    try {
      setClaudeAuth(await api.post("/settings/claude-auth/logout", {}));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Logout failed");
    }
  }

  // Load Claude auth status when the AI tab opens on the SDK provider.
  useEffect(() => {
    if (tab === "AI Provider" && ai.provider === "claude_code_sdk") {
      loadClaudeAuth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, ai.provider]);

  async function saveRec() {
    setError(null);
    try {
      const body: Record<string, unknown> = {
        provider: rec.provider,
        s3_bucket: rec.s3_bucket,
        s3_region: rec.s3_region,
        s3_endpoint: rec.s3_endpoint,
      };
      if (recAccessKey) body.s3_access_key = recAccessKey;
      if (recSecret) body.s3_secret = recSecret;
      setRec(await api.put<RecSettings>("/settings/recording", body));
      setRecAccessKey("");
      setRecSecret("");
      setRecSaved(true);
      setTimeout(() => setRecSaved(false), 2000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Save failed");
    }
  }

  async function saveSso() {
    setError(null);
    try {
      const body: Record<string, unknown> = {
        google_client_id: sso.google_client_id,
        google_domain: sso.google_domain,
      };
      if (ssoSecret) body.google_client_secret = ssoSecret;
      setSso(await api.put("/settings/sso", body));
      setSsoSecret("");
      setSsoSaved(true);
      setTimeout(() => setSsoSaved(false), 2000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Save failed");
    }
  }

  async function testRec() {
    setRecTest(null);
    setRecTesting(true);
    try {
      // Test the saved settings — server-side reaches the storage for us.
      await saveRec();
      setRecTest(await api.post<{ ok: boolean; detail: string }>("/settings/recording/test", {}));
    } catch (e) {
      setRecTest({ ok: false, detail: e instanceof ApiError ? e.message : "Test failed" });
    } finally {
      setRecTesting(false);
    }
  }

  async function saveAi(clearKey = false) {
    setError(null);
    try {
      const body: Record<string, unknown> = { provider: ai.provider, model: ai.model };
      if (clearKey) body.api_key = "__clear__";
      else if (aiKey) body.api_key = aiKey;
      setAi(await api.put<AISettings>("/settings/ai", body));
      setAiKey("");
      setAiSaved(true);
      setTimeout(() => setAiSaved(false), 2000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Save failed");
    }
  }

  async function createKey() {
    setError(null);
    try {
      const k = await api.post<{ key: string }>("/integrations/api-keys", {
        name: newKeyName,
        scopes: newKeyScopes,
      });
      setCreatedKey(k.key);
      setNewKeyName("");
      setNewKeyScopes([]);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Create failed");
    }
  }
  async function revokeKey(id: string) {
    if (!confirm("Revoke this API key?")) return;
    await api.del(`/integrations/api-keys/${id}`);
    await load();
  }
  async function createHook() {
    setError(null);
    try {
      await api.post("/integrations/webhooks", { url: hookUrl, events: hookEvents });
      setHookUrl("");
      setHookEvents([]);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Create failed");
    }
  }
  async function deleteHook(id: string) {
    if (!confirm("Delete this webhook?")) return;
    await api.del(`/integrations/webhooks/${id}`);
    await load();
  }

  return (
    <main>
      <PageHeader title="Settings" />

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
              color: tab === t ? "var(--fg)" : "var(--muted)",
              padding: "10px 14px",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: tab === t ? 600 : 400,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <ErrorText message={error} />

      {tab === "Branding" && (
        <section style={{ maxWidth: 560 }}>
          <Field label="Display name">
            <input
              style={inputStyle}
              value={brand.display_name}
              onChange={(e) => setBrand({ ...brand, display_name: e.target.value })}
            />
          </Field>
          <Field label="Logo">
            <LogoUpload
              value={brand.logo_url}
              onChange={(v) => setBrand({ ...brand, logo_url: v })}
            />
          </Field>
          <Field label="Brand colour">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="color"
                aria-label="Brand colour picker"
                style={{
                  width: 44,
                  height: 38,
                  padding: 2,
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  background: "var(--card)",
                  cursor: "pointer",
                }}
                value={/^#[0-9a-fA-F]{6}$/.test(brand.brand_color) ? brand.brand_color : "#4f8cff"}
                onChange={(e) => setBrand({ ...brand, brand_color: e.target.value })}
              />
              <input
                style={{ ...inputStyle, maxWidth: 160 }}
                placeholder="#4f8cff"
                value={brand.brand_color}
                onChange={(e) => setBrand({ ...brand, brand_color: e.target.value })}
              />
            </div>
          </Field>
          <Button onClick={saveBrand}>Save branding</Button>
          {brandSaved && <span style={{ color: "#7ee787", marginLeft: 10 }}>Saved</span>}
        </section>
      )}

      {tab === "AI Provider" && (
        <section style={{ maxWidth: 560 }}>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
            Powers question generation and free-text answer scoring.
          </p>
          <Field label="Provider">
            <select
              style={inputStyle}
              value={ai.provider}
              onChange={(e) => changeProvider(e.target.value)}
            >
              <option value="">Disabled</option>
              {ai.available_providers.map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p] ?? p}
                </option>
              ))}
            </select>
          </Field>

          {(ai.models[ai.provider]?.length ?? 0) > 0 && (
            <Field label="Model">
              <select
                style={inputStyle}
                value={ai.model}
                onChange={(e) => setAi({ ...ai, model: e.target.value })}
              >
                {ai.models[ai.provider].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {/* Claude Code SDK authenticates via the container (below), not an
              API key field — so only show the key for key-based providers. */}
          {ai.providers_needing_key.includes(ai.provider) &&
            ai.provider !== "claude_code_sdk" && (
              <Field label="API key">
                <input
                  type="password"
                  style={inputStyle}
                  placeholder={ai.api_key_set ? ai.api_key_masked : "sk-… (required)"}
                  value={aiKey}
                  onChange={(e) => setAiKey(e.target.value)}
                />
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                  {ai.api_key_set
                    ? "A key is set. Leave blank to keep it."
                    : "Stored server-side and never shown again."}
                </div>
              </Field>
            )}

          {ai.provider === "claude_code_sdk" && (
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 14,
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
                Uses the Claude Code SDK (no API key). The backend container must
                be authenticated — run <code>claude login</code> inside it, or set{" "}
                <code>ANTHROPIC_API_KEY</code>. Otherwise use the Anthropic /
                OpenAI provider.
              </div>
              {claudeAuth === null ? (
                <span style={{ color: "var(--muted)" }}>Checking…</span>
              ) : claudeAuth.authenticated ? (
                <div>
                  <span style={{ color: "#7ee787" }}>● Signed in</span>{" "}
                  {claudeAuth.email && <strong>{claudeAuth.email}</strong>}
                  {claudeAuth.subscription_type && (
                    <Badge>{claudeAuth.subscription_type}</Badge>
                  )}
                  {claudeAuth.expires_at && (
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                      Token expires {new Date(claudeAuth.expires_at).toLocaleString()}
                    </div>
                  )}
                  <div style={{ marginTop: 8 }}>
                    <Button variant="danger" onClick={claudeLogout}>
                      Sign out
                    </Button>
                  </div>
                </div>
              ) : (
                <div style={{ color: "#ffcf6b", fontSize: 13 }}>
                  ● Not signed in
                  <div style={{ color: "var(--muted)", marginTop: 4 }}>
                    {claudeAuth.reason ??
                      "Run `claude login` on the host, then refresh."}
                  </div>
                </div>
              )}
            </div>
          )}
          {ai.provider === "stub" && (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>
              Returns deterministic sample output for local testing — no real AI.
            </p>
          )}

          <div style={{ marginTop: 8 }}>
            <Button onClick={() => saveAi(false)}>Save AI settings</Button>
            {ai.api_key_set && ai.providers_needing_key.includes(ai.provider) && (
              <span style={{ marginLeft: 8 }}>
                <Button variant="danger" onClick={() => saveAi(true)}>
                  Clear key
                </Button>
              </span>
            )}
            {aiSaved && (
              <span style={{ color: "#7ee787", marginLeft: 10 }}>Saved</span>
            )}
          </div>
        </section>
      )}

      {tab === "Recording" && (
        <section style={{ maxWidth: 560 }}>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
            Where candidate screen recordings are stored (enable “Record screen”
            on a test to capture). Uses S3-compatible object storage — in dev
            point it at the bundled MinIO; in production use AWS S3 / Cloudflare R2.
            Recordings upload and play back <strong>through the server</strong>, so
            the endpoint is a server-side address.
          </p>
          <Field label="Storage provider">
            <select
              style={inputStyle}
              value={rec.provider}
              onChange={(e) => setRec({ ...rec, provider: e.target.value })}
            >
              <option value="">Disabled</option>
              <option value="s3">S3 / object storage (MinIO in dev)</option>
            </select>
          </Field>
          {rec.provider === "s3" && (
            <>
              <Field label="Bucket">
                <input
                  style={inputStyle}
                  value={rec.s3_bucket}
                  onChange={(e) => setRec({ ...rec, s3_bucket: e.target.value })}
                />
              </Field>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <Field label="Region">
                    <input
                      style={inputStyle}
                      value={rec.s3_region}
                      onChange={(e) => setRec({ ...rec, s3_region: e.target.value })}
                    />
                  </Field>
                </div>
                <div style={{ flex: 2 }}>
                  <Field label="Endpoint — server-side (R2/MinIO; blank = AWS)">
                    <input
                      style={inputStyle}
                      placeholder="http://minio:9000"
                      value={rec.s3_endpoint}
                      onChange={(e) => setRec({ ...rec, s3_endpoint: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
              <p style={{ color: "var(--muted)", fontSize: 12, marginTop: -4 }}>
                For the bundled dev MinIO use <code>http://minio:9000</code> — this
                is the Docker network address the <em>server</em> uses, not a
                browser URL (opening it in a browser won&apos;t resolve). To browse
                files directly, use the MinIO console at{" "}
                <code>http://localhost:9001</code>.
              </p>
              <Field label={`Access key ID ${rec.s3_access_key_set ? "(set)" : ""}`}>
                <input
                  type="password"
                  style={inputStyle}
                  placeholder={rec.s3_access_key_set ? "••••••••" : ""}
                  value={recAccessKey}
                  onChange={(e) => setRecAccessKey(e.target.value)}
                />
              </Field>
              <Field label={`Secret access key ${rec.s3_secret_set ? "(set)" : ""}`}>
                <input
                  type="password"
                  style={inputStyle}
                  placeholder={rec.s3_secret_set ? "••••••••" : ""}
                  value={recSecret}
                  onChange={(e) => setRecSecret(e.target.value)}
                />
              </Field>
            </>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={saveRec}>Save recording settings</Button>
            {rec.provider && (
              <Button variant="ghost" onClick={testRec} disabled={recTesting}>
                {recTesting ? "Testing…" : "Test connection"}
              </Button>
            )}
            {recSaved && <span style={{ color: "#7ee787" }}>Saved</span>}
          </div>
          {recTest && (
            <p
              style={{
                marginTop: 10,
                fontSize: 13,
                color: recTest.ok ? "#7ee787" : "#ff8a8a",
              }}
            >
              {recTest.ok ? "✓ " : "✗ "}
              {recTest.detail}
            </p>
          )}
        </section>
      )}

      {tab === "Login / SSO" && (
        <section style={{ maxWidth: 560 }}>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
            Configure Google sign-in for admins. Create an OAuth client in the
            Google Cloud console, add the redirect URI below as an authorised
            redirect URI, then paste the client ID and secret here.
          </p>
          <Field label="Authorised redirect URI (add this in Google)">
            <input style={inputStyle} value={sso.redirect_uri} readOnly />
          </Field>
          <Field label="Client ID">
            <input
              style={inputStyle}
              placeholder="xxxxxxxx.apps.googleusercontent.com"
              value={sso.google_client_id}
              onChange={(e) => setSso({ ...sso, google_client_id: e.target.value })}
            />
          </Field>
          <Field label={`Client secret ${sso.google_client_secret_set ? "(set)" : ""}`}>
            <input
              type="password"
              style={inputStyle}
              placeholder={sso.google_client_secret_set ? "••••••••" : "GOCSPX-…"}
              value={ssoSecret}
              onChange={(e) => setSsoSecret(e.target.value)}
            />
          </Field>
          <Field label="Organization domain (Google-only login)">
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "var(--muted)" }}>@</span>
              <input
                style={inputStyle}
                placeholder="example.com"
                value={sso.google_domain}
                onChange={(e) => setSso({ ...sso, google_domain: e.target.value })}
              />
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
              Only emails on this domain can sign in with Google. Leave empty to
              allow any domain permitted by the server.
            </div>
          </Field>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
            {sso.google_client_id
              ? "Google sign-in is enabled."
              : "Leave the client ID blank to disable Google sign-in."}
          </div>
          <Button onClick={saveSso}>Save SSO settings</Button>
          {ssoSaved && <span style={{ color: "#7ee787", marginLeft: 10 }}>Saved</span>}

          {/* Setup guide */}
          <div
            style={{
              marginTop: 22,
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 16,
              background: "var(--bg)",
            }}
          >
            <h4 style={{ margin: "0 0 10px", fontSize: 14 }}>
              ❓ Setup guide — create a Google OAuth client
            </h4>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.9 }}>
              <li>
                Open the{" "}
                <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer">
                  Google Cloud Console
                </a>
                .
              </li>
              <li>
                <a
                  href="https://console.cloud.google.com/projectcreate"
                  target="_blank"
                  rel="noreferrer"
                >
                  Create
                </a>{" "}
                or select a project.
              </li>
              <li>
                Configure the{" "}
                <a
                  href="https://console.cloud.google.com/apis/credentials/consent"
                  target="_blank"
                  rel="noreferrer"
                >
                  OAuth consent screen
                </a>{" "}
                (External or Internal), add your email as a test user if needed.
              </li>
              <li>
                Go to{" "}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noreferrer"
                >
                  Credentials
                </a>{" "}
                → <strong>Create credentials</strong> →{" "}
                <strong>OAuth client ID</strong>.
              </li>
              <li>
                Choose <strong>Web application</strong>.
              </li>
              <li>
                Under <strong>Authorised redirect URIs</strong>, add the URI shown
                above:
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 6,
                  }}
                >
                  <code
                    style={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      padding: "4px 8px",
                      fontSize: 12,
                      wordBreak: "break-all",
                    }}
                  >
                    {sso.redirect_uri}
                  </code>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      navigator.clipboard?.writeText(sso.redirect_uri)
                    }
                  >
                    Copy
                  </Button>
                </div>
              </li>
              <li>
                Copy the generated <strong>Client ID</strong> and{" "}
                <strong>Client secret</strong> into the fields above and save.
              </li>
            </ol>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
              Quick links:{" "}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
              >
                All credentials
              </a>{" "}
              ·{" "}
              <a
                href="https://console.cloud.google.com/apis/dashboard"
                target="_blank"
                rel="noreferrer"
              >
                APIs dashboard
              </a>
            </div>
          </div>
        </section>
      )}

      {tab === "API Keys" && (
        <section>
          {createdKey && (
            <div
              style={{
                background: "#13261a",
                border: "1px solid #2b6b3b",
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
              }}
            >
              New API key (copy now — shown once):
              <pre style={{ whiteSpace: "pre-wrap" }}>{createdKey}</pre>
              <Button variant="ghost" onClick={() => setCreatedKey(null)}>
                Dismiss
              </Button>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            <input
              style={{ ...inputStyle, maxWidth: 200 }}
              placeholder="Key name"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
            />
            {SCOPES.map((s) => (
              <label key={s} style={{ fontSize: 13, color: "var(--muted)" }}>
                <input
                  type="checkbox"
                  checked={newKeyScopes.includes(s)}
                  onChange={() => toggle(newKeyScopes, s, setNewKeyScopes)}
                />{" "}
                {s}
              </label>
            ))}
            <Button onClick={createKey} disabled={!newKeyName}>
              Create key
            </Button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Name</th>
                <th style={th}>Prefix</th>
                <th style={th}>Scopes</th>
                <th style={th}>State</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td style={td}>{k.name}</td>
                  <td style={td}>
                    <code>{k.prefix}…</code>
                  </td>
                  <td style={td}>
                    {k.scopes.map((s) => (
                      <Badge key={s}>{s}</Badge>
                    ))}
                  </td>
                  <td style={td}>{k.revoked_at ? "revoked" : "active"}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    {!k.revoked_at && (
                      <Button variant="danger" onClick={() => revokeKey(k.id)}>
                        Revoke
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "Webhooks" && (
        <section>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            <input
              style={{ ...inputStyle, maxWidth: 280 }}
              placeholder="https://your-endpoint"
              value={hookUrl}
              onChange={(e) => setHookUrl(e.target.value)}
            />
            {EVENTS.map((ev) => (
              <label key={ev} style={{ fontSize: 13, color: "var(--muted)" }}>
                <input
                  type="checkbox"
                  checked={hookEvents.includes(ev)}
                  onChange={() => toggle(hookEvents, ev, setHookEvents)}
                />{" "}
                {ev}
              </label>
            ))}
            <Button onClick={createHook} disabled={!hookUrl || !hookEvents.length}>
              Add webhook
            </Button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>URL</th>
                <th style={th}>Events</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {hooks.map((h) => (
                <tr key={h.id}>
                  <td style={td}>{h.url}</td>
                  <td style={td}>
                    {h.events.map((e) => (
                      <Badge key={e}>{e}</Badge>
                    ))}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <Button variant="danger" onClick={() => deleteHook(h.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
