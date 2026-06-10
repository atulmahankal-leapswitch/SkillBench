"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client";
import { Badge, Button, ErrorText, inputStyle, PageHeader, td, th } from "@/components/ui";

type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  last_used_at: string | null;
  revoked_at: string | null;
};
type Webhook = { id: string; url: string; events: string[]; active: boolean };

const SCOPES = ["candidate:read", "result:read"];
const EVENTS = ["attempt.submitted", "result.ready"];

export default function SettingsPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [hooks, setHooks] = useState<Webhook[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>([]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [hookUrl, setHookUrl] = useState("");
  const [hookEvents, setHookEvents] = useState<string[]>([]);
  const [brand, setBrand] = useState({
    display_name: "",
    logo_url: "",
    brand_color: "",
  });
  const [brandSaved, setBrandSaved] = useState(false);

  async function load() {
    try {
      setKeys(await api.get<ApiKey[]>("/integrations/api-keys"));
      setHooks(await api.get<Webhook[]>("/integrations/webhooks"));
      setBrand(await api.get("/branding"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load");
    }
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
  useEffect(() => {
    load();
  }, []);

  function toggle(list: string[], v: string, set: (l: string[]) => void) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
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
      <PageHeader title="Settings — Integrations" />
      <ErrorText message={error} />

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

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18 }}>Branding (candidate experience)</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            style={{ ...inputStyle, maxWidth: 200 }}
            placeholder="Display name"
            value={brand.display_name}
            onChange={(e) => setBrand({ ...brand, display_name: e.target.value })}
          />
          <input
            style={{ ...inputStyle, maxWidth: 280 }}
            placeholder="Logo URL"
            value={brand.logo_url}
            onChange={(e) => setBrand({ ...brand, logo_url: e.target.value })}
          />
          <input
            style={{ ...inputStyle, maxWidth: 120 }}
            placeholder="#4f8cff"
            value={brand.brand_color}
            onChange={(e) => setBrand({ ...brand, brand_color: e.target.value })}
          />
          <Button onClick={saveBrand}>Save branding</Button>
          {brandSaved && <span style={{ color: "#7ee787" }}>Saved</span>}
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18 }}>API keys</h2>
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

      <section>
        <h2 style={{ fontSize: 18 }}>Webhooks</h2>
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
    </main>
  );
}
