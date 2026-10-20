# CampusCheck frontend handoff

## Current state

- The Vite/React/TypeScript app is in `C:\Dev\ATMs-F`; Node 24.22.0 and pnpm 10.8.1 are installed. Use `pnpm.cmd` in PowerShell.
- `src/app/App.tsx` has been reduced to the app shell and route declarations. Student, lecturer, admin, auth, and shared UI modules are under their feature/shared folders.
- Demo accounts and a mock-only session have been added. `VITE_USE_MOCKS=true` is required; mock session identity is in memory and a role flag in `sessionStorage`, never in an access token.
- The shared demo store now drives student check-ins, course enrollments, student history, lecturer rosters/reports, overrides, scanner state, fixed-code state, and the print sheet. The app bar and login panel both offer a demo reset action.
- Student routes are loaded from the student module in the entry bundle. Lecturer and admin feature modules are dynamically imported; the current production build emits separate feature chunks.
- Student navigation is role-specific: student bottom tabs are rendered only for students; lecturer/admin use the mobile drawer.
- The synced OpenAPI aliases and implemented auth, check-in, roster, report CSV and override requests have been reconciled with the contract. Session creation/code/end now use the returned session ID; student check-in selects its session from `GET /me/live-classes`. `GET /venues` and `GET /me/live-classes` are local `x-draft: true` operations pending backend confirmation. Unsupported password-reset operations are not sent to guessed endpoints.
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

1. Route after login using the role returned by backend `GET /me` rather than the demo role/default.
2. Replace seeded lecturer report data with backend responses and verify the locally drafted operations with the backend owner.
3. Add responsive-navigation tests only after the user's current deferral is lifted.

See `PROGRESS.md` for the screen-by-screen inventory and outstanding checks.
