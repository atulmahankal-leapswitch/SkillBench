# Phase 08 — AI-Assisted Features

**Status:** ⬜ pending

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
