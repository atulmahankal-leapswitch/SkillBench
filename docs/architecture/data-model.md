# Data Model (planned)

The concrete tables are created by Alembic migrations in their respective
phases. This is the target shape so phases stay consistent.

```
Organization 1───* User (admin)        User *───* Role        Role *───* Permission
     │                                   │
     │ (domain-scoped)                   │ assigned candidates
     ▼                                   ▼
 Candidate *────────── Schedule ──────────* Test *───* Question
     │                    │                              │
     │                    ▼                              ▼
     └──────────── Attempt ───* Answer            QuestionType (mcq|text|coding|…)
                       │
                       ├──* ProctorEvent (tab-switch, webcam frame ref, …)
                       └──* Result (per-question score + aggregate)
```

## Core entities

| Entity         | Purpose                                                              |
| -------------- | -------------------------------------------------------------------- |
| **Organization** | Tenant boundary; owns users, candidates, question bank, tests.     |
| **User**         | Admin/recruiter. Google-authenticated, domain-restricted.          |
| **Role / Permission** | RBAC; roles gate actions and which candidates a user manages. |
| **Candidate**    | Person being assessed (external hire or internal employee).        |
| **Question**     | A bank item. `type` + JSONB `payload` (options, test cases, …).    |
| **Test**         | Ordered/weighted set of questions + settings (duration, proctoring).|
| **Schedule**     | Assignment of a Test to a Candidate for a `[start, end]` window.    |
| **Invitation**   | Tokened link tied to a Schedule (no candidate account needed).     |
| **Attempt**      | A candidate's run of a scheduled test (state machine).             |
| **Answer**       | Candidate response to one question within an Attempt.              |
| **ProctorEvent** | Integrity signal captured during an Attempt.                       |
| **Result**       | Grading output: per-question + aggregate, plus AI rationale.       |
| **Webhook**      | Outbound integration endpoint + event subscriptions.              |
| **ApiKey**       | Credential for external API access.                                |

## Conventions

- Primary keys: UUID (`gen_random_uuid()`), enabled via the `pgcrypto`
  extension in `docker/postgres/init.sql`.
- Timestamps: `created_at`, `updated_at` (UTC) on every table.
- Soft-delete where audit matters (candidates, attempts): `deleted_at`.
- Flexible per-question data (MCQ options, coding test cases) stored as JSONB.
- All queries scoped by `organization_id` for tenant isolation.

> Detailed column lists live in each phase plan / migration as tables are built.
