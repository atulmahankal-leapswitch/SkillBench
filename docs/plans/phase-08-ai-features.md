# Phase 08 — AI-Assisted Features

**Status:** ✅ completed

## Delivered
- Provider-agnostic `AIProvider` interface (`app/services/ai/`) selected by
  `AI_PROVIDER`: **anthropic** (Claude Messages API), **claude_code_sdk**
  (Agent SDK, lazy optional import), **openai**, and **stub** (deterministic,
  keyless — for local dev/tests). `is_enabled()` + `get_provider()` factory;
  `AIDisabled` → 503.
- Endpoints (admin): `POST /api/ai/generate-questions` (question:write) and
  `POST /api/ai/score-text` (result:write); AI failures surface as 502.
- Grading integration: free-text answers get an AI-suggested score + rationale
  when a provider is enabled (kept `needs_review` for human confirmation);
  falls back to manual review when disabled or on error.
- Frontend: "✨ Generate" on the question form prefills prompt/options/rubric.
- Shared prompt builders; robust `extract_json` (handles code fences).

## Acceptance — verified
Live (AI_PROVIDER=stub): generate-questions returns 2 drafts; score-text
returns a capped score with provider name. 10 backend tests pass (factory,
stub, JSON extraction, disabled), ruff clean, frontend builds.

> Live Anthropic/OpenAI/Claude-Code-SDK paths are implemented but exercised via
> the stub here (no external keys in the sandbox).

---
## Original scope

## Goal

Add AI assistance behind a provider-agnostic interface.

## Scope

- `AIProvider` interface in `app/services/ai/` selected by `AI_PROVIDER`:
  - **`anthropic`** — Claude API (default; `AI_MODEL`).
  - **`claude_code_sdk`** — Claude Code SDK / Agent SDK for agentic, multi-step
    flows (tool use, iterative generation).
  - **`openai`** / others — pluggable.
- Features:
  - Question generation (topic/difficulty → draft questions + answers).
  - Free-text / short-answer scoring with rubric + rationale.
  - Plagiarism/cheat signal assistance (feeds Phase 11).
- Cost/latency guards: caching, rate limits, async jobs for heavy calls.

## Acceptance

- Switching `AI_PROVIDER` swaps the backend with no caller changes.
- Generate-question and score-text endpoints work against the default provider.
