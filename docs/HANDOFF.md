# CampusCheck frontend handoff

## Current state

- The Vite/React/TypeScript app is in `C:\Dev\ATMs-F`; Node 24.22.0 and pnpm 10.8.1 are installed. Use `pnpm.cmd` in PowerShell.
- `src/app/App.tsx` has been reduced to the app shell and route declarations. Student, lecturer, admin, auth, and shared UI modules are under their feature/shared folders.
- Demo accounts and a mock-only session have been added. `VITE_USE_MOCKS=true` is required; mock session identity is in memory and a role flag in `sessionStorage`, never in an access token.
- The shared demo store now drives student check-ins, course enrollments, student history, lecturer rosters/reports, overrides, scanner state, fixed-code state, and the print sheet. The app bar and login panel both offer a demo reset action.
- Student routes are loaded from the student module in the entry bundle. Lecturer and admin feature modules are dynamically imported; the current production build emits separate feature chunks.
- Student navigation is role-specific: student bottom tabs are rendered only for students; lecturer/admin use the mobile drawer.
- The synced OpenAPI aliases and implemented auth, check-in, roster, report CSV and override requests have been reconciled with the contract. The lecturer start form uses `GET /me/offerings` and `GET /venues`, submits only the schema-shaped session options, and propagates the returned session ID to code polling and ending. Student check-in selects its session from `GET /me/live-classes`.
- Startup and post-login routing now load `GET /me`, map the returned role to the user's workspace, and enforce route-level role guards that redirect unauthorized access to `/403`. The app bar shows the returned name and email instead of a UUID; the profile retains department ID and level details. The contract does not provide a human-readable department name.
- Lecturer live attendance and session reports now use paginated API responses in real mode; report and roster PDFs download from the server. Mock mode retains fixtures and its print fallback. The API does not include report timestamps or department names, so those values are not fabricated.
- The lecturer Live session nav resumes an active session started by that lecturer in the current tab using only its ID (not the attendance code).
- Lecturer session reports persist in browser local storage by session ID, offering ID, start time, and course label; finished reports can be reopened from My teaching or Session reports. The report contents still load from the API, and discovery of sessions started on another device requires a backend session-list endpoint.
- Department, faculty, and institution admins can use Courses & offerings to browse offerings visible within their authenticated API scope and see the lecturers assigned to each course. The unified course form can create a new course and make it available for a selected semester in one submit, or schedule an existing course for another semester. It accepts an optional lecturer account UUID and assigns it to the created semester offering; it first reads current assignments and uses the replacement `PUT /offerings/{id}/lecturers` with existing IDs retained. If the offering is a 202 teaching request, the UI tells admins to assign a lecturer after approval. The backend stores the course record and semester offering separately, so new-course submission calls typed `POST /courses` followed by `POST /offerings`; if the second request fails, the UI explicitly reports that the course exists but was not made available for the semester. Successful offerings refresh the searchable course list. Existing course/semester offerings can have lecturers managed with their per-row “Manage lecturers” action. Department admins use their own department from `GET /me`, while faculty/institution admins select a department and the backend validates scope. The GET response fields (`id`, `display_name`, `email`) are generated from the updated OpenAPI schema. There is no endpoint for a directory of unassigned staff, so a lecturer account UUID must be supplied manually. Faculty-admin roles are mapped to the admin workspace from `GET /me`. Course/offering edit and archive flows remain unimplemented.
- The session-ID wiring task is complete; the final lint, typecheck, full test suite (39 tests), and production build passed. The real backend was not reachable during this session; exact build sizes and check output are in `PROGRESS.md`.
- `pnpm sync:api` copies from `C:\Dev\ATMs\api\openapi.yaml` by default and generates `src/api/schema.d.ts`. Real API login and student claim require `VITE_INSTITUTION_ID`; see `API_ASSUMPTIONS.md`.
- The design-reference directory is currently absent. Addendum artboards have not been provided.

## Working agreements

- Read this file and `PROGRESS.md` before starting another task.
- Work on one task at a time. After each task run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`; record actual results in `PROGRESS.md`.
- Update `PROGRESS.md` when implementation status changes. Keep mock inventory and manual-device limitations current.
- Use `pnpm` scripts only, generated API types for API payloads, and the central API error map.
- Never persist access tokens, attendance codes, or queued mutations. Avoid `dangerouslySetInnerHTML`.

## Next implementation order

1. Verify lecturer live-session, report, and PDF behavior against the real backend.
2. Add responsive-navigation tests only after the user's current deferral is lifted.

See `PROGRESS.md` for the screen-by-screen inventory and outstanding checks.
