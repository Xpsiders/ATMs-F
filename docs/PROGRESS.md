# CampusCheck implementation progress

Status reflects the current code in this repository, not a promise of backend or device behavior.

**Done** = usable flow is implemented and locally tested. **Partial** = a working surface exists, but the requested data, integration, states, or tests are incomplete. **Placeholder** = static/demo-only surface or route; no complete flow yet.

## Screens and feature routes

| Area | Screen / requirement | Status | Current implementation and remaining work |
|---|---|---|---|
| App | App shell, theme, online banner, navigation | Partial | Shared shell and light/dark/auto theme work. Student bottom tabs are exclusive to students; lecturer/admin use the drawer and student active links expose `aria-current`. Client role guards await role claims in the API; feature-specific layout boundaries remain incomplete. |
| App | Responsive navigation at 375 / 768 / 1280 | Partial | Responsive CSS and student tab navigation exist; drawer/rail behavior needs dedicated viewport tests and real-device confirmation. |
| App | Error boundary, route-level errors, 403/404 | Partial | 403 and not-found content exists; route error boundaries and API-backed role guards are not wired. |
| Auth | Login, logout, restore mock session | Done | Mock-only session flag and four role demo buttons work; real login/refresh integration is available through the API client. |
| Auth | Signup account claim | Partial | Form and API request path exist; mock scenario and end-to-end claim-flow state are incomplete. |
| Auth | Email verification and password setup | Partial | Step-based forms exist; backend/mock verification details need integration tests. |
| Auth | Forgot/reset/change password | Partial | Form and API paths exist; mock account recovery behavior and complete error-state tests are missing. |
| Student | Home / daily schedule / attendance snapshot | Partial | Seeded overview is interactive only through navigation; schedule and attendance values are mostly static. |
| Student | Find classes / filters / registration | Partial | Search and filters read the shared mock offerings/enrollments; registration writes to the store, but the seed leaves no currently available open offering. |
| Student | My courses | Partial | Course cards are filtered by the shared enrollment list; attendance metrics remain seeded. |
| Student | Check-in | Partial | GPS, keypad, live API mutation, single-submit guard and offline message work; successful mock check-ins update the shared attendance record and lecturer report. |
| Student | Attendance history | Partial | Mock history reads the signed-in student's shared attendance records, including lecturer overrides; non-mock content remains seeded. |
| Student | Disputes | Placeholder | Route displays informational content only; no request form or tracking flow. |
| Student | Profile | Placeholder | Informational content only; no profile editing or account data. |
| Lecturer | Offerings / teaching | Partial | Static teaching cards and start links exist; offering management and roster data are not connected. |
| Lecturer | Start session | Placeholder | Link opens the seeded live session; no complete session-creation form. |
| Lecturer | Live session / projector | Partial | Rotating server code, board mode, fullscreen, Wake Lock, fixed-code confirmation and scanner/projector demo scenarios exist; fixed code, scanner coverage and ended state now use the shared store, while aggregate counts remain seeded. |
| Lecturer | Roster | Partial | Live roster reads the shared attendance records; no complete backend integration. |
| Lecturer | Session report | Partial | Filters, shared attendance rows, single/bulk mock overrides, audit events, CSV export and paper-sheet link work; aggregate/API integration remains incomplete. |
| Lecturer | Enrolment | Placeholder | No lecturer enrolment workflow. |
| Lecturer | Paper attendance sheet | Partial | Print-friendly sheet reads all seeded students from the shared store; session metadata remains seeded. |
| Admin | Student import | Partial | File extension/size checks and preview layout exist; parsing, editable row errors, commit, and API submission are not implemented. |
| Admin | Courses and offerings | Placeholder | No management flow. |
| Admin | Venues and scanners/devices | Placeholder | No registration or device-key save flow. |
| Admin | Users and roles | Placeholder | No user-management flow. |
| Admin | Academic calendar | Placeholder | No calendar management flow. |
| Admin | Dashboards | Placeholder | Department and institution dashboard routes currently show summary copy only. |
| Admin | Abuse events | Placeholder | No event review flow. |
| Admin | Audit log | Placeholder | No audit log screen. |

## Cross-cutting and addendum requirements

| Requirement | Status | Current implementation and remaining work |
|---|---|---|
| Blue/gold design tokens, fonts, logo, accessible status badges | Partial | Tokens, self-hosted latin fonts, logo, and status styling exist; `docs/design-reference/` and the approved artboards are not present, so visual matching remains unverified. |
| WCAG AA contrast and focus | Partial | Contrast helper and ratio tests exist; full component-state audit remains. |
| Light/dark/auto theme and persistence | Partial | Theme selection and safe localStorage persistence work; system preference and check-in/live quick-toggle coverage need more tests. |
| Keyboard/touch operability and code keypad | Partial | Keyboard digits and coarse-pointer keypad implementation exist; matchMedia/pointer behavior tests remain. |
| Projector / board mode, fullscreen, Wake Lock fallback | Partial | Board/projector UI and Wake Lock tests exist; actual device/fullscreen behavior requires manual testing. |
| Fixed code and scanner coverage | Partial | Fixed-code and scanner state are shared across live/report/check-in screens; student classifications are displayed from stored/API status and never recomputed. |
| Offline check-in, no mutation queue/retry | Partial | Offline message and submit guard exist; test with network events and ensure no duplicate call. |
| Hidden-tab polling pause and retry backoff | Partial | Server-code hook handles hidden tabs and failures; additional polling tests and screen lifecycle integration remain. |
| Bulk override and per-row outcomes | Partial | Validation, per-row mock results, shared status updates and audit events work; API integration remains pending. |
| Print sheet and CSV export | Partial | Print sheet reads the shared mock roster and CSV export UI exists; API integration and manual print validation remain. |
| Route-level lazy loading / student bundle target | Done | Student features are in the entry bundle; lecturer and admin feature modules are dynamically imported. Production output: initial JS **373.98 kB / 112.26 kB gzip**, lecturer JS **19.92 kB / 5.83 kB gzip**, admin JS **2.47 kB / 1.05 kB gzip**. Student initial JavaScript is below the ~200 kB gzip target and the entry chunk contains no lecturer/admin feature text. |
| Shared mock API/store and reset | Partial | Check-in, course enrollment, history, lecturer roster/report, scanner/session state and print sheet use shared memory; dashboards, admin flows and some fallback fixtures remain local. Reset is available in the authenticated app bar and login panel. |
| OpenAPI draft, generated types, API errors/client | Partial | Draft contract, generated aliases, credentialed client and centralized error messages exist; verify against the backend contract when supplied. |
| CI, docs and manual guide | Partial | CI and baseline docs exist; mock inventory and remaining manual test scenarios need to be completed. |

## Validation and latest measured output

Latest full validation after the app-shell navigation and route-splitting changes:

| Command | Result |
|---|---|
| `pnpm lint` | Passed; 0 errors and 6 existing Fast Refresh warnings for constants/helpers exported from `shared/ui/primitives.tsx`. |
| `pnpm typecheck` | Passed. |
| `pnpm test` | Passed; 10 test files, 34 tests. |
| `pnpm build` | Passed. |

Current production output: initial JS **373.98 kB / 112.26 kB gzip**, lecturer JS **19.92 kB / 5.83 kB gzip**, admin JS **2.47 kB / 1.05 kB gzip**, CSS **58.20 kB / 12.52 kB gzip**.

The following are not established yet: full-suite coverage after the module split, 375/768/1280 automated viewport coverage, real-backend compatibility, and real-device behavior for GPS, Wake Lock, fullscreen, airplane mode, printing, and power loss.
