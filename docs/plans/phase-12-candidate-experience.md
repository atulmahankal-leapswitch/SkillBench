# Phase 12 — Candidate Experience (Mobile & Branding)

**Status:** ✅ completed

## Delivered
- White-label branding on `Organization` (display_name, logo_url, brand_color)
  + migration 0008. Admin API `GET/PUT /api/branding` (read: any admin; write:
  settings:manage).
- Branding flows to the candidate exam state and is applied on the exam page
  (logo + display name on the intro, brand colour on the primary action).
- Candidate exam page: mobile-responsive layout, viewport meta, a webcam
  notice on the intro when proctoring is enabled.
- Admin settings gains a Branding editor.

## Acceptance — verified
Live: branding defaults empty; PUT updates persist; the public exam state
exposes the updated display name + colour. ruff clean, 10 tests pass, frontend
builds (/exam, /admin/settings).

---
## Original scope

## Goal

Make the candidate-facing experience polished, responsive, and brandable.

## Scope

- Mobile-responsive exam and invite flows; accessibility pass.
- Branding / white-label: org logo, colours, custom subdomain/landing copy.
- Friendly system checks (camera/mic/network) before starting.
- Localised, clear status and error states.

## Acceptance

- Exam flow is usable on mobile and meets basic a11y checks.
- An org can apply its logo/colours to the candidate experience.
