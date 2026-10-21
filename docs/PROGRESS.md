# CampusCheck implementation progress

Status reflects the current code in this repository, not a promise of backend or device behavior.

**Done** = the screen's primary user flow works with the current in-memory demo data/store. **Partial** = a working flow exists, but meaningful parts still use seeded or static data, or real-backend behavior is unverified. **Placeholder** = the requested screen or flow is absent, static, or only a visual mock; a visible control without a working outcome does not count as done.

## Screens and feature routes

The approved design-reference screenshots are absent from `docs/design-reference/`; artboard-specific visual matching is unverified.

| Area | Screen / flow from the spec or addendum | Status | Evidence / remaining work |
|---|---|---|---|
| App | Authenticated app shell, app bar, theme selector, online/offline banner | Done | Shared shell renders navigation, theme selection, network state, and the signed-in name, department ID, and level from `GET /me`. The API exposes a department ID, not a human-readable department name. |
| App | Student navigation (phone bottom tabs, laptop top nav) | Done | Student-only mobile tab bar and laptop nav render; active route is indicated. |
| App | Lecturer/admin navigation (drawer and collapsed rail) | Placeholder | Drawer/rail styling exists, but the responsive behavior has not been verified against the specified 375/768/1280 breakpoints. Responsive-navigation tests are intentionally deferred by user request. |
| App | Role guards, route error boundary, unauthorized/403 and not-found screens | Partial | Startup and post-login routing use the role returned by `GET /me`; student, lecturer, and admin routes enforce role guards and redirect to the existing 403 page with a link to the user's home. The global route error boundary remains unimplemented. |
| Auth | Login and logout | Done | Real API login path and mock login work. Mock refresh returns 401 without a session; demo panel offers one-click student, lecturer, department-admin, institution-admin login and reset/logout. Tests cover role dashboards and logout. |
| Auth | Signup / claim student account | Placeholder | Real mode calls the contract's claim endpoint and requires `VITE_INSTITUTION_ID`; the mock form still advances without a mock claim mutation. |
| Auth | Verify email / one-time code | Placeholder | Real mode submits code and password together to the contract's verify-email endpoint; mock mode does not validate a code or verify an account. |
| Auth | Forgot password | Placeholder | Not in the current API contract; real mode reports this limitation instead of calling a guessed endpoint. |
| Auth | Reset password | Placeholder | Not in the current API contract; real mode reports this limitation instead of calling guessed endpoints. |
| Auth | Change password | Placeholder | Real mode calls the supported change-password operation; mock mode does not change a demo account password. |
| Student | Home / daily schedule / attendance snapshot | Done | Loads live classes from `/me/live-classes`, later classes from `/me/timetable`, and threshold attendance from `/me/courses`; each resource has loading/error handling and the screen has explicit no-live, no-schedule and no-course empty states. |
| Student | Find classes / search and filters | Done | Debounced search and department/level/kind filters call typed `/offerings/search`; results use API registration status and display closed, pending, approved, and available states. |
| Student | Register / request to join a class | Done | `POST /offerings/{id}/registrations` registers open offerings or requests approval; mutation errors render on the offering, closed offerings are disabled, and pending status is visible. The contract has no specific closure-reason field, so the UI explains only that registration is closed. |
| Student | My courses | Done | `/me/courses` drives course cards and attendance percentages/threshold styling; loading, API error/retry, and empty state with Find classes CTA are implemented. |
| Student | Check-in code and location entry | Done | Fetches live classes from `GET /me/live-classes`, lets the student select an active class, and submits that class's returned `session_id` to `POST /checkins`. Keyboard/touch input, location request, mock success/error selection, and offline-disabled submit are implemented. |
| Student | Check-in success receipt | Done | Success state shows the saved result, timing/distance and fingerprint reminder. |
| Student | Check-in offline/error/lockout states | Done | Offline explanation and centralized error presentation render; scenario selection exercises mapped errors in development. |
| Student | Attendance history | Done | Course selector loads `/me/courses`, then per-course records from `/me/attendance`; loading/error/retry and no-courses/no-records states are implemented. |
| Student | Attendance disputes | Placeholder | Informational page only; no dispute submission or status tracking. |
| Student | Student profile / privacy details | Partial | Profile name, email, role, department ID, and level display from `GET /me`; profile editing is not supported by the current contract. |
| Lecturer | Offerings / teaching list | Placeholder | The teaching list is still static, but its start links open the working session form. |
| Lecturer | Start/create attendance session | Done | Loads `/me/offerings` and `/venues`, shows course code/title, and submits exactly the selected IDs plus boolean `rotating_code` and numeric `late_after_min` as JSON. Field-level API errors render beside the form. Returned session ID drives code polling and ending; mock integration tests assert exact payload and IDs. |
| Lecturer | Live session screen / rotating code | Partial | Uses the selected/created session ID for `GET /sessions/{id}/code` polling and `POST /sessions/{id}/end`; errors display the API code/message. The roster and aggregate counts are still seeded. |
| Lecturer | Projector mode | Done | Fullscreen request, scalable code and theme toggle are available; real projector behavior is unverified. |
| Lecturer | Board mode / power-cut fallback | Done | Portrait-friendly code/count display, fullscreen/Escape handling and feature-detected Wake Lock are implemented. |
| Lecturer | Fixed-code confirmation and scanner coverage | Done | Confirmed fixed-code action updates shared session state; scanner scenario updates shared scanner state and warnings appear. |
| Lecturer | Live roster | Done | Roster reads shared student attendance records and links to the report. |
| Lecturer | Session report / report table and filters | Partial | Report route carries the selected session ID; table rows and overrides work from shared demo data, and filters work. Aggregate statistic cards remain seeded and report retrieval/CSV export are not wired to a real report response. |
| Lecturer | Single and bulk attendance override | Done | Dialog validates “other” explanation, shows per-row mock results, updates shared attendance and records mock audit entries. |
| Lecturer | Print attendance sheet | Done | Print-friendly roster reads all seeded students and invokes browser print; actual paper output is unverified. |
| Lecturer | Lecturer enrolment | Placeholder | No lecturer enrolment flow is implemented. |
| Admin | Import students / CSV preview and commit | Placeholder | File checks work, but preview rows are hard-coded and commit is disabled; no parsing or mock import mutation. |
| Admin | Courses and offerings management | Placeholder | No create/edit/archive flow. |
| Admin | Venues, scanners and device-key registration | Placeholder | No registration or key-reveal/save flow. |
| Admin | Users and roles management | Placeholder | No user/role management flow. |
| Admin | Academic calendar | Placeholder | No calendar management flow. |
| Admin | Department dashboard | Placeholder | Summary text only; no dashboard data flow. |
| Admin | Institution dashboard | Placeholder | Summary text only; no dashboard data flow. |
| Admin | Abuse events | Placeholder | No event review/action flow. |
| Admin | Audit log | Placeholder | No audit log viewer; shared mock audit entries are not surfaced in an admin screen. |
| Addendum | Mock scenario switcher (scanner offline, projector unavailable, network offline, fixed-code session) | Placeholder | Scanner and projector selectors exist. A unified network-offline/fixed-code scenario switcher is missing; offline can be tested via browser events and fixed code via the live action. |
| Addendum | Phone report layout (student cards, 2x2 stats, scrolling filters, bottom-sheet dialog) | Done | CSS switches the report table to student cards below 800px, stats to a 2x2 grid and dialogs to bottom sheets on narrow phones; status filters scroll horizontally. Exact-device validation is deferred. |

## Cross-cutting and addendum requirements

| Requirement | Status | Current implementation and remaining work |
|---|---|---|
| Responsive layouts at 375 / 768 / 1280 | Placeholder | Mobile report cards, phone stat grid, student phone tabs, and laptop student two-column layout are styled. Navigation breakpoint behavior does not match the required tablet icon rail at 768px (it uses the phone drawer below 800px), and no responsive-navigation tests are being added in this task per user request. |
| Blue/gold design, fonts, logo and status badge contrast | Placeholder | Tokens/fonts/logo/badges exist, but contrast audit and matching approved artboards have not been verified; design-reference screenshots are unavailable. |
| Light/dark/auto theme and persistence | Done | Theme selector supports all three modes and persists explicit choice; system and real-device appearance still need manual verification. |
| Theme quick-toggle on check-in/live screens | Placeholder | App-bar quick-toggle exists; dedicated check-in and live-screen toggles are missing. |
| Keyboard/touch check-in input | Done | Keyboard input supports paste/advance/backspace/arrows; coarse-pointer keypad is feature-detected. Dedicated pointer-device testing is deferred. |
| WCAG AA contrast/focus audit | Placeholder | Helper-level contrast tests exist, but full palette/component-state audit is not complete. |
| Pause polling while hidden / GET backoff | Done | Session-code hook skips hidden-tab polling and backs off after failures; retry behavior has unit coverage. |
| No offline mutation queue/retry | Done | Check-in is disabled offline and mutations are not queued; real airplane-mode behavior remains a manual check. |
| Shared mock store and reset | Done | Shared state covers check-in, enrollment, history, lecturer roster/report, overrides, scanner/session state and print roster; reset restores fixture state. |
| Route-level code splitting and student initial bundle target | Done | Initial student JS **112.26 kB gzip**, below the ~200 kB target; lecturer and admin are separate lazy chunks (**5.83 kB** and **1.05 kB gzip**). |
| API contract, generated types and centralized errors | Partial | Session creation, code polling, session ending, lecturer offerings/venues, student live-class selection, and `GET /me` use generated types from the synced backend contract. The generic catalogue schema does not specify course code/title properties, so the UI safely reads optional code/title values when the API provides them. The profile contract exposes department IDs rather than department names. Forgot/reset-password and standalone verification endpoints are not in the contract and explicitly report unsupported in real mode. Real-backend compatibility is unverified. |
| CI and documentation coverage | Done | CI and baseline docs exist; this inventory calls out incomplete product screens. |

## Validation and latest measured output

Validation for the session form contract-alignment task (commands run from the repository root):

| Command | Result |
|---|---|
| `pnpm sync:api` | Passed; copied the current `../ATMs/api/openapi.yaml` and regenerated `src/api/schema.d.ts`. |
| Initial `pnpm typecheck` after sync | Failed on obsolete `LiveClass`/`Venue` schema aliases and the previous `radius_m` field. Those mismatches were fixed by aliasing generated operation response types and using `radius_meters`. |
| `pnpm lint` | Passed; 0 errors and 6 existing Fast Refresh warnings in `shared/ui/primitives.tsx`. |
| Final `pnpm typecheck` | Passed after contract alignment; `tsc -b --pretty false --force` completed without errors. |
| `pnpm test` | Passed; 10 test files and 40 tests passed, including exact JSON request body, field errors, and returned session ID polling/end assertions. |
| `pnpm build` | Passed; Vite transformed 307 modules. JS chunks were **376.66 kB / 113.41 kB gzip**, **24.16 kB / 7.10 kB gzip**, and **2.47 kB / 1.05 kB gzip** (total **403.29 kB / 121.56 kB gzip**); CSS **58.25 kB / 12.59 kB gzip**. |

Previous task complete: aligned the lecturer session form to the synced contract, improved course labels and field errors, removed the role switcher, and verified the returned-ID session lifecycle. Recommended next task: replace seeded lecturer report data with backend responses.

## Role-based identity validation

| Command | Result |
|---|---|
| `pnpm lint` | Passed with 0 errors and 6 existing Fast Refresh warnings in `shared/ui/primitives.tsx`. |
| `pnpm typecheck` | Passed; `tsc -b --pretty false --force` completed without errors. |
| `pnpm test` | Passed; 10 test files and 43 tests passed, including `/me` role routing, 403 guard redirects, and profile identity display. |
| `pnpm build` | Passed; Vite transformed 308 modules. JS chunks were **380.52 kB / 114.28 kB gzip**, **24.16 kB / 7.10 kB gzip**, and **2.47 kB / 1.05 kB gzip**; CSS was **59.33 kB / 12.80 kB gzip**. |

Current task complete: the app restores the session then loads `GET /me`, uses that response to choose the role workspace after login and page load, guards role-specific routes with a 403 redirect, and displays API-provided name, department ID, and level in the app bar and profile. The API does not provide a human-readable department name. Real-backend behavior remains unverified.

The following are not established yet: 375/768/1280 automated viewport coverage, real-backend compatibility, and real-device behavior for GPS, Wake Lock, fullscreen, airplane mode, printing, and power loss.

## Student API screens

| Command | Result |
|---|---|
| `pnpm sync:api` | Passed; synced `api/openapi.yaml` from the sibling backend and regenerated operation types. |
| `pnpm lint` | Passed with 0 errors and 4 Fast Refresh warnings in `src/shared/ui/primitives.tsx`. |
| `pnpm typecheck` | Passed; an initial run identified a nullable search result inside an effect, which was fixed using a local narrowed value. |
| `pnpm test` | Passed; 10 test files and 47 tests passed, including API-backed student empty states, search filters, registration/pending state, retry, and course-specific attendance history. |
| `pnpm build` | Passed; Vite transformed 309 modules. JavaScript chunks were **384.12 kB / 115.17 kB gzip**, **24.22 kB / 7.13 kB gzip**, and **2.47 kB / 1.05 kB gzip** (total **410.81 kB / 123.35 kB gzip**); CSS was **61.35 kB / 13.12 kB gzip**. |

Student home, class search and registration, course list, and attendance history now use the synced API contract in real mode, with loading, empty, error, and retry states where applicable. Mock handlers use the same generated operation types for development. The timetable's “later today” comparison uses Africa/Lagos time. No server or browser visual check was run; real-backend compatibility and automated 375/768/1280 viewport coverage remain unverified.
