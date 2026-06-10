"use client";

import { useEffect, useState } from "react";
import {
  api,
  ApiError,
  Category,
  Page,
  Test,
  TestSummary,
} from "@/lib/client";
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

type Difficulty = "easy" | "medium" | "hard";
const DIFFS: Difficulty[] = ["easy", "medium", "hard"];

type Proctoring = {
  webcam: boolean;
  tab_switch: boolean;
  fullscreen: boolean;
  block_copy_paste: boolean;
  single_display: boolean;
  record_screen: boolean;
};

// blueprint[categoryId][difficulty] = count (string for the input)
type Blueprint = Record<string, Record<Difficulty, string>>;

type FormState = {
  title: string;
  description: string;
  duration_minutes: number;
  pass_mark: number;
  status: "draft" | "active" | "archived";
  proctoring: Proctoring;
  blueprint: Blueprint;
};

const EMPTY_PROCTORING: Proctoring = {
  webcam: false,
  tab_switch: false,
  fullscreen: false,
  block_copy_paste: false,
  single_display: false,
  record_screen: false,
};

function emptyForm(): FormState {
  return {
    title: "",
    description: "",
    duration_minutes: 60,
    pass_mark: 60,
    status: "draft",
    proctoring: { ...EMPTY_PROCTORING },
    blueprint: {},
  };
}

export default function TestsPage() {
  const [items, setItems] = useState<TestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<TestSummary | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setItems((await api.get<Page<TestSummary>>(`/tests`)).items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function loadCategories() {
    setCategories(await api.get<Category[]>("/categories"));
  }

  async function openCreate() {
    setError(null);
    await loadCategories();
    setEditing(null);
    setForm(emptyForm());
    setShowForm(true);
  }

  async function openEdit(t: TestSummary) {
    setError(null);
    await loadCategories();
    const full = await api.get<Test>(`/tests/${t.id}`);
    const bp: Blueprint = {};
    for (const row of full.blueprint) {
      bp[row.category_id] = bp[row.category_id] ?? { easy: "", medium: "", hard: "" };
      bp[row.category_id][row.difficulty] = String(row.count);
    }
    setEditing(t);
    setForm({
      title: full.title,
      description: full.description,
      duration_minutes: full.duration_minutes,
      pass_mark: full.pass_mark,
      status: full.status,
      proctoring: {
        ...EMPTY_PROCTORING,
        ...((full.settings?.proctoring as Partial<Proctoring>) ?? {}),
      },
      blueprint: bp,
    });
    setShowForm(true);
  }

  function setCell(catId: string, diff: Difficulty, value: string) {
    const cat = form.blueprint[catId] ?? { easy: "", medium: "", hard: "" };
    setForm({
      ...form,
      blueprint: { ...form.blueprint, [catId]: { ...cat, [diff]: value } },
    });
  }

  function totalQuestions(): number {
    let n = 0;
    for (const cat of Object.values(form.blueprint))
      for (const d of DIFFS) n += Number(cat[d]) || 0;
    return n;
  }

  async function save() {
    setError(null);
    const blueprint: { category_id: string; difficulty: Difficulty; count: number }[] =
      [];
    for (const [catId, cells] of Object.entries(form.blueprint)) {
      for (const d of DIFFS) {
        const count = Number(cells[d]) || 0;
        if (count > 0) blueprint.push({ category_id: catId, difficulty: d, count });
      }
    }
    const base = {
      title: form.title,
      description: form.description,
      duration_minutes: Number(form.duration_minutes),
      pass_mark: Number(form.pass_mark),
      settings: { proctoring: form.proctoring },
      blueprint,
    };
    try {
      if (editing) {
        await api.patch(`/tests/${editing.id}`, { ...base, status: form.status });
      } else {
        await api.post(`/tests`, base);
      }
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Save failed");
    }
  }

  async function remove(t: TestSummary) {
    if (!confirm(`Delete test "${t.title}"?`)) return;
    try {
      await api.del(`/tests/${t.id}`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Delete failed");
    }
  }

  return (
    <main>
      <PageHeader
        title="Tests"
        action={<Button onClick={openCreate}>+ New test</Button>}
      />
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
              <th style={th}>Title</th>
              <th style={th}>Status</th>
              <th style={th}>Questions</th>
              <th style={th}>Duration</th>
              <th style={th}>Pass mark</th>
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
                  No tests yet.
                </td>
              </tr>
            ) : (
              items.map((t) => (
                <tr key={t.id}>
                  <td style={td}>{t.title}</td>
                  <td style={td}>
                    <Badge>{t.status}</Badge>
                  </td>
                  <td style={td}>{t.question_count}</td>
                  <td style={td}>{t.duration_minutes} min</td>
                  <td style={td}>{t.pass_mark}%</td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    <Button variant="ghost" onClick={() => openEdit(t)}>
                      Edit
                    </Button>{" "}
                    <Button variant="danger" onClick={() => remove(t)}>
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
          title={editing ? "Edit test" : "New test"}
          onClose={() => setShowForm(false)}
        >
          <ErrorText message={error} />
          <Field label="Title">
            <input
              style={inputStyle}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="Description">
            <textarea
              style={{ ...inputStyle, minHeight: 50 }}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <Field label="Duration (minutes)">
                <input
                  type="number"
                  style={inputStyle}
                  value={form.duration_minutes}
                  onChange={(e) =>
                    setForm({ ...form, duration_minutes: Number(e.target.value) })
                  }
                />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Pass mark (%)">
                <input
                  type="number"
                  style={inputStyle}
                  value={form.pass_mark}
                  onChange={(e) =>
                    setForm({ ...form, pass_mark: Number(e.target.value) })
                  }
                />
              </Field>
            </div>
            {editing && (
              <div style={{ flex: 1 }}>
                <Field label="Status">
                  <select
                    style={inputStyle}
                    value={form.status}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status: e.target.value as FormState["status"],
                      })
                    }
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </Field>
              </div>
            )}
          </div>

          <Field label={`Question blueprint — random draw per category & level (total: ${totalQuestions()})`}>
            {categories.length === 0 ? (
              <span style={{ color: "var(--muted)", fontSize: 13 }}>
                No categories yet. Create some under Categories, then add
                questions to them.
              </span>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...th, padding: "6px 8px" }}>Category</th>
                    {DIFFS.map((d) => (
                      <th
                        key={d}
                        style={{ ...th, padding: "6px 8px", textTransform: "capitalize" }}
                      >
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c, i) => (
                    <tr key={c.id}>
                      <td style={{ ...td, padding: "6px 8px" }}>
                        {i + 1}. {c.name}
                      </td>
                      {DIFFS.map((d) => (
                        <td key={d} style={{ ...td, padding: "6px 8px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <input
                              type="number"
                              min={0}
                              max={c.counts[d]}
                              style={{ ...inputStyle, width: 56, padding: "4px 6px" }}
                              value={form.blueprint[c.id]?.[d] ?? ""}
                              onChange={(e) => setCell(c.id, d, e.target.value)}
                            />
                            <span style={{ color: "var(--muted)", fontSize: 12 }}>
                              /{c.counts[d]}
                            </span>
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Field>

          <Field label="Proctoring">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              {(
                [
                  ["webcam", "Webcam snapshots"],
                  ["tab_switch", "Tab-switch alerts"],
                  ["fullscreen", "Fullscreen"],
                  ["block_copy_paste", "Block copy/paste"],
                  ["single_display", "Single display only"],
                  ["record_screen", "Record screen"],
                ] as [keyof Proctoring, string][]
              ).map(([key, label]) => (
                <label key={key} style={{ fontSize: 13, color: "var(--muted)" }}>
                  <input
                    type="checkbox"
                    checked={form.proctoring[key]}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        proctoring: { ...form.proctoring, [key]: e.target.checked },
                      })
                    }
                  />{" "}
                  {label}
                </label>
              ))}
            </div>
          </Field>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!form.title || totalQuestions() === 0}>
              {editing ? "Save" : "Create"}
            </Button>
          </div>
        </Modal>
      )}
    </main>
  );
}
