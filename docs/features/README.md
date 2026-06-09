# Features

Per-feature specifications. Each feature is delivered by one or more phases (see
the [plan status board](../plans/README.md)). Detailed specs are added here as
features are designed.

| Feature                         | Phase(s) | Notes                                            |
| ------------------------------- | -------- | ------------------------------------------------ |
| Simple admin & candidate UI     | 0, 4     | Minimal-config, brandable later.                 |
| Google OAuth (org-domain)       | 1        | Admin sign-in restricted to org email domains.   |
| Roles + candidate assignment    | 1        | RBAC; users see only assigned candidates.        |
| Candidate CRUD                  | 2        | Core workflow.                                   |
| Questions CRUD                  | 2        | MCQ, text, coding; JSONB payloads.               |
| Tests CRUD                      | 2        | Compose questions; per-test settings.            |
| Schedule + invite candidate     | 3        | Tokened links, email, time windows.              |
| Candidate takes exam            | 4        | Timed, autosave, resume within window.           |
| Results & grading               | 5        | Auto-grade objective; dashboards.                |
| Programming languages / runner  | 6        | Judge0 self-hosted; coding-question execution.   |
| Proctoring                      | 7        | Webcam monitoring, tab-switch alerts.            |
| AI-assisted features            | 8        | Multi-provider (Claude API, Claude Code SDK, …). |
| Integrations (API + webhooks)   | 9        | API keys, outbound webhooks.                     |
| Benchmarking & analytics        | 10       | Score distributions, percentiles, comparisons.   |
| Anti-plagiarism / cheat detect  | 11       | Similarity, signals, AI assist.                  |
| Candidate experience polish     | 12       | Mobile, branding/white-label.                    |

Phase numbers may shift; the [plan board](../plans/README.md) is authoritative.
