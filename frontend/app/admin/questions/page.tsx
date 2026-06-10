"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  api,
  ApiError,
  Category,
  Page,
  Question,
  QuestionType,
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

type Option = { key: string; text: string };
type TestCase = { input: string; expected: string; hidden: boolean };

type FormState = {
  type: QuestionType;
  prompt: string;
  difficulty: "easy" | "medium" | "hard";
  points: number;
  tags: string;
  category_ids: string[];
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
  category_ids: [],
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
  return (
    <Suspense fallback={null}>
      <QuestionsInner />
    </Suspense>
  );
}

function QuestionsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const paramStr = params.toString();

  // Filters live in the URL (shareable, survive reload).
  const fType = params.get("type") ?? "";
  const fDifficulty = params.get("difficulty") ?? "";
  const fCategory = params.get("category_id") ?? "";
  const fSearch = params.get("q") ?? "";

  const [items, setItems] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Question | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchBox, setSearchBox] = useState(fSearch);

  useEffect(() => {
    api
      .get<Category[]>("/categories")
      .then(setCategories)
      .catch(() => {});
  }, []);

  // Push a filter change into the URL; the load effect reacts to it.
  function setParam(key: string, value: string) {
    const next = new URLSearchParams(paramStr);
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Page<Question>>(
        `/questions${paramStr ? `?${paramStr}` : ""}`
      );
      setItems(data.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSearchBox(fSearch);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramStr]);

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
      category_ids: qn.categories.map((c) => c.id),
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
      category_ids: form.category_ids,
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

  const [genTopic, setGenTopic] = useState("");
  const [generating, setGenerating] = useState(false);

  async function generate() {
    if (!genTopic.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await api.post<{
        questions: { type: string; prompt: string; difficulty: string; payload: Record<string, unknown> }[];
      }>(`/ai/generate-questions`, {
        topic: genTopic,
        type: form.type,
        difficulty: form.difficulty,
        count: 1,
      });
      const g = res.questions[0];
      if (g) {
        const p = g.payload as Record<string, unknown>;
        setForm({
          ...form,
          prompt: g.prompt,
          difficulty:
            (g.difficulty as FormState["difficulty"]) ?? form.difficulty,
          options: (p.options as Option[]) ?? form.options,
          correct_keys: (p.correct_keys as string[]) ?? [],
          sample_answer: (p.sample_answer as string) ?? "",
          rubric: (p.rubric as string) ?? "",
        });
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
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

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 16,
          alignItems: "center",
        }}
      >
        <input
          style={{ ...inputStyle, maxWidth: 240 }}
          placeholder="Search prompt…"
          value={searchBox}
          onChange={(e) => setSearchBox(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setParam("q", searchBox.trim())}
        />
        <Button variant="ghost" onClick={() => setParam("q", searchBox.trim())}>
          Search
        </Button>
        <select
          style={{ ...inputStyle, maxWidth: 180 }}
          value={fCategory}
          onChange={(e) => setParam("category_id", e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          style={{ ...inputStyle, maxWidth: 150 }}
          value={fDifficulty}
          onChange={(e) => setParam("difficulty", e.target.value)}
        >
          <option value="">All levels</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <select
          style={{ ...inputStyle, maxWidth: 170 }}
          value={fType}
          onChange={(e) => setParam("type", e.target.value)}
        >
          <option value="">All types</option>
          <option value="mcq">MCQ (single)</option>
          <option value="multi_select">Multi-select</option>
          <option value="text">Text</option>
          <option value="coding">Coding</option>
        </select>
        {(fSearch || fCategory || fDifficulty || fType) && (
          <Button variant="ghost" onClick={() => router.replace(pathname)}>
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
              <th style={th}>Prompt</th>
              <th style={th}>Categories</th>
              <th style={th}>Type</th>
              <th style={th}>Difficulty</th>
              <th style={th}>Points</th>
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
                  No questions match.
                </td>
              </tr>
            ) : (
              items.map((qn) => (
                <tr key={qn.id}>
                  <td style={{ ...td, maxWidth: 320 }}>
                    {qn.prompt.length > 70
                      ? qn.prompt.slice(0, 70) + "…"
                      : qn.prompt}
                  </td>
                  <td style={td}>
                    {qn.categories.length === 0 ? (
                      <span style={{ color: "var(--muted)" }}>—</span>
                    ) : (
                      qn.categories.map((c) => <Badge key={c.id}>{c.name}</Badge>)
                    )}
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
          {!editing && (
            <div
              style={{
                marginBottom: 14,
                padding: 10,
                border: "1px dashed var(--border)",
                borderRadius: 8,
              }}
            >
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>
                Prompt — describe what to ask; AI fills the question & details
                (uses the selected type & difficulty).
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  style={inputStyle}
                  placeholder="e.g. JavaScript closures, intermediate level"
                  value={genTopic}
                  onChange={(e) => setGenTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && generate()}
                />
                <Button variant="ghost" onClick={generate} disabled={generating}>
                  {generating ? "Generating…" : "✨ Generate"}
                </Button>
              </div>
            </div>
          )}
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
          <Field label="Categories">
            {categories.length === 0 ? (
              <span style={{ color: "var(--muted)", fontSize: 13 }}>
                No categories yet — add some under Categories.
              </span>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {categories.map((c) => (
                  <label key={c.id} style={{ fontSize: 13, color: "var(--muted)" }}>
                    <input
                      type="checkbox"
                      checked={form.category_ids.includes(c.id)}
                      onChange={() => {
                        const has = form.category_ids.includes(c.id);
                        setForm({
                          ...form,
                          category_ids: has
                            ? form.category_ids.filter((x) => x !== c.id)
                            : [...form.category_ids, c.id],
                        });
                      }}
                    />{" "}
                    {c.name}
                  </label>
                ))}
              </div>
            )}
          </Field>
          <Field label="Question">
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
