# Phase 09 — Integrations (API access + Webhooks)

**Status:** ✅ completed

## Delivered
- `ApiKey` (sha256-hashed, shown once, prefix + scopes, revoke), `Webhook`
  (url/secret/events/active) and `WebhookDelivery` log. Migration 0007.
- Admin APIs (`settings:manage`): create/list/revoke API keys; create/list/
  delete webhooks.
- API-key auth (`X-API-Key`) + `require_scope(...)`; public v1 surface
  `GET /api/v1/candidates` (candidate:read) and `/api/v1/results` (result:read),
  org-scoped.
- Signed webhook dispatch (HMAC-SHA256 `X-SkillBench-Signature`), up to 3
  retries, delivery logged; fired in the background on `attempt.submitted` and
  `result.ready` after grading.
- Frontend `/admin/settings`: API-key + webhook management (key shown once).

## Acceptance — verified
Live: key create returns plaintext once; v1 candidates 200 with scope, 403 wrong
scope, 401 no key; webhook delivered to a 200 endpoint (success, status 200) and
retried/logged HTTP 405 for a non-2xx endpoint; signature is 64-hex. 10 tests
pass, ruff clean, frontend builds.

---
## Original scope

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
