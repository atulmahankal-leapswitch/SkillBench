"use client";

import { useEffect, useState } from "react";
import {
  api,
  ApiError,
  Page,
  Question,
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

type Picked = { question_id: string; prompt: string; weight: string };

type FormState = {
  title: string;
  description: string;
  duration_minutes: number;
  pass_mark: number;
  status: "draft" | "active" | "archived";
  picked: Picked[];
};

const EMPTY: FormState = {
  title: "",
  description: "",
  duration_minutes: 60,
  pass_mark: 60,
  status: "draft",
  picked: [],
};

export default function TestsPage() {
  const [items, setItems] = useState<TestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<TestSummary | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [toAdd, setToAdd] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Page<TestSummary>>(`/tests`);
      setItems(data.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadQuestions() {
    const data = await api.get<Page<Question>>(`/questions?limit=100`);
    setQuestions(data.items);
  }

  async function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
    await loadQuestions();
    setShowForm(true);
  }

  async function openEdit(t: TestSummary) {
    setError(null);
    await loadQuestions();
    const full = await api.get<Test>(`/tests/${t.id}`);
    setEditing(t);
    setForm({
      title: full.title,
      description: full.description,
      duration_minutes: full.duration_minutes,
      pass_mark: full.pass_mark,
      status: full.status,
      picked: full.questions.map((tq) => ({
        question_id: tq.question.id,
        prompt: tq.question.prompt,
        weight: tq.weight == null ? "" : String(tq.weight),
      })),
    });
    setShowForm(true);
  }

  function addQuestion() {
    if (!toAdd) return;
    if (form.picked.some((p) => p.question_id === toAdd)) return;
    const qn = questions.find((q) => q.id === toAdd);
    if (!qn) return;
    setForm({
      ...form,
      picked: [
        ...form.picked,
        { question_id: qn.id, prompt: qn.prompt, weight: "" },
      ],
    });
    setToAdd("");
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= form.picked.length) return;
    const picked = [...form.picked];
    [picked[i], picked[j]] = [picked[j], picked[i]];
    setForm({ ...form, picked });
  }

  async function save() {
    setError(null);
    const questionsPayload = form.picked.map((p, i) => ({
      question_id: p.question_id,
      position: i,
      weight: p.weight === "" ? null : Number(p.weight),
    }));
    const base = {
      title: form.title,
      description: form.description,
      duration_minutes: Number(form.duration_minutes),
      pass_mark: Number(form.pass_mark),
      questions: questionsPayload,
    };
    try {
      if (editing) {
        await api.patch(`/tests/${editing.id}`, {
          ...base,
          status: form.status,
        });
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
              style={{ ...inputStyle, minHeight: 56 }}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
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
                    setForm({
                      ...form,
                      duration_minutes: Number(e.target.value),
                    })
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

          <Field label="Questions (in order)">
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <select
                style={inputStyle}
                value={toAdd}
                onChange={(e) => setToAdd(e.target.value)}
              >
                <option value="">Select a question to add…</option>
                {questions
                  .filter(
                    (q) => !form.picked.some((p) => p.question_id === q.id)
                  )
                  .map((q) => (
                    <option key={q.id} value={q.id}>
                      [{q.type}] {q.prompt.slice(0, 50)}
                    </option>
                  ))}
              </select>
              <Button variant="ghost" onClick={addQuestion}>
                Add
              </Button>
            </div>
            {form.picked.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 13 }}>
                No questions added.
              </p>
            ) : (
              form.picked.map((p, i) => (
                <div
                  key={p.question_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 6,
                  }}
                >
                  <span style={{ color: "var(--muted)", width: 20 }}>
                    {i + 1}.
                  </span>
                  <span style={{ flex: 1, fontSize: 13 }}>
                    {p.prompt.slice(0, 50)}
                  </span>
                  <input
                    style={{ ...inputStyle, width: 90 }}
                    placeholder="weight"
                    value={p.weight}
                    onChange={(e) => {
                      const picked = [...form.picked];
                      picked[i] = { ...p, weight: e.target.value };
                      setForm({ ...form, picked });
                    }}
                  />
                  <Button variant="ghost" onClick={() => move(i, -1)}>
                    ↑
                  </Button>
                  <Button variant="ghost" onClick={() => move(i, 1)}>
                    ↓
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() =>
                      setForm({
                        ...form,
                        picked: form.picked.filter((_, j) => j !== i),
                      })
                    }
                  >
                    ✕
                  </Button>
                </div>
              ))
            )}
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
