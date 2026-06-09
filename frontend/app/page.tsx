const apiBase =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const workflow = [
  ["Candidates", "Manage the people being assessed"],
  ["Questions", "Build a bank of MCQ, text & coding questions"],
  ["Tests", "Assemble questions into tests"],
  ["Schedule", "Assign a test to a candidate for a window"],
  ["Take exam", "Candidate completes the test in their window"],
  ["Results", "Auto + AI-assisted grading and analytics"],
];

export default function Home() {
  return (
    <main
      style={{
        maxWidth: 880,
        margin: "0 auto",
        padding: "64px 24px",
      }}
    >
      <p style={{ color: "var(--muted)", margin: 0, letterSpacing: 1 }}>
        ASSESSMENT PLATFORM
      </p>
      <h1 style={{ fontSize: 44, margin: "8px 0 4px" }}>SkillBench</h1>
      <p style={{ color: "var(--muted)", fontSize: 18, marginTop: 0 }}>
        Hiring and internal evaluation — invite, assess, and benchmark talent.
      </p>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
          marginTop: 40,
        }}
      >
        {workflow.map(([title, desc], i) => (
          <div
            key={title}
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 20,
            }}
          >
            <div style={{ color: "var(--accent)", fontWeight: 600 }}>
              {i + 1}. {title}
            </div>
            <div style={{ color: "var(--muted)", fontSize: 14, marginTop: 6 }}>
              {desc}
            </div>
          </div>
        ))}
      </section>

      <p style={{ color: "var(--muted)", marginTop: 40, fontSize: 14 }}>
        Foundation scaffold (Phase 0). API:{" "}
        <a href={`${apiBase}/docs`}>{apiBase}/docs</a>
      </p>
    </main>
  );
}
