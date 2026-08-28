# HOMENETMEN HASK — Product Requirements

## Original Problem Statement
Build a modern responsive scouting platform for HOMENETMEN HASK (Est. 1989). Central digital system for scouts, leaders, chapter admins, and national admins to manage programs, progress, communication, and members. Armenian + English contexts. 12 core modules: Login/Role Management, Dashboard, Chapters, Members, Programs, Attendance, Progress Badges, Newsletters, Announcements, Resources, Notifications, Administration.

## Owner
- National admin: `hovsepmarachlian@gmail.com`

## Roles
- National Admin, Chapter Admin, Chapter Leader, Scout, Parent, Guest.

## Auth
- JWT-based custom auth + Emergent Google Auth (with Complete Signup step).

## Non-negotiables
- All file/image uploads must be stored **as base64 in MongoDB** (no S3/object storage).
- Classic scouting visual style (HOMENETMEN HASK branding).
- Programs support capacity limits + waitlist.
- Registration split by scout vs leader with an approval queue.
- Galleries: multi-image base64 upload.
- Centralized Trash Bin / Archive system.
- **Archived items must never appear on the public homepage or in default lists.**

## Completed (as of 2026-02)
- 12 core modules + role-based dashboards.
- Guest landing page with chapters, badges, events, newsletters, leaders, galleries, downloadable resources.
- JWT auth + Emergent Google Auth + CompleteSignup redirect.
- Trash Bin (Chapters, Badges, Resources, **Members**), Archive/Restore, Undo toasts, Bulk actions.
- Parent accounts + read-only dashboards.
- Programs: capacity + waitlist.
- Split registration (scout/leader) + admin approval queue.
- Galleries (multi-image base64 append).
- Promote member → leader with auto role sync.
- HOMENETMEN HASK rebrand.
- Clickable Leader profiles on Guest home (dialog; **only national_admin** can edit).
- Archived exclusion across public/default endpoints.
- Public resources with anonymous download.
- Idempotent seed via `ensure_seed_users_present()` (owner email auto-migrates).
- **Digital Membership Card** (`/members/:id/card`) — printable, QR-scannable, links to public `/verify/:id`.
- **Program Payments** — admins add a `fee` (USD); scouts pay via Stripe hosted checkout before registration is confirmed. Uses the shared emergent Stripe test sandbox (`STRIPE_API_KEY=sk_test_emergent`) because Flow A provisioning is not supported in Armenia (AM).
- **Cascade Chapter Delete** — `DELETE /api/chapters/{id}` returns 409 with impact when linked records exist; caller supplies `reassign_to={target}` or `force=true`. Trash UI shows the cascade dialog.

## Backlog

### P1 — near term
- Guard against invalid base64 in Galleries uploads.
- Log Stripe polling errors instead of silently swallowing them (`payments.py::get_payment_status`).
- Validate `origin_url` in checkout against an allow-list to close open-redirect surface.

### P2 — later
- Camps / Event advanced registration (custom form fields, per-scout guardians).
- Equipment inventory.
- QR code attendance tracking (natural extension of membership card).
- Fully remove registered scouts from Administration "pending" list post-approval.
- Cascade "reassign or cancel" for program-owning chapters (already handled at chapter delete; extend to program cancellation on member removal).

### Refactoring
- Split `/app/backend/server.py` (~2000 lines) into `routes/` + `models/`.
- Add DB transactions around cascade chapter delete for atomicity.

## Key API Endpoints
- Auth: `POST /api/auth/{register,login,session}`, `PUT /api/auth/me`, `GET /api/auth/me`
- Users: `PUT /api/users/{uid}/public-profile` (national_admin only), role/archive/unarchive endpoints.
- Chapters: `GET /api/chapters/{id}/impact`, `DELETE /api/chapters/{id}?reassign_to=&force=`
- Members: `GET /api/members?include_archived=`, `POST /api/members/{id}/unarchive`
- Programs: `POST /api/programs` (with `fee`, `currency`), `POST /api/programs/{id}/register` (free only, else 402)
- Payments: `POST /api/payments/programs/checkout`, `GET /api/payments/status/{session_id}`, `POST /api/webhook/stripe`
- Public: `/api/public/{overview,badges,leaders,newsletters,programs/upcoming,announcements,galleries,resources,members/{id}/verify}`

## Data Storage
- MongoDB (Motor). All media inline as base64.
- `payment_transactions` collection tracks Stripe sessions.

## Tech Stack
- Backend: FastAPI, Motor, JWT, Emergent Google Auth, emergentintegrations Stripe.
- Frontend: React, Tailwind, Shadcn UI, Sonner, qrcode.react.
