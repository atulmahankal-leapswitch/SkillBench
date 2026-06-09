"use client";

import { useEffect, useState } from "react";
import { api, ApiError, Page, Question, QuestionType } from "@/lib/client";
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

type Option = { key: string; text: string };
type TestCase = { input: string; expected: string; hidden: boolean };

type FormState = {
  type: QuestionType;
  prompt: string;
  difficulty: "easy" | "medium" | "hard";
  points: number;
  tags: string;
  options: Option[];
  correct_keys: string[];
  sample_answer: string;
  rubric: string;
  starter_code: string;
  test_cases: TestCase[];
};

const EMPTY: FormState = {
  type: "mcq",
  prompt: "",
  difficulty: "medium",
  points: 1,
  tags: "",
  options: [
    { key: "a", text: "" },
    { key: "b", text: "" },
  ],
  correct_keys: [],
  sample_answer: "",
  rubric: "",
  starter_code: "",
  test_cases: [{ input: "", expected: "", hidden: true }],
};

function buildPayload(f: FormState): Record<string, unknown> {
  switch (f.type) {
    case "mcq":
    case "multi_select":
      return { options: f.options, correct_keys: f.correct_keys };
    case "text":
      return { sample_answer: f.sample_answer, rubric: f.rubric };
    case "coding":
      return {
        starter_code: f.starter_code ? { python: f.starter_code } : {},
        test_cases: f.test_cases,
      };
  }
}

export default function QuestionsPage() {
  const [items, setItems] = useState<Question[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Question | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const q = typeFilter ? `?type=${typeFilter}` : "";
      const data = await api.get<Page<Question>>(`/questions${q}`);
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
  }, [typeFilter]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
    setShowForm(true);
  }

  function openEdit(qn: Question) {
    setEditing(qn);
    const p = qn.payload as Record<string, unknown>;
    setForm({
      ...EMPTY,
      type: qn.type,
      prompt: qn.prompt,
      difficulty: qn.difficulty,
      points: qn.points,
      tags: qn.tags.join(", "),
      options: (p.options as Option[]) ?? EMPTY.options,
      correct_keys: (p.correct_keys as string[]) ?? [],
      sample_answer: (p.sample_answer as string) ?? "",
      rubric: (p.rubric as string) ?? "",
      starter_code:
        ((p.starter_code as Record<string, string>)?.python as string) ?? "",
      test_cases: (p.test_cases as TestCase[]) ?? EMPTY.test_cases,
    });
    setError(null);
    setShowForm(true);
  }

  async function save() {
    setError(null);
    const base = {
      prompt: form.prompt,
      difficulty: form.difficulty,
      points: Number(form.points),
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      payload: buildPayload(form),
    };
    try {
      if (editing) {
        await api.patch(`/questions/${editing.id}`, base);
      } else {
        await api.post(`/questions`, { type: form.type, ...base });
      }
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Save failed");
    }
  }

  async function remove(qn: Question) {
    if (!confirm("Delete this question?")) return;
    try {
      await api.del(`/questions/${qn.id}`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Delete failed");
    }
  }

  const isMcq = form.type === "mcq" || form.type === "multi_select";

  function toggleCorrect(key: string) {
    if (form.type === "mcq") {
      setForm({ ...form, correct_keys: [key] });
    } else {
      const set = new Set(form.correct_keys);
      set.has(key) ? set.delete(key) : set.add(key);
      setForm({ ...form, correct_keys: [...set] });
    }
  }

  return (
    <main>
      <PageHeader
        title="Questions"
        action={<Button onClick={openCreate}>+ New question</Button>}
      />

      <div style={{ marginBottom: 16 }}>
        <select
          style={{ ...inputStyle, maxWidth: 220 }}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All types</option>
          <option value="mcq">MCQ (single)</option>
          <option value="multi_select">Multi-select</option>
          <option value="text">Text</option>
          <option value="coding">Coding</option>
        </select>
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
              <th style={th}>Prompt</th>
              <th style={th}>Type</th>
              <th style={th}>Difficulty</th>
              <th style={th}>Points</th>
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
                  No questions yet.
                </td>
              </tr>
            ) : (
              items.map((qn) => (
                <tr key={qn.id}>
                  <td style={{ ...td, maxWidth: 360 }}>
                    {qn.prompt.length > 80
                      ? qn.prompt.slice(0, 80) + "…"
                      : qn.prompt}
                  </td>
                  <td style={td}>
                    <Badge>{qn.type}</Badge>
                  </td>
                  <td style={td}>{qn.difficulty}</td>
                  <td style={td}>{qn.points}</td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    <Button variant="ghost" onClick={() => openEdit(qn)}>
                      Edit
                    </Button>{" "}
                    <Button variant="danger" onClick={() => remove(qn)}>
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
          title={editing ? "Edit question" : "New question"}
          onClose={() => setShowForm(false)}
        >
          <ErrorText message={error} />
          <Field label="Type">
            <select
              style={inputStyle}
              value={form.type}
              disabled={!!editing}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as QuestionType })
              }
            >
              <option value="mcq">MCQ (single correct)</option>
              <option value="multi_select">Multi-select</option>
              <option value="text">Text / short answer</option>
              <option value="coding">Coding</option>
            </select>
          </Field>
          <Field label="Prompt">
            <textarea
              style={{ ...inputStyle, minHeight: 70 }}
              value={form.prompt}
              onChange={(e) => setForm({ ...form, prompt: e.target.value })}
            />
          </Field>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <Field label="Difficulty">
                <select
                  style={inputStyle}
                  value={form.difficulty}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      difficulty: e.target.value as FormState["difficulty"],
                    })
                  }
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </Field>
            </div>
            <div style={{ width: 120 }}>
              <Field label="Points">
                <input
                  type="number"
                  style={inputStyle}
                  value={form.points}
                  onChange={(e) =>
                    setForm({ ...form, points: Number(e.target.value) })
                  }
                />
              </Field>
            </div>
          </div>

          {isMcq && (
            <Field label="Options (select the correct one(s))">
              {form.options.map((o, i) => (
                <div
                  key={i}
                  style={{ display: "flex", gap: 8, marginBottom: 6 }}
                >
                  <input
                    type={form.type === "mcq" ? "radio" : "checkbox"}
                    checked={form.correct_keys.includes(o.key)}
                    onChange={() => toggleCorrect(o.key)}
                  />
                  <input
                    style={{ ...inputStyle, width: 60 }}
                    value={o.key}
                    onChange={(e) => {
                      const options = [...form.options];
                      options[i] = { ...o, key: e.target.value };
                      setForm({ ...form, options });
                    }}
                  />
                  <input
                    style={inputStyle}
                    placeholder="Option text"
                    value={o.text}
                    onChange={(e) => {
                      const options = [...form.options];
                      options[i] = { ...o, text: e.target.value };
                      setForm({ ...form, options });
                    }}
                  />
                  <Button
                    variant="danger"
                    onClick={() =>
                      setForm({
                        ...form,
                        options: form.options.filter((_, j) => j !== i),
                        correct_keys: form.correct_keys.filter(
                          (k) => k !== o.key
                        ),
                      })
                    }
                  >
                    ✕
                  </Button>
                </div>
              ))}
              <Button
                variant="ghost"
                onClick={() =>
                  setForm({
                    ...form,
                    options: [...form.options, { key: "", text: "" }],
                  })
                }
              >
                + Add option
              </Button>
            </Field>
          )}

          {form.type === "text" && (
            <>
              <Field label="Sample answer (optional)">
                <textarea
                  style={{ ...inputStyle, minHeight: 60 }}
                  value={form.sample_answer}
                  onChange={(e) =>
                    setForm({ ...form, sample_answer: e.target.value })
                  }
                />
              </Field>
              <Field label="Rubric (optional)">
                <textarea
                  style={{ ...inputStyle, minHeight: 60 }}
                  value={form.rubric}
                  onChange={(e) => setForm({ ...form, rubric: e.target.value })}
                />
              </Field>
            </>
          )}

          {form.type === "coding" && (
            <>
              <Field label="Starter code (Python)">
                <textarea
                  style={{
                    ...inputStyle,
                    minHeight: 80,
                    fontFamily: "monospace",
                  }}
                  value={form.starter_code}
                  onChange={(e) =>
                    setForm({ ...form, starter_code: e.target.value })
                  }
                />
              </Field>
              <Field label="Test cases">
                {form.test_cases.map((tc, i) => (
                  <div
                    key={i}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: 8,
                      marginBottom: 6,
                    }}
                  >
                    <input
                      style={{ ...inputStyle, marginBottom: 4 }}
                      placeholder="Input"
                      value={tc.input}
                      onChange={(e) => {
                        const test_cases = [...form.test_cases];
                        test_cases[i] = { ...tc, input: e.target.value };
                        setForm({ ...form, test_cases });
                      }}
                    />
                    <input
                      style={{ ...inputStyle, marginBottom: 4 }}
                      placeholder="Expected output"
                      value={tc.expected}
                      onChange={(e) => {
                        const test_cases = [...form.test_cases];
                        test_cases[i] = { ...tc, expected: e.target.value };
                        setForm({ ...form, test_cases });
                      }}
                    />
                    <label style={{ fontSize: 13, color: "var(--muted)" }}>
                      <input
                        type="checkbox"
                        checked={tc.hidden}
                        onChange={(e) => {
                          const test_cases = [...form.test_cases];
                          test_cases[i] = { ...tc, hidden: e.target.checked };
                          setForm({ ...form, test_cases });
                        }}
                      />{" "}
                      Hidden
                    </label>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  onClick={() =>
                    setForm({
                      ...form,
                      test_cases: [
                        ...form.test_cases,
                        { input: "", expected: "", hidden: true },
                      ],
                    })
                  }
                >
                  + Add test case
                </Button>
              </Field>
            </>
          )}

          <Field label="Tags (comma-separated)">
            <input
              style={inputStyle}
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
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
