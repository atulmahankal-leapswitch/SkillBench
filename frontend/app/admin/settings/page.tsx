"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client";
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

const SCOPES = ["candidate:read", "result:read"];
const EVENTS = ["attempt.submitted", "result.ready"];
const TABS = ["Branding", "AI Provider", "API Keys", "Webhooks"] as const;
type Tab = (typeof TABS)[number];

const PROVIDER_LABELS: Record<string, string> = {
  "": "Disabled",
  anthropic: "Anthropic (Claude API)",
  claude_code_sdk: "Claude Code SDK",
  openai: "OpenAI",
  stub: "Stub (testing only)",
};

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("Branding");
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
          <Field label="Brand colour (hex)">
            <input
              style={{ ...inputStyle, maxWidth: 160 }}
              placeholder="#4f8cff"
              value={brand.brand_color}
              onChange={(e) => setBrand({ ...brand, brand_color: e.target.value })}
            />
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

          {ai.providers_needing_key.includes(ai.provider) && (
            <Field label="API key">
              <input
                type="password"
                style={inputStyle}
                placeholder={
                  ai.api_key_set ? ai.api_key_masked : "sk-… (required)"
                }
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
