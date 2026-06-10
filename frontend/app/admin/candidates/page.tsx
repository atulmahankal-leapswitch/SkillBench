"use client";

import { Suspense, useEffect, useState } from "react";
import {
  api,
  ApiError,
  Candidate,
  Page,
} from "@/lib/client";
import { useUrlParam } from "@/lib/url";
import {
  Badge,
  Button,
  ErrorText,
  Field,
  inputStyle,
  Modal,
  PageHeader,
  td,
  th,
} from "@/components/ui";

type FormState = {
  full_name: string;
  email: string;
  source: "external" | "internal";
  tags: string;
  notes: string;
};

const EMPTY: FormState = {
  full_name: "",
  email: "",
  source: "external",
  tags: "",
  notes: "",
};

export default function CandidatesPage() {
  return (
    <Suspense fallback={null}>
      <CandidatesInner />
    </Suspense>
  );
}

function CandidatesInner() {
  const [urlSearch, setUrlSearch] = useUrlParam("q", "");
  const [items, setItems] = useState<Candidate[]>([]);
  const [search, setSearch] = useState(urlSearch);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Candidate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const q = urlSearch ? `?q=${encodeURIComponent(urlSearch)}` : "";
      const data = await api.get<Page<Candidate>>(`/candidates${q}`);
      setItems(data.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSearch(urlSearch);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearch]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
    setShowForm(true);
  }

  function openEdit(c: Candidate) {
    setEditing(c);
    setForm({
      full_name: c.full_name,
      email: c.email,
      source: c.source,
      tags: c.tags.join(", "),
      notes: c.notes,
    });
    setError(null);
    setShowForm(true);
  }

  async function save() {
    setError(null);
    const payload = {
      full_name: form.full_name,
      email: form.email,
      source: form.source,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      notes: form.notes,
    };
    try {
      if (editing) {
        await api.patch(`/candidates/${editing.id}`, payload);
      } else {
        await api.post(`/candidates`, payload);
      }
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Save failed");
    }
  }

  async function remove(c: Candidate) {
    if (!confirm(`Delete candidate ${c.full_name}?`)) return;
    try {
      await api.del(`/candidates/${c.id}`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Delete failed");
    }
  }

  return (
    <main>
      <PageHeader
        title="Candidates"
        action={<Button onClick={openCreate}>+ New candidate</Button>}
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setUrlSearch(search.trim())}
          style={{ ...inputStyle, maxWidth: 320 }}
        />
        <Button variant="ghost" onClick={() => setUrlSearch(search.trim())}>
          Search
        </Button>
        {urlSearch && (
          <Button variant="ghost" onClick={() => setUrlSearch("")}>
            Clear
          </Button>
        )}
      </div>

      <ErrorText message={!showForm ? error : null} />

      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Email</th>
              <th style={th}>Source</th>
              <th style={th}>Tags</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td style={td} colSpan={5}>
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td style={{ ...td, color: "var(--muted)" }} colSpan={5}>
                  No candidates yet.
                </td>
              </tr>
            ) : (
              items.map((c) => (
                <tr key={c.id}>
                  <td style={td}>{c.full_name}</td>
                  <td style={td}>{c.email}</td>
                  <td style={td}>{c.source}</td>
                  <td style={td}>
                    {c.tags.map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                  </td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    <Button variant="ghost" onClick={() => openEdit(c)}>
                      Edit
                    </Button>{" "}
                    <Button variant="danger" onClick={() => remove(c)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal
          title={editing ? "Edit candidate" : "New candidate"}
          onClose={() => setShowForm(false)}
        >
          <ErrorText message={error} />
          <Field label="Full name">
            <input
              style={inputStyle}
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </Field>
          <Field label="Email">
            <input
              style={inputStyle}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Source">
            <select
              style={inputStyle}
              value={form.source}
              onChange={(e) =>
                setForm({
                  ...form,
                  source: e.target.value as "external" | "internal",
                })
              }
            >
              <option value="external">External (hiring)</option>
              <option value="internal">Internal (employee)</option>
            </select>
          </Field>
          <Field label="Tags (comma-separated)">
            <input
              style={inputStyle}
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
            />
          </Field>
          <Field label="Notes">
            <textarea
              style={{ ...inputStyle, minHeight: 70 }}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={save}>{editing ? "Save" : "Create"}</Button>
          </div>
        </Modal>
      )}
    </main>
  );
}
