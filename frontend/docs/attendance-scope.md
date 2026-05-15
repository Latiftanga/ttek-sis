# Attendance — V1 Scope

Locked scope for the first cut of the attendance feature. Subsequent phases
extend it; do not change V1 decisions without a follow-up to this doc.

## Who & what

**Primary user**: class teacher, every school morning, on a phone or low-spec
laptop. Should take under 90 seconds for a class of 40.

**Secondary user**: head teacher / school admin, wants a daily snapshot — who
took attendance, who didn't, anomalies.

## Decisions

| # | Decision |
|---|---|
| 1 | **Who can mark**: class teacher of that class, headteacher, school_admin. Other roles: view-only (or no access — pick during build). |
| 2 | **Term required**: hard-block with friendly message ("No current term set. Ask a head teacher or admin to set one in Academic → Calendar"). |
| 3 | **Default mark**: Present. Tap cycles Present → Absent → Late → Excused → Present. |
| 4 | **Reason**: silent. Always available via a small note icon next to a marked row. Never auto-prompted, even for Excused (backend does not enforce). |
| 5 | **Periods / per-lesson mode**: out of scope. Daily mode only. When per-lesson is added later, periods management belongs under Academic. |

## Phases

### Phase 1 — Attendance home + plumbing

- `/attendance` route.
  - Class teacher: their class card with today's status badge (Not started / In progress / Submitted), plus last 7 days.
  - Head teacher / admin: list of all classes with today's status, sorted "not started" first.
  - Term gate at the top of the page.
- `lib/api.ts` wrappers: `getTodayForClass(classId)`, `listRecords(sessionId)`, `patchRecord(recordId, body)`, `getSchoolToday()`.
- Dashboard: re-add "Take attendance" quick action.
- Sidebar: add Attendance nav item.

### Phase 2 — Roster screen

- `/attendance/class/[classId]` — today's session, create-and-mark-in-one-go.
- Tap-to-cycle status, optional reason note, bottom-pinned Submit.
- Counter ("X of Y decided").
- Submit → toast → back to `/attendance`.

### Phase 3 — View & edit submitted session

- `/attendance/class/[classId]/sessions/[sessionId]` — read-only by default.
- Per-row "Edit" → modal with new status + mandatory `edit_reason`.

### Phase 4 — Admin "School Today" view + alerts

- `/attendance/today`: school-wide submission status + late-class chasing.
- Show flagged sessions (view-only for now).

## Not in V1

Per-lesson mode · offline batch sync · anti-fraud review actions
(clear/penalise) · parent portal · student attendance summary page · exports.
