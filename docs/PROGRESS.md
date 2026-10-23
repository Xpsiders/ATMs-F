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
| Auth | Forgot password | Done | Calls `POST /auth/password/forgot`; the backend's enumeration-safe 202 response is shown generically. Mock mode returns the same shape and provides its test code only in the development UI. |
| Auth | Reset password | Done | Calls `POST /auth/password/reset` with the generated request type. API errors, including the backend's attempt-cap/rate-limit response, are displayed; mock reset codes are single-use. The backend's cap threshold is not specified in OpenAPI. |
| Auth | Change password | Placeholder | Real mode calls the supported change-password operation; mock mode does not change a demo account password. |
| Student | Home / daily schedule / attendance snapshot | Done | Loads live classes from `/me/live-classes`, later classes from `/me/timetable`, and threshold attendance from `/me/courses`; renders API venue and already-checked-in status, parses offset-qualified schedule times in Africa/Lagos, and distinguishes an empty timetable from a day with no remaining classes. Resources have loading/error handling and explicit empty states. |
| Student | Find classes / search and filters | Done | Debounced search and department/level/kind filters call typed `/offerings/search`; results use API registration status and display closed, pending, approved, and available states. |
| Student | Register / request to join a class | Done | `POST /offerings/{id}/registrations` registers open offerings or requests approval; mutation errors render on the offering, closed offerings are disabled, and pending status is visible. The contract has no specific closure-reason field, so the UI explains only that registration is closed. |
| Student | My courses | Done | `/me/courses` drives course cards and attendance percentages/threshold styling; loading, API error/retry, and empty state with Find classes CTA are implemented. |
| Student | Check-in code and location entry | Done | Fetches live classes from `GET /me/live-classes`, lets the student select an active class, and submits that class's returned `session_id` to `POST /checkins`. Keyboard/touch input, location request, mock success/error selection, and offline-disabled submit are implemented. |
| Student | Check-in success receipt | Done | Success state shows the saved result, timing/distance and fingerprint reminder. |
| Student | Check-in offline/error/lockout states | Done | Offline explanation and centralized error presentation render; scenario selection exercises mapped errors in development. |
| Student | Attendance history | Done | Course selector loads `/me/courses`, then per-course records from `/me/attendance`; loading/error/retry and no-courses/no-records states are implemented. |
| Student | Attendance disputes | Placeholder | Informational page only; no dispute submission or status tracking. |
| Student | Student profile / privacy details | Partial | Profile name, email, role, department ID, and level display from `GET /me`; profile editing is not supported by the current contract. |
| Lecturer | Offerings / teaching list | Done | Displays the signed-in lecturer's name and offerings returned by authenticated `/me/offerings`, including `session_open` and nullable `next_timetable_slot`; loading, error/retry, empty states, and per-offering start links that select the matching offering are implemented. Real-backend assignment scoping remains unverified. |
| Lecturer | Start/create attendance session | Done | Loads `/me/offerings` and `/venues`, shows course code/title, and submits exactly the selected IDs plus boolean `rotating_code` and numeric `late_after_min` as JSON. Field-level API errors render beside the form. Returned session ID drives code polling and ending; mock integration tests assert exact payload and IDs. |
| Lecturer | Live session screen / rotating code | Partial | Uses the selected/created session ID for code polling, ending, and live attendance. Counts and roster are polled from `/sessions/{id}/live`; offering and venue labels come from `/me/offerings`, `/venues`, and the returned session. API scanner coverage is not included in the live endpoint. |
| Lecturer | Projector mode | Done | Fullscreen request, scalable code and theme toggle are available; real projector behavior is unverified. |
| Lecturer | Board mode / power-cut fallback | Done | Portrait-friendly code/count display, fullscreen/Escape handling and feature-detected Wake Lock are implemented. |
| Lecturer | Fixed-code confirmation and scanner coverage | Done | Confirmed fixed-code action updates shared session state; scanner scenario updates shared scanner state and warnings appear. |
| Lecturer | Live roster | Done | Roster reads shared student attendance records and links to the report. |
| Lecturer | Session report / report table and filters | Partial | Real mode loads every page from `/sessions/{id}/report`; rows, classification totals, scanner coverage, filtering, and overrides use API data. Mock mode continues to use fixtures. The schema omits web/scan timestamps and department names, so the report shows unavailable timestamps and department IDs. |
| Lecturer | Single and bulk attendance override | Done | Dialog validates “other” explanation, shows per-row mock results, updates shared attendance and records mock audit entries. |
| Lecturer | Print attendance sheet and PDF | Done | The printable roster uses `/sessions/{id}/roster-sheet` in real mode and offers the server-generated PDF at `?format=pdf`; mock mode uses the fixture roster and browser print. |
| Lecturer | Lecturer enrolment | Placeholder | No lecturer enrolment flow is implemented. |
| Admin | Import students / CSV preview and commit | Placeholder | Student CSV import is not present. |
| Admin | Import staff / CSV preview and atomic commit | Done | Upload, size/type validation, server preview, row-error display, and commit gating are wired to `/imports/staff/preview` and `/imports/staff`. The API revalidates and commits atomically; mock preview/commit validates the documented headers and returns 422 for invalid rows. |
| Admin | Courses and offerings management | Placeholder | No create/edit/archive flow. |
| Admin | Venue management | Done | Scoped venue create/update/deactivate and loading, empty, and error states use `/venues`; data refreshes from the list after mutations because mutation response fields are unspecified. Scanner/device-key registration remains unimplemented. |
| Admin | Users and role assignment | Partial | Role assignment posts generated user/role/scope payloads and surfaces API errors. User and scope IDs are entered manually because the contract has no lookup endpoint; broader user management remains unimplemented. |
| Admin | Academic calendar | Done | Lists and creates/updates/deletes academic sessions and semesters using generated request/response types; loading, empty, and error states are present. Generic catalogue items guarantee only IDs, so labels/dates are shown when returned. |
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
| API contract, generated types and centralized errors | Partial | Session lifecycle, lecturer offerings/venues, student flows, role-based identity, staff imports, signup review, password reset, venue/calendar administration, and role assignment use generated operation/request types from the synced contract. Generic signup/catalogue schemas omit several display fields and are handled defensively. The email outbox worker is backend-only. Real-backend compatibility is unverified. |
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

## Student home API data mapping review

| Command | Result |
|---|---|
| `pnpm lint` | Passed with 0 errors and 4 existing Fast Refresh warnings in `src/shared/ui/primitives.tsx`. |
| `pnpm typecheck` | Passed; `tsc -b --pretty false --force` completed without errors. |
| `pnpm test` | Passed; 10 test files and 49 tests passed, including backend-shaped home responses for live status, venue, check-in state, offset-qualified timetable times, attendance threshold values, and past-class empty messaging. |
| `pnpm build` | Passed; Vite transformed 309 modules. JavaScript chunks were **385.03 kB / 115.51 kB gzip**, **24.22 kB / 7.13 kB gzip**, and **2.47 kB / 1.05 kB gzip**; CSS was **61.51 kB / 13.14 kB gzip**. |

No server or browser visual check was run; real-backend behavior remains unverified.

## Lecturer offering and navigation review

The lecturer landing page no longer renders the same hard-coded lecturer name,
schedule, and offerings for every account. It displays the authenticated
profile name and the offerings returned by `/me/offerings`; selecting
“Start session” for an offering carries that offering ID into the session form.
The mock `/me/offerings` response is now filtered to the signed-in demo
lecturer's assignments.

| Command | Result |
|---|---|
| `pnpm lint` | Passed with 0 errors and 4 existing Fast Refresh warnings in `src/shared/ui/primitives.tsx`. |
| `pnpm typecheck` | Passed; `tsc -b --pretty false --force` completed without errors. |
| `pnpm test` | Passed; 10 test files and 50 tests passed, including scoped offering display and selected-offering session navigation. |
| `pnpm build` | Passed; Vite transformed 309 modules. JavaScript chunks were **385.04 kB / 115.51 kB gzip**, **24.79 kB / 7.23 kB gzip**, and **2.47 kB / 1.05 kB gzip**; CSS was **61.57 kB / 13.15 kB gzip**. |

The integrated browser was not available at `http://localhost:5173` and no
server was started. Therefore the reported click-back-to-home behavior could not
be reproduced visually here; the role route and per-offering navigation are
covered by component tests. Different real lecturer accounts and their backend
offering assignments remain unverified.

## Student API screens follow-up

Student Home, Find classes, My courses, and Attendance history are API-backed in
real mode and use the mock API handlers only when mock mode is enabled. Class
search's department filters now come from the generated `GET /departments`
contract rather than the home-department-limited search result set. The mock
handler supplies matching department options. The search contract still does
not expose an offering-specific closed reason; the UI truthfully shows the
generic “Registration is closed for this offering” explanation.

| Command | Result |
|---|---|
| `pnpm lint` | Passed with 0 errors and 4 existing Fast Refresh warnings in `src/shared/ui/primitives.tsx`. |
| `pnpm typecheck` | Passed; `tsc -b --pretty false --force` completed without errors. |
| `pnpm test --maxWorkers=1` | Passed; 10 test files and 52 tests passed, including independent department filtering, closed-registration state, and existing student screen coverage. |
| `pnpm build` | Passed; Vite transformed 309 modules. JavaScript chunks were **385.04 kB / 115.54 kB gzip**, **24.79 kB / 7.23 kB gzip**, and **2.47 kB / 1.05 kB gzip**; CSS was **61.57 kB / 13.15 kB gzip**. |

Real-backend behavior and browser viewport checks were not performed.

## Newly published administration and password-reset endpoints

Ran `pnpm sync:api` against the current sibling backend contract. The copy
completed, but `openapi-typescript` could not parse duplicate `500` response
keys at API-spec lines 652 and 1083. After removing the duplicate keys in this
repository's copy, generation exposed malformed nested response mappings at
lines 1471 and 1513; those response blocks were rewritten as block YAML. The
backend repository was not changed. `pnpm gen:api` then passed and regenerated
`src/api/schema.d.ts`; the final generated-type check reported no mismatches.

Added staff CSV preview and atomic-commit UI, scoped signup-request review,
forgot/reset password calls, venue administration, academic session and
semester management, role assignment, and the updated `/me/offerings`
session/timetable fields. New mock handlers cover those API operations and
reset codes; mock CSV commit revalidates rows and fails atomically. The mock
reset code is development-only. The backend's reset-attempt threshold is not
published, so the UI surfaces server errors/rate limits rather than assuming a
limit. The email outbox retry worker is backend-only and has no frontend
endpoint. API assumptions document incomplete signup/catalogue response
schemas, unspecified venue mutation responses, and missing role-lookup
operations.

| Command | Result |
|---|---|
| `pnpm sync:api` | Copy completed; generation failed because the upstream OpenAPI contains duplicate `500` response keys (first reported at line 652). |
| `pnpm gen:api` | Passed after removing the duplicate keys and formatting malformed nested response blocks in the local copy. |
| `pnpm lint` | Passed with 0 errors and 4 existing Fast Refresh warnings in `src/shared/ui/primitives.tsx`. |
| `pnpm typecheck` | Passed; `tsc -b --pretty false --force` completed without errors after regenerating types. |
| `pnpm test --maxWorkers=1` | Passed; 12 test files and 57 tests passed, including CSV preview/atomic failure, one-time password reset, venue persistence, academic-session persistence, and existing app flows. |
| `pnpm build` | Passed; Vite transformed 309 modules. JavaScript chunks were **387.28 kB / 115.84 kB gzip**, **25.24 kB / 7.39 kB gzip**, and **19.74 kB / 4.89 kB gzip**; CSS was **61.57 kB / 13.15 kB gzip**. |

No server was started. Real-backend behavior and visual checks at 375, 768,
and 1280 pixels remain unverified.

## Lecturer navigation reset and API contract refresh

The startup session-restoration effect depended on React Router's `navigate`
callback. That callback changes as the route changes, so when a lecturer loaded
the app at `/`, each navigation reran session restoration and reapplied the
initial lecturer-home redirect. This returned the user to `/lecturer` before
`POST /sessions` could be sent. The effect now uses a ref to the latest
navigation callback and runs only for app startup; the root route also directs
non-students to their role-specific home. A regression test starts as a
lecturer at `/`, visits the Live and Report routes and starts a session, while
asserting the profile is loaded only once.

The backend API copy adds `/sessions/{id}/live`,
`/offerings/{id}/timetable` (+ slot operations), teaching requests, registration
approvals, and bulk registration approval. It changes `GET /me/offerings` to
include `session_open` and `next_timetable_slot`. Generated types required
updating the mock offering response. `pnpm sync:api` copied the backend spec but
type generation found malformed flow mappings in the upstream YAML (around
lines 1250 and 1297). Those two mappings were formatted as block YAML in the
local copy only, after which `pnpm gen:api` succeeded. The backend source
remains unchanged; sync will fail again until its YAML syntax is corrected
upstream.

| Command | Result |
|---|---|
| `pnpm sync:api` | Copy completed; type generation failed on malformed upstream YAML flow mappings at lines 1250 and 1297. |
| `pnpm gen:api` | Passed after formatting those two mappings in the local API copy. |
| `pnpm lint` | Passed; 0 errors and 4 existing Fast Refresh warnings in `src/shared/ui/primitives.tsx`. |
| `pnpm typecheck` | Passed after updating the mock offering response to the refreshed generated schema. |
| `pnpm test --maxWorkers=1` | Passed; 10 test files and 53 tests, including the lecturer root-to-route navigation and session-creation regression. |
| `pnpm build` | Passed; Vite transformed 309 modules. JavaScript chunks were **385.11 kB / 115.54 kB gzip**, **24.79 kB / 7.23 kB gzip**, and **2.47 kB / 1.05 kB gzip**; CSS was **61.57 kB / 13.15 kB gzip**. |

No servers were started. The real backend was not retested from a browser.

## Lecturer live attendance and session PDF reports

Ran `pnpm sync:api`; the latest contract copy completed but type generation
again stopped on duplicate `500` response keys in the sibling backend YAML.
Removed the duplicate keys and corrected malformed nested response mappings in
the local `api/openapi.yaml`, then `pnpm gen:api` passed. No backend files were
modified. Generated types confirm `/sessions/{id}/live`, paginated JSON
`/sessions/{id}/report`, and `application/pdf` responses on both report and
roster-sheet endpoints.

Real-mode live sessions now poll all roster pages and API counts from
`/sessions/{id}/live`, and get offering/venue labels from the API. Real-mode
reports load all report pages and derive counts, filters, statuses, scanner
coverage and override IDs from those results. Added server-generated PDF
downloads for the complete session report and roster sheet; mock mode keeps its
fixtures and browser-print fallback. Real mode no longer subscribes to the demo
store for these lecturer screens. The API report schema omits timestamp and
department-name values, so the UI does not fabricate those fields.

| Command | Result |
|---|---|
| `pnpm sync:api` | Copy completed; generation failed on duplicate `500` response keys in the backend spec. |
| `pnpm gen:api` | Passed after local OpenAPI syntax corrections. |
| `pnpm lint` | Passed with 0 errors and 4 existing Fast Refresh warnings in `src/shared/ui/primitives.tsx`. |
| `pnpm typecheck` | Passed; `tsc -b --pretty false --force` completed without errors. |
| `pnpm test --maxWorkers=1` | Passed; 13 test files and all 61 tests passed, including the lecturer API-backed live/report and PDF tests. |
| `pnpm build` | Passed; Vite transformed 309 modules. JavaScript chunks were **387.36 kB / 115.87 kB gzip**, **29.96 kB / 8.48 kB gzip**, and **19.74 kB / 4.89 kB gzip**; CSS was **61.57 kB / 13.15 kB gzip**. |

No servers were started; live-backend responses and generated PDF appearance
were not browser-verified.
