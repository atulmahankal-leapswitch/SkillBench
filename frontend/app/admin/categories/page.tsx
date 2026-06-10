"use client";

import { useEffect, useState } from "react";
import { api, ApiError, Category } from "@/lib/client";
import { Button, ErrorText, inputStyle, PageHeader, td, th } from "@/components/ui";

export default function CategoriesPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setItems(await api.get<Category[]>("/categories"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!name.trim()) return;
    setError(null);
    try {
      await api.post("/categories", { name });
      setName("");
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Create failed");
    }
  }

  async function remove(c: Category) {
    if (!confirm(`Delete category "${c.name}"? Questions keep existing.`)) return;
    try {
      await api.del(`/categories/${c.id}`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Delete failed");
    }
  }

  return (
    <main>
      <PageHeader title="Categories" />
      <p style={{ color: "var(--muted)", marginTop: -8 }}>
        Group questions by topic. Tests draw a number of questions per category
        and difficulty.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, maxWidth: 420 }}>
        <input
          style={inputStyle}
          placeholder="New category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
        />
        <Button onClick={create} disabled={!name.trim()}>
          Add
        </Button>
      </div>
      <ErrorText message={error} />

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
              <th style={th}>Category</th>
              <th style={th}>Easy</th>
              <th style={th}>Medium</th>
              <th style={th}>Hard</th>
              <th style={th}>Total</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td style={td} colSpan={6}>
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td style={{ ...td, color: "var(--muted)" }} colSpan={6}>
                  No categories yet.
                </td>
              </tr>
            ) : (
              items.map((c) => (
                <tr key={c.id}>
                  <td style={td}>{c.name}</td>
                  <td style={td}>{c.counts.easy}</td>
                  <td style={td}>{c.counts.medium}</td>
                  <td style={td}>{c.counts.hard}</td>
                  <td style={td}>{c.counts.total}</td>
                  <td style={{ ...td, textAlign: "right" }}>
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
    </main>
  );
}
