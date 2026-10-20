# CampusCheck frontend handoff

## Current state

- The Vite/React/TypeScript app is in `C:\Dev\ATMs-F`; Node 24.22.0 and pnpm 10.8.1 are installed. Use `pnpm.cmd` in PowerShell.
- `src/app/App.tsx` has been reduced to the app shell and route declarations. Student, lecturer, admin, auth, and shared UI modules are under their feature/shared folders.
- Demo accounts and a mock-only session have been added. `VITE_USE_MOCKS=true` is required; mock session identity is in memory and a role flag in `sessionStorage`, never in an access token.
- The shared demo store now drives student check-ins, course enrollments, student history, lecturer rosters/reports, overrides, scanner state, fixed-code state, and the print sheet. The app bar and login panel both offer a demo reset action.
- Student routes are loaded from the student module in the entry bundle. Lecturer and admin feature modules are dynamically imported; the current production build emits separate feature chunks.
- Student navigation is role-specific: student bottom tabs are rendered only for students; lecturer/admin use the mobile drawer.
- Latest full lint/typecheck/test/build verification passed: 34 tests across 10 files; lint has six existing Fast Refresh warnings. See `PROGRESS.md` for measured sizes.
- The design-reference directory is currently absent. Addendum artboards have not been provided.

## Working agreements

- Read this file and `PROGRESS.md` before starting another task.
- Work on one task at a time. After each task run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`; record actual results in `PROGRESS.md`.
- Update `PROGRESS.md` when implementation status changes. Keep mock inventory and manual-device limitations current.
- Use `pnpm` scripts only, generated API types for API payloads, and the central API error map.
- Never persist access tokens, attendance codes, or queued mutations. Avoid `dangerouslySetInnerHTML`.

## Next implementation order

1. Continue with the next partial/not-started item in `PROGRESS.md`; role claims are not present in the draft OpenAPI, so do not invent route authorization behavior.
2. Continue replacing placeholder routes and add the remaining focused tests.

See `PROGRESS.md` for the screen-by-screen inventory and outstanding checks.
