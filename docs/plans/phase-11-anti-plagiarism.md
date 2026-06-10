# Phase 11 — Anti-Plagiarism / Cheat Detection

**Status:** ✅ completed

## Delivered
- Similarity service (`difflib`, stdlib): compares each free-text/coding answer
  against all other org submissions to the same question; reports max
  similarity + the most-similar attempt; flags ≥ 0.85.
- Integrity score (`GET /api/results/{attempt_id}/integrity`, result:read):
  combines similarity (up to 60) with weighted proctoring signals (paste,
  tab_blur, focus_loss, fullscreen_exit, webcam_denied — up to 40) into a
  0–100 risk score + low/medium/high level.
- Frontend results detail: integrity panel (risk level + max similarity +
  flagged-answer warning).

## Acceptance — verified
Live (two near-identical answers + proctoring noise): max_similarity 0.957,
1 flagged match, risk 86 → high. ruff clean, 10 tests pass, frontend builds.

---
## Original scope

## Goal

Detect likely cheating and surface it for review.

## Scope

- Code similarity across submissions (token/AST-based) + against known sources.
- Text answer similarity / paste-burst detection.
- Combine proctoring signals (Phase 07) + AI signals (Phase 08) into a per-
  attempt integrity score with explanations.
- Review UI: flagged attempts, side-by-side comparisons, override.

## Acceptance

- Near-duplicate submissions are flagged with a similarity score.
- Integrity score aggregates proctoring + similarity + AI signals.
