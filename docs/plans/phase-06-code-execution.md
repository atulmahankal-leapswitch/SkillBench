# Phase 06 — Code Execution (Judge0)

**Status:** ⬜ pending

## Goal

Execute and grade programming questions in a sandbox.

## Scope

- Add self-hosted **Judge0** to Compose (server + workers + its own db/redis),
  env-driven (`JUDGE0_URL`, `JUDGE0_AUTH_TOKEN`).
- Backend client: submit source + stdin, poll/collect result, map languages.
- Coding question payload: starter code, test cases (input/expected),
  time/memory limits, scoring per passing case.
- Candidate code editor (Monaco) with language selection + run/sample tests.
- Grade coding answers by running hidden test cases on submit.

## Acceptance

- Candidate runs sample tests and submits; hidden test cases score the answer.
- Supported-languages list surfaced in the question editor.

## Notes

- Judge0 adds several containers; keep it in the base stack but document
  resource needs.
