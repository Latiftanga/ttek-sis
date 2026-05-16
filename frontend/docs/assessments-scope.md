# Assessments — V1 Scope

Locked scope for the first cut of the assessments feature. Subsequent phases
extend it; do not change V1 decisions without a follow-up to this doc.

## Terminology

In Ghana, **"grade"** is reserved for the letter assigned to a mark (A, B, C…).
What other countries call "grades" or "gradebook" is called **"assessment"** or
**"marks"** here. This feature is therefore named **Assessments**. The word
"grade" appears only on the letter label of a `GradingBand` and on report output.

In UI copy, what the backend calls an **`assessment_category`** is shown as an
**"assessment mode"** (e.g. *Class Test*, *Exercise*, *Project*, *End of Term
Exam*). The DB table, model, schemas, and route paths still use `category` —
only user-facing strings, labels, and planning text say *mode*.

## Who & what

**Primary user**: subject teacher, after a class test or exercise. Walks in with
marked papers, picks the class + subject + assessment, types in marks, saves.
Should take under 5 minutes for a class of 40.

**Secondary user**: head teacher / school admin. Sets up assessment modes
("Class Test 40%, End of Term 60%") and grading scales (WAEC bands etc.) once.
Watches the audit if scores look off.

**Tertiary user**: student / parent — out of V1 frontend scope. Publish toggle
is wired so a portal can land later without re-engineering.

## Decisions (locked)

| # | Decision |
|---|---|
| 1 | **Publish flow**: scores stay private to the teacher until they tap **Publish**. After publish, the student/parent portal (future) will be able to see them. Edits after publish still require an `edit_reason` (backend audit). |
| 2 | **Who can create what**: <ul><li>**Modes + grading scales** — admin or headteacher only.</li><li>**Assessments** — the teacher who is assigned to that (class, subject) in `class_subjects.teacher_id`. Class teachers and admins can also create across their class. Other teachers cannot.</li></ul> Permission enforcement on the backend is a small prerequisite — see "Backend prerequisites" below. |
| 3 | **Seed defaults on new school**: yes. Seed grading scales (**WAEC SHS / WASSCE**, **WAEC BECE**, **Primary**) and a baseline mode set (**Class Test**, **Exercise**, **Project**, **End of Term Exam**) so a school can start scoring without touching setup. |
| 4 | **Max score on an assessment**: pre-fill from the mode's baseline max, teacher can override per-assessment. Backend normalizes every score to a percentage of its own `max_score` before mode averaging — so overrides do not break math. |
| 5 | **Absent students**: a separate toggle next to the score input, not a magic value in the same field. Toggling Absent disables the number input. Backend stores `is_absent=true` with `score=NULL`. |

## How the math works (for UI grounding)

Per backend `_compute_ca_score`:

1. Each score → percentage of its own assessment max.
2. Percentages within a mode are averaged.
3. Mode average × mode weight = contribution to term total.
4. Sum across modes = term raw score → grading scale → letter + position.

UI implication: always show the **per-assessment max** prominently
("This assessment is out of: 10") so teachers know the scale they're scoring on.
The mode baseline max is only a default, not a constraint.

## Backend prerequisites for V1

Small backend tweaks needed before frontend phases lock down:

1. **Expose `staff_id` on the auth/me response** (or add `GET /me/teachable-classes`) so the frontend can filter the "create assessment" class+subject dropdowns to what the logged-in teacher is assigned to.
2. **Seed defaults**: SHS/WASSCE, BECE, Primary grading scales + baseline assessment modes on new school registration.
3. **Permission tighten on assessment create**: enforce the rule from decision #2 server-side. Current router checks school scope but not teacher assignment.

These can land alongside Phase 1 or just ahead of Phase 2 when the dropdown UX needs them.

## Phases

### Phase 1 — Plumbing + list + rename

- Rename sidebar "Gradebook" → **Assessments**.
- `/assessments` home: filterable list (class, subject, term) of assessments with title, class, subject, date, count of scores entered, published badge.
- Dashboard quick action: "Enter assessments" → `/assessments`.
- `lib/api.ts` wrappers for the assessment endpoints; `useAssessments`-style hooks.
- Term gate (same pattern as attendance — must have current term).

### Phase 2 — Create + enter scores

- `/assessments/new`: create form (class, subject, mode, title, date, max-score with pre-fill).
- `/assessments/[id]`: score-entry screen — roster with score input + absent toggle per student; save updates pending; **Publish** button (disabled until at least one score saved).
- Honors decision #2 — only show classes the teacher is assigned to.

### Phase 3 — Edit, publish/unpublish, score history

- Per-row edit modal with mandatory `edit_reason` (mirrors attendance Phase 3).
- Unpublish lets admin re-open for corrections.
- Inline indicator on rows that were edited; click for full history (`/scores/{id}/history` endpoint).

### Phase 4 — Admin setup screen

- `/assessments/setup` with two tabs:
  - **Modes**: list + add (name, weight, max, is_ca, allows_multiple, order).
  - **Grading scales**: list + add (name, bands with min/max/label/remark).
- Block deletion when an active assessment uses the mode/scale (or warn-and-cascade with confirmation, TBD during build).

## Not in V1

- Term result computation UI (the `POST /term-results/compute` endpoint exists; admin batch trigger comes later).
- Term result locking + WAEC export workflow.
- Per-student score history standalone page (history is reachable from edit modal in Phase 3).
- Audit / suspicious-activity admin report.
- Bulk paste / CSV import for scores.
- Parent / student portal.
- Report cards / printed term reports.
