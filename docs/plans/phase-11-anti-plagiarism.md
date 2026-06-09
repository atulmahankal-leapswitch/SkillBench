# Phase 11 — Anti-Plagiarism / Cheat Detection

**Status:** ⬜ pending

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
