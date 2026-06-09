# Phase 02 — Core CRUD (Candidates, Questions, Tests)

**Status:** ⬜ pending

## Goal

Full management of the three core entities behind the workflow.

## Scope

- **Candidate** CRUD: name, email, tags, source (external/internal), notes.
- **Question** CRUD: `type` (mcq, multi-select, text, coding, …) + JSONB
  `payload` (options/correct answers, prompt, coding test cases), difficulty,
  tags, scoring weight.
- **Test** CRUD: title, description, ordered questions with weights, duration,
  pass mark, proctoring/settings flags.
- List endpoints with pagination, search, filtering; org-scoped + RBAC-gated.
- Frontend admin screens (tables + create/edit forms) for each.

## Acceptance

- Create/read/update/delete works for all three via API and UI.
- Validation enforces type-specific payload shape.
- All data scoped to the caller's organisation and permissions.
