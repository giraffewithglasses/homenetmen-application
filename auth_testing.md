# Auth Testing Playbook

## Backend Auth Endpoints (JWT)
- POST /api/auth/register  { email, password, name }
- POST /api/auth/login     { email, password }  -> sets httpOnly access_token + refresh_token cookies
- POST /api/auth/logout    -> clears cookies
- GET  /api/auth/me        -> returns current user (cookie or Bearer token)
- POST /api/auth/session   { session_id }       (Emergent Google Auth callback; sets session_token cookie)

## Seeded Accounts
- admin@scouts.am / admin123  (national_admin)
- ararat.leader@scouts.am / scout123  (chapter_admin, chapter=Ararat)
- sevan.leader@scouts.am / scout123  (chapter_leader, chapter=Sevan)
- narek@scouts.am / scout123  (scout, chapter=Ararat)

## Curl checks
```
curl -c cookies.txt -X POST $BACKEND/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@scouts.am","password":"admin123"}'
curl -b cookies.txt $BACKEND/api/auth/me
```
