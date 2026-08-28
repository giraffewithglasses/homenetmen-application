# HOMENETMEN HASK — Product Requirements

## Original Problem Statement
Build a modern responsive scouting platform for HOMENETMEN HASK (Est. 1989). Central digital system for scouts, leaders, chapter admins, and national admins to manage programs, progress, communication, and members. Armenian + English contexts. 12 core modules: Login/Role Management, Dashboard, Chapters, Members, Programs, Attendance, Progress Badges, Newsletters, Announcements, Resources, Notifications, Administration.

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
- Guest landing page with chapters, badges, events, newsletters, leaders, galleries.
- JWT auth + Emergent Google Auth + CompleteSignup redirect.
- Trash Bin, Archive/Restore, Undo toasts, Bulk actions.
- Parent accounts + read-only dashboards.
- Programs: capacity + waitlist.
- Split registration (scout/leader) + admin approval queue.
- Galleries (multi-image base64 append).
- Promote member → leader with auto role sync.
- HOMENETMEN HASK rebrand.
- Clickable + editable Leader profiles on Guest home (dialog; admins + self can edit name, position, phone, bio, picture).
- Archived users / members hidden from ChapterDetail leaders + members list.
- Archived chapters, badges, members, and users hidden from Guest homepage.
- `/api/members` now excludes archived by default (respects `include_archived=true`).

## Backlog
### P1
- **Digital Membership Card** — printable/scannable scout ID for camps/events.

### P2
- Camps / Event advanced registration (payments, custom forms).
- Equipment inventory.
- QR code attendance tracking.
- Fully remove registered scouts from Administration "pending" list post-approval.

### Refactoring
- Split monolithic `/app/backend/server.py` (~1850 lines) into `routes/` + `models/`.
- Guard base64 upload size limits on Galleries.

## Key API Endpoints
- `POST /api/auth/register` (signup_type: "scout" | "leader")
- `POST /api/auth/login`, `/api/auth/session`
- `PUT  /api/auth/me` (self profile update)
- `PUT  /api/users/{uid}/public-profile` (admin edits leader)
- `PUT  /api/users/{uid}/role` (promote / role sync)
- `POST /api/users/{uid}/archive`, `/api/users/{uid}/unarchive`
- `GET  /api/public/*` (overview, badges, leaders, newsletters, programs/upcoming, announcements, galleries)
- `GET  /api/members?include_archived=true` (default excludes archived)
- `GET  /api/chapters/{id}` — leaders filtered to `status: active`
- `POST /api/galleries/{gid}/images` (multi base64 append)

## Data Storage
- MongoDB (Motor). All media stored inline as base64.

## Tech Stack
- Backend: FastAPI, Motor, JWT, Emergent Google Auth integration.
- Frontend: React, Tailwind, Shadcn UI, Sonner toasts.
