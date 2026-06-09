# Phase 09 — Integrations (API access + Webhooks)

**Status:** ⬜ pending

## Goal

Let external systems (ATS, internal tools) integrate with SkillBench.

## Scope

- `ApiKey` issuance/rotation/revocation; API-key auth scheme + scoping.
- Public, documented REST surface for candidates/tests/schedules/results.
- `Webhook` endpoints + event subscriptions (e.g. `attempt.submitted`,
  `result.ready`); signed payloads, delivery retries, delivery log.
- Admin UI to manage keys and webhooks.

## Acceptance

- External call with a valid API key performs scoped actions.
- Subscribed events deliver signed webhooks with retry on failure.
