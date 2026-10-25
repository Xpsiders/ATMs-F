# CampusCheck implementation progress

Status reflects the current code in this repository, not a promise of backend or device behavior.

**Done** = the screen's primary user flow works with the current in-memory demo data/store. **Partial** = a working flow exists, but meaningful parts still use seeded or static data, or real-backend behavior is unverified. **Placeholder** = the requested screen or flow is absent, static, or only a visual mock; a visible control without a working outcome does not count as done.

## Screens and feature routes

The approved design-reference screenshots are absent from `docs/design-reference/`; artboard-specific visual matching is unverified.

| Area     | Screen / flow from the spec or addendum                                                              | Status      | Evidence / remaining work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------- | ---------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App | Authenticated app shell, app bar, theme selector, online/offline banner | Done | Shared shell renders navigation, theme selection, network state, and the signed-in name/email plus student level from `GET /me`; department IDs remain in profile details, not under the user's name. The API exposes a department ID, not a human-readable department name. |
| App      | Student navigation (phone bottom tabs, laptop top nav)                                               | Done        | Student-only mobile tab bar and laptop nav render; active route is indicated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| App      | Lecturer/admin navigation (drawer and collapsed rail)                                                | Placeholder | Drawer/rail styling exists, but the responsive behavior has not been verified against the specified 375/768/1280 breakpoints. Responsive-navigation tests are intentionally deferred by user request.                                                                                                                                                                                                                                                                                                                                                      |
| App      | Role guards, route error boundary, unauthorized/403 and not-found screens                            | Partial     | Startup and post-login routing use the role returned by `GET /me`; student, lecturer, and admin routes enforce role guards and redirect to the existing 403 page with a link to the user's home. The global route error boundary remains unimplemented.                                                                                                                                                                                                                                                                                                    |
| Auth     | Login and logout                                                                                     | Done        | Real API login path and mock login work. Mock refresh returns 401 without a session; demo panel offers one-click student, lecturer, department-admin, institution-admin login and reset/logout. Tests cover role dashboards and logout.                                                                                                                                                                                                                                                                                                                    |
| Auth     | Signup / claim student account                                                                       | Placeholder | Real mode calls the contract's claim endpoint and requires `VITE_INSTITUTION_ID`; the mock form still advances without a mock claim mutation.                                                                                                                                                                                                                                                                                                                                                                                                              |
| Auth     | Verify email / one-time code                                                                         | Placeholder | Real mode submits code and password together to the contract's verify-email endpoint; mock mode does not validate a code or verify an account.                                                                                                                                                                                                                                                                                                                                                                                                             |
| Auth     | Forgot password                                                                                      | Done        | Calls `POST /auth/password/forgot`; the backend's enumeration-safe 202 response is shown generically. Mock mode returns the same shape and provides its test code only in the development UI.                                                                                                                                                                                                                                                                                                                                                              |
| Auth     | Reset password                                                                                       | Done        | Calls `POST /auth/password/reset` with the generated request type. API errors, including the backend's attempt-cap/rate-limit response, are displayed; mock reset codes are single-use. The backend's cap threshold is not specified in OpenAPI.                                                                                                                                                                                                                                                                                                           |
| Auth     | Change password                                                                                      | Placeholder | Real mode calls the supported change-password operation; mock mode does not change a demo account password.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Student  | Home / daily schedule / attendance snapshot                                                          | Done        | Loads live classes from `/me/live-classes`, later classes from `/me/timetable`, and threshold attendance from `/me/courses`; renders API venue and already-checked-in status, parses offset-qualified schedule times in Africa/Lagos, and distinguishes an empty timetable from a day with no remaining classes. Resources have loading/error handling and explicit empty states.                                                                                                                                                                          |
| Student  | Find classes / search and filters                                                                    | Done        | Debounced search and department/level/kind filters call typed `/offerings/search`; results use API registration status and display closed, pending, approved, and available states.                                                                                                                                                                                                                                                                                                                                                                        |
| Student  | Register / request to join a class                                                                   | Done        | `POST /offerings/{id}/registrations` registers open offerings or requests approval; mutation errors render on the offering, closed offerings are disabled, and pending status is visible. The contract has no specific closure-reason field, so the UI explains only that registration is closed.                                                                                                                                                                                                                                                          |
| Student  | My courses                                                                                           | Done        | `/me/courses` drives course cards and attendance percentages/threshold styling; loading, API error/retry, and empty state with Find classes CTA are implemented.                                                                                                                                                                                                                                                                                                                                                                                           |
| Student  | Check-in code and location entry                                                                     | Done        | Fetches live classes from `GET /me/live-classes`, lets the student select an active class, and submits that class's returned `session_id` to `POST /checkins`. Keyboard/touch input, location request, mock success/error selection, and offline-disabled submit are implemented.                                                                                                                                                                                                                                                                          |
| Student  | Check-in success receipt                                                                             | Done        | Success state shows the saved result, timing/distance and fingerprint reminder.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Student  | Check-in offline/error/lockout states                                                                | Done        | Offline explanation and centralized error presentation render; scenario selection exercises mapped errors in development.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Student  | Attendance history                                                                                   | Done        | Course selector loads `/me/courses`, then per-course records from `/me/attendance`; loading/error/retry and no-courses/no-records states are implemented.                                                                                                                                                                                                                                                                                                                                                                                                  |
| Student  | Attendance disputes                                                                                  | Placeholder | Informational page only; no dispute submission or status tracking.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Student  | Student profile / privacy details                                                                    | Partial     | Profile name, email, role, department ID, and level display from `GET /me`; profile editing is not supported by the current contract.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Lecturer | Offerings / teaching list                                                                            | Done        | Displays the signed-in lecturer's name and offerings returned by authenticated `/me/offerings`, including `session_open` and nullable `next_timetable_slot`; loading, error/retry, empty states, and per-offering start links that select the matching offering are implemented. Real-backend assignment scoping remains unverified.                                                                                                                                                                                                                       |
| Lecturer | Start/create attendance session                                                                      | Done        | Loads `/me/offerings` and `/venues`, shows course code/title, and submits exactly the selected IDs plus boolean `rotating_code` and numeric `late_after_min` as JSON. Field-level API errors render beside the form. Returned session ID drives code polling and ending; mock integration tests assert exact payload and IDs.                                                                                                                                                                                                                              |
| Lecturer | Live session screen / rotating code                                                                  | Partial     | Started-session and return-to-live navigation retain the selected session ID for the signed-in lecturer in tab-scoped session storage (ID only; never the attendance code). Counts and roster are polled from `/sessions/{id}/live`; offering and venue labels come from `/me/offerings`, `/venues`, and the returned session. API scanner coverage is not included in the live endpoint.                                                                                                                                                                  |
| Lecturer | Projector mode                                                                                       | Done        | Fullscreen request, scalable code and theme toggle are available; real projector behavior is unverified.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Lecturer | Board mode / power-cut fallback                                                                      | Done        | Portrait-friendly code/count display, fullscreen/Escape handling and feature-detected Wake Lock are implemented.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Lecturer | Fixed-code confirmation and scanner coverage                                                         | Done        | Confirmed fixed-code action updates shared session state; scanner scenario updates shared scanner state and warnings appear.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Lecturer | Live roster                                                                                          | Done        | Roster reads shared student attendance records and links to the report.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Lecturer | Session report / report table and filters                                                            | Partial     | Real mode loads every page from `/sessions/{id}/report`; rows, classification totals, scanner coverage, filtering, and overrides use API data. Locally started session IDs and course labels are retained in browser storage so finished reports can be reopened from Teaching or Session reports. Mock mode continues to use fixtures. The schema omits web/scan timestamps and department names, so the report shows unavailable timestamps and department IDs.                                                                                          |
| Lecturer | Single and bulk attendance override                                                                  | Done        | Dialog validates “other” explanation, shows per-row mock results, updates shared attendance and records mock audit entries.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Lecturer | Print attendance sheet and PDF                                                                       | Done        | The printable roster uses `/sessions/{id}/roster-sheet` in real mode and offers the server-generated PDF at `?format=pdf`; mock mode uses the fixture roster and browser print.                                                                                                                                                                                                                                                                                                                                                                            |
| Lecturer | Lecturer enrolment                                                                                   | Placeholder | No lecturer enrolment flow is implemented.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Admin    | Import students / CSV preview and commit                                                             | Placeholder | Student CSV import is not present.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Admin    | Import staff / CSV preview and atomic commit                                                         | Done        | Upload, size/type validation, server preview, row-error display, and commit gating are wired to `/imports/staff/preview` and `/imports/staff`. The API revalidates and commits atomically; mock preview/commit validates the documented headers and returns 422 for invalid rows.                                                                                                                                                                                                                                                                          |
| Admin | Courses and offerings management | Partial | Department, faculty, and institution admins can browse scoped offerings through `/offerings/search`, create scoped courses through `POST /courses`, and add lecturers using `GET`/`PUT /offerings/{id}/lecturers`. Lecturer assignment retains existing account IDs before the replacement `PUT`. The generated request types drive payloads; department admins are fixed to their department, while faculty/institution admins select from `GET /departments` and the backend validates scope. Lecturers are chosen with a type-to-search directory picker (`GET /users?role=lecturer`) instead of a hand-typed UUID. Lecturer names, debounced search, loading, empty, and retryable error states are included. This is not a staff directory and does not implement course/offering edit or archive. |
| Admin    | Teaching request review                                                                              | Done        | Scoped admins list cross-department teaching requests from `GET /teaching-requests` and approve/reject with `PATCH /teaching-requests/{id}`; approval creates the offering backend-side. Loading, empty, error, and status-badge (icon + text) states are implemented. The mock seeds one pending request and removes it on review. |
| Admin    | Venue management                                                                                     | Done        | Scoped venue create/update/deactivate and loading, empty, and error states use `/venues`; data refreshes from the list after mutations because mutation response fields are unspecified. Scanner/device-key registration remains unimplemented.                                                                                                                                                                                                                                                                                                            |
| Admin    | Users and role assignment                                                                            | Partial     | Role assignment posts generated user/role/scope payloads and surfaces API errors. The user is chosen with a type-to-search directory picker (`GET /users`); the scope ID is still entered manually (no scope-lookup endpoint). Broader user management remains unimplemented.                                                                                                                                                                                                                                                                              |
| Admin    | Academic calendar                                                                                    | Done        | Lists and creates/updates/deletes academic sessions and semesters using generated request/response types; loading, empty, and error states are present. Generic catalogue items guarantee only IDs, so labels/dates are shown when returned.                                                                                                                                                                                                                                                                                                               |
| Admin    | Department dashboard                                                                                 | Placeholder | Summary text only; no dashboard data flow.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Admin    | Institution dashboard                                                                                | Placeholder | Summary text only; no dashboard data flow.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Admin    | Abuse events                                                                                         | Placeholder | No event review/action flow.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Admin    | Audit log                                                                                            | Placeholder | No audit log viewer; shared mock audit entries are not surfaced in an admin screen.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Addendum | Mock scenario switcher (scanner offline, projector unavailable, network offline, fixed-code session) | Placeholder | Scanner and projector selectors exist. A unified network-offline/fixed-code scenario switcher is missing; offline can be tested via browser events and fixed code via the live action.                                                                                                                                                                                                                                                                                                                                                                     |
| Addendum | Phone report layout (student cards, 2x2 stats, scrolling filters, bottom-sheet dialog)               | Done        | CSS switches the report table to student cards below 800px, stats to a 2x2 grid and dialogs to bottom sheets on narrow phones; status filters scroll horizontally. Exact-device validation is deferred.                                                                                                                                                                                                                                                                                                                                                    |

## Cross-cutting and addendum requirements

| Requirement                                                  | Status      | Current implementation and remaining work                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsive layouts at 375 / 768 / 1280                       | Placeholder | Mobile report cards, phone stat grid, student phone tabs, and laptop student two-column layout are styled. Navigation breakpoint behavior does not match the required tablet icon rail at 768px (it uses the phone drawer below 800px), and no responsive-navigation tests are being added in this task per user request.                                                                                                       |
| Blue/gold design, fonts, logo and status badge contrast      | Placeholder | Tokens/fonts/logo/badges exist, but contrast audit and matching approved artboards have not been verified; design-reference screenshots are unavailable.                                                                                                                                                                                                                                                                        |
| Light/dark/auto theme and persistence                        | Done        | Theme selector supports all three modes and persists explicit choice; system and real-device appearance still need manual verification.                                                                                                                                                                                                                                                                                         |
| Theme quick-toggle on check-in/live screens                  | Placeholder | App-bar quick-toggle exists; dedicated check-in and live-screen toggles are missing.                                                                                                                                                                                                                                                                                                                                            |
| Keyboard/touch check-in input                                | Done        | Keyboard input supports paste/advance/backspace/arrows; coarse-pointer keypad is feature-detected. Dedicated pointer-device testing is deferred.                                                                                                                                                                                                                                                                                |
| WCAG AA contrast/focus audit                                 | Placeholder | Helper-level contrast tests exist, but full palette/component-state audit is not complete.                                                                                                                                                                                                                                                                                                                                      |
| Pause polling while hidden / GET backoff                     | Done        | Session-code hook skips hidden-tab polling and backs off after failures; retry behavior has unit coverage.                                                                                                                                                                                                                                                                                                                      |
| No offline mutation queue/retry                              | Done        | Check-in is disabled offline and mutations are not queued; real airplane-mode behavior remains a manual check.                                                                                                                                                                                                                                                                                                                  |
| Shared mock store and reset                                  | Done        | Shared state covers check-in, enrollment, history, lecturer roster/report, overrides, scanner/session state and print roster; reset restores fixture state.                                                                                                                                                                                                                                                                     |
| Route-level code splitting and student initial bundle target | Done        | Initial student JS **112.26 kB gzip**, below the ~200 kB target; lecturer and admin are separate lazy chunks (**5.83 kB** and **1.05 kB gzip**).                                                                                                                                                                                                                                                                                |
| API contract, generated types and centralized errors         | Partial     | Session lifecycle, lecturer offerings/venues, student flows, role-based identity, staff imports, signup review, password reset, venue/calendar administration, and role assignment use generated operation/request types from the synced contract. Generic signup/catalogue schemas omit several display fields and are handled defensively. The email outbox worker is backend-only. Real-backend compatibility is unverified. |
| CI and documentation coverage                                | Done        | CI and baseline docs exist; this inventory calls out incomplete product screens.                                                                                                                                                                                                                                                                                                                                                |

## Validation and latest measured output

Validation for the session form contract-alignment task (commands run from the repository root):

| Command                             | Result                                                                                                                                                                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm sync:api`                     | Passed; copied the current `../ATMs/api/openapi.yaml` and regenerated `src/api/schema.d.ts`.                                                                                                                               |
| Initial `pnpm typecheck` after sync | Failed on obsolete `LiveClass`/`Venue` schema aliases and the previous `radius_m` field. Those mismatches were fixed by aliasing generated operation response types and using `radius_meters`.                             |
| `pnpm lint`                         | Passed; 0 errors and 6 existing Fast Refresh warnings in `shared/ui/primitives.tsx`.                                                                                                                                       |
| Final `pnpm typecheck`              | Passed after contract alignment; `tsc -b --pretty false --force` completed without errors.                                                                                                                                 |
| `pnpm test`                         | Passed; 10 test files and 40 tests passed, including exact JSON request body, field errors, and returned session ID polling/end assertions.                                                                                |
| `pnpm build`                        | Passed; Vite transformed 307 modules. JS chunks were **376.66 kB / 113.41 kB gzip**, **24.16 kB / 7.10 kB gzip**, and **2.47 kB / 1.05 kB gzip** (total **403.29 kB / 121.56 kB gzip**); CSS **58.25 kB / 12.59 kB gzip**. |

Previous task complete: aligned the lecturer session form to the synced contract, improved course labels and field errors, removed the role switcher, and verified the returned-ID session lifecycle. Recommended next task: replace seeded lecturer report data with backend responses.

## Role-based identity validation

| Command          | Result                                                                                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`      | Passed with 0 errors and 6 existing Fast Refresh warnings in `shared/ui/primitives.tsx`.                                                                                                |
| `pnpm typecheck` | Passed; `tsc -b --pretty false --force` completed without errors.                                                                                                                       |
| `pnpm test`      | Passed; 10 test files and 43 tests passed, including `/me` role routing, 403 guard redirects, and profile identity display.                                                             |
| `pnpm build`     | Passed; Vite transformed 308 modules. JS chunks were **380.52 kB / 114.28 kB gzip**, **24.16 kB / 7.10 kB gzip**, and **2.47 kB / 1.05 kB gzip**; CSS was **59.33 kB / 12.80 kB gzip**. |

Current task complete: the app restores the session then loads `GET /me`, uses that response to choose the role workspace after login and page load, guards role-specific routes with a 403 redirect, and displays API-provided name, department ID, and level in the app bar and profile. The API does not provide a human-readable department name. Real-backend behavior remains unverified.

The following are not established yet: 375/768/1280 automated viewport coverage, real-backend compatibility, and real-device behavior for GPS, Wake Lock, fullscreen, airplane mode, printing, and power loss.

## Scoped admin courses and offerings

Department, faculty, and institution admins can browse offerings visible to their authenticated scope through `/offerings/search`; each result includes lecturer names assigned to that course. The unified course form creates a new catalogue course and makes it available for a selected semester in one submit, or schedules an existing course for another semester. New-course creation calls typed `POST /courses` followed by `POST /offerings`, because the backend stores the course and its semester offering separately. If the second request fails, the UI explicitly reports that the course exists but was not scheduled. A successful create refreshes search and filters the list to the new course. Department admins use their `GET /me` department scope, while faculty and institution admins select a department loaded from `GET /departments`; the backend authorizes the target department. The mock persists and searches the created offerings. Faculty-admin accounts are mapped to the admin workspace from the `faculty_admin` role returned by `GET /me`. There is no independent staff-directory endpoint; course/offering edit and delete remain unimplemented.

### Unified course creation and search

The UI treats a course as the product concept: admins create or select a course, then set the semester, level, registration, roster, and attendance settings that make it available for teaching. The lecturer can then teach that course and start class sessions for it. The user-facing create action no longer presents “course” and “offering” as unrelated workflows. A successful create refreshes `/offerings/search` and searches for the course code. A `202` response is presented as an awaiting-approval teaching request and is not shown as an active offering until approved.

An optional lecturer account UUID can be entered in the same form. After an offering is created, the UI reads its assignments and sends the current lecturer IDs plus the new one via `PUT /offerings/{id}/lecturers`, preserving existing assignments. Existing course offerings retain their per-row “Manage lecturers” action. When `POST /offerings` returns a pending teaching request (`202`), no offering exists yet to assign; the UI explains that the lecturer can be assigned after approval.

Code-review follow-up: the offerings list refresh (`setReloadKey`/`setCatalogueReloadKey`/`setQuery`) now runs after the lecturer `PUT` completes, so the refreshed list no longer renders “No lecturers assigned” beneath an assignment-success banner. The create flow also inspects `SetOfferingLecturersResponse.lecturer_ids`; if the server does not record the new lecturer, it throws so the existing catch reports that the course is available but the lecturer could not be assigned, rather than claiming success.

| Command | Result |
| --- | --- |
| `pnpm lint` | Passed with 0 errors and 4 existing Fast Refresh warnings in `src/shared/ui/primitives.tsx`. |
| `pnpm typecheck` | Passed; `tsc -b --pretty false --force` completed without errors. |
| `pnpm test --maxWorkers=1` | Passed; 13 test files and 70 tests passed. Coverage includes creating a course and its semester availability with generated payload types, optional lecturer assignment on new and existing courses, assignment retention, refreshing/searching the course, and mock persistence/search. |
| `pnpm build` | Passed; Vite transformed 310 modules. CSS was **63.45 kB / 13.46 kB gzip**; JS chunks were **389.11 kB / 116.33 kB**, **33.44 kB / 8.38 kB**, and **31.92 kB / 8.94 kB gzip**. |

| Command                    | Result                                                                                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm gen:api`             | Passed; regenerated `src/api/schema.d.ts` from the updated assigned-lecturer response contract.                                                                                           |
| `pnpm lint`                | Passed with 0 errors and 4 Fast Refresh warnings in `src/shared/ui/primitives.tsx`.                                                                                                    |
| `pnpm typecheck`           | Passed; `tsc -b --pretty false --force` completed without errors.                                                                                                                      |
| `pnpm test --maxWorkers=1` | Passed; 13 test files and 68 tests passed, including scoped course creation, faculty-admin access, retaining existing lecturer assignments, mock assignment persistence, and email instead of the UUID in the app bar. |
| `pnpm build`               | Passed; Vite transformed 310 modules. CSS was **63.45 kB / 13.46 kB gzip**; JS chunks were **389.11 kB / 116.34 kB**, **31.92 kB / 8.94 kB**, and **28.56 kB / 7.14 kB gzip**. |

Offering lecturer assignment uses `GET /offerings/{id}/lecturers` and `PUT /offerings/{id}/lecturers`. The GET response contract documents `id`, `display_name`, and `email` based on the confirmed backend response. Admins enter the target lecturer's account UUID because there is no staff directory endpoint. Before adding, the UI fetches assigned IDs and sends the existing IDs plus the new one in the replacement PUT; the assigned names/emails are refreshed afterward. The signed-in app bar displays the account email instead of a UUID beneath the name.

## Student API screens

| Command          | Result                                                                                                                                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm sync:api`  | Passed; synced `api/openapi.yaml` from the sibling backend and regenerated operation types.                                                                                                                                            |
| `pnpm lint`      | Passed with 0 errors and 4 Fast Refresh warnings in `src/shared/ui/primitives.tsx`.                                                                                                                                                    |
| `pnpm typecheck` | Passed; an initial run identified a nullable search result inside an effect, which was fixed using a local narrowed value.                                                                                                             |
| `pnpm test`      | Passed; 10 test files and 47 tests passed, including API-backed student empty states, search filters, registration/pending state, retry, and course-specific attendance history.                                                       |
| `pnpm build`     | Passed; Vite transformed 309 modules. JavaScript chunks were **384.12 kB / 115.17 kB gzip**, **24.22 kB / 7.13 kB gzip**, and **2.47 kB / 1.05 kB gzip** (total **410.81 kB / 123.35 kB gzip**); CSS was **61.35 kB / 13.12 kB gzip**. |

Student home, class search and registration, course list, and attendance history now use the synced API contract in real mode, with loading, empty, error, and retry states where applicable. Mock handlers use the same generated operation types for development. The timetable's “later today” comparison uses Africa/Lagos time. No server or browser visual check was run; real-backend compatibility and automated 375/768/1280 viewport coverage remain unverified.

## Student home API data mapping review

| Command          | Result                                                                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`      | Passed with 0 errors and 4 existing Fast Refresh warnings in `src/shared/ui/primitives.tsx`.                                                                                                                              |
| `pnpm typecheck` | Passed; `tsc -b --pretty false --force` completed without errors.                                                                                                                                                         |
| `pnpm test`      | Passed; 10 test files and 49 tests passed, including backend-shaped home responses for live status, venue, check-in state, offset-qualified timetable times, attendance threshold values, and past-class empty messaging. |
| `pnpm build`     | Passed; Vite transformed 309 modules. JavaScript chunks were **385.03 kB / 115.51 kB gzip**, **24.22 kB / 7.13 kB gzip**, and **2.47 kB / 1.05 kB gzip**; CSS was **61.51 kB / 13.14 kB gzip**.                           |

No server or browser visual check was run; real-backend behavior remains unverified.

## Lecturer offering and navigation review

The lecturer landing page no longer renders the same hard-coded lecturer name,
schedule, and offerings for every account. It displays the authenticated
profile name and the offerings returned by `/me/offerings`; selecting
“Start session” for an offering carries that offering ID into the session form.
The mock `/me/offerings` response is now filtered to the signed-in demo
lecturer's assignments.

| Command          | Result                                                                                                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`      | Passed with 0 errors and 4 existing Fast Refresh warnings in `src/shared/ui/primitives.tsx`.                                                                                                    |
| `pnpm typecheck` | Passed; `tsc -b --pretty false --force` completed without errors.                                                                                                                               |
| `pnpm test`      | Passed; 10 test files and 50 tests passed, including scoped offering display and selected-offering session navigation.                                                                          |
| `pnpm build`     | Passed; Vite transformed 309 modules. JavaScript chunks were **385.04 kB / 115.51 kB gzip**, **24.79 kB / 7.23 kB gzip**, and **2.47 kB / 1.05 kB gzip**; CSS was **61.57 kB / 13.15 kB gzip**. |

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

| Command                    | Result                                                                                                                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`                | Passed with 0 errors and 4 existing Fast Refresh warnings in `src/shared/ui/primitives.tsx`.                                                                                                    |
| `pnpm typecheck`           | Passed; `tsc -b --pretty false --force` completed without errors.                                                                                                                               |
| `pnpm test --maxWorkers=1` | Passed; 10 test files and 52 tests passed, including independent department filtering, closed-registration state, and existing student screen coverage.                                         |
| `pnpm build`               | Passed; Vite transformed 309 modules. JavaScript chunks were **385.04 kB / 115.54 kB gzip**, **24.79 kB / 7.23 kB gzip**, and **2.47 kB / 1.05 kB gzip**; CSS was **61.57 kB / 13.15 kB gzip**. |

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

| Command                    | Result                                                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm sync:api`            | Copy completed; generation failed because the upstream OpenAPI contains duplicate `500` response keys (first reported at line 652).                                                              |
| `pnpm gen:api`             | Passed after removing the duplicate keys and formatting malformed nested response blocks in the local copy.                                                                                      |
| `pnpm lint`                | Passed with 0 errors and 4 existing Fast Refresh warnings in `src/shared/ui/primitives.tsx`.                                                                                                     |
| `pnpm typecheck`           | Passed; `tsc -b --pretty false --force` completed without errors after regenerating types.                                                                                                       |
| `pnpm test --maxWorkers=1` | Passed; 12 test files and 57 tests passed, including CSV preview/atomic failure, one-time password reset, venue persistence, academic-session persistence, and existing app flows.               |
| `pnpm build`               | Passed; Vite transformed 309 modules. JavaScript chunks were **387.28 kB / 115.84 kB gzip**, **25.24 kB / 7.39 kB gzip**, and **19.74 kB / 4.89 kB gzip**; CSS was **61.57 kB / 13.15 kB gzip**. |

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

| Command                    | Result                                                                                                                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm sync:api`            | Copy completed; type generation failed on malformed upstream YAML flow mappings at lines 1250 and 1297.                                                                                         |
| `pnpm gen:api`             | Passed after formatting those two mappings in the local API copy.                                                                                                                               |
| `pnpm lint`                | Passed; 0 errors and 4 existing Fast Refresh warnings in `src/shared/ui/primitives.tsx`.                                                                                                        |
| `pnpm typecheck`           | Passed after updating the mock offering response to the refreshed generated schema.                                                                                                             |
| `pnpm test --maxWorkers=1` | Passed; 10 test files and 53 tests, including the lecturer root-to-route navigation and session-creation regression.                                                                            |
| `pnpm build`               | Passed; Vite transformed 309 modules. JavaScript chunks were **385.11 kB / 115.54 kB gzip**, **24.79 kB / 7.23 kB gzip**, and **2.47 kB / 1.05 kB gzip**; CSS was **61.57 kB / 13.15 kB gzip**. |

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

| Command                    | Result                                                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm sync:api`            | Copy completed; generation failed on duplicate `500` response keys in the backend spec.                                                                                                          |
| `pnpm gen:api`             | Passed after local OpenAPI syntax corrections.                                                                                                                                                   |
| `pnpm lint`                | Passed with 0 errors and 4 existing Fast Refresh warnings in `src/shared/ui/primitives.tsx`.                                                                                                     |
| `pnpm typecheck`           | Passed; `tsc -b --pretty false --force` completed without errors.                                                                                                                                |
| `pnpm test --maxWorkers=1` | Passed; 13 test files and all 61 tests passed, including the lecturer API-backed live/report and PDF tests.                                                                                      |
| `pnpm build`               | Passed; Vite transformed 309 modules. JavaScript chunks were **387.36 kB / 115.87 kB gzip**, **29.96 kB / 8.48 kB gzip**, and **19.74 kB / 4.89 kB gzip**; CSS was **61.57 kB / 13.15 kB gzip**. |

No servers were started; live-backend responses and generated PDF appearance
were not browser-verified.

## Lecturer live-session navigation

Starting a session already routed directly to its returned ID, but the sidebar's
Live session link dropped that query parameter. The API's `/me/offerings`
response exposes only `session_open`, not an open session ID, so the teaching
list could not reopen a session started in the current tab. The app now retains
the returned active session and offering IDs in `sessionStorage` scoped by
lecturer user ID, resumes that session from the Live session nav link, and offers
a per-offering “View live session” action when the active session is known.
Ending the session clears only the active-session pointer. The attendance code
is never stored. Mock mode continues to prefer its live demo-store session.

| Command                                                                                                               | Result                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm test --maxWorkers=1 src/app/App.test.tsx -t "starts a session, polls its returned code, and ends that session"` | Passed; verifies a started session can be revisited from My teaching and ended.                                                                                                                  |
| `pnpm test --maxWorkers=1 src/features/lecturer/pages/index.test.tsx`                                                 | Passed; 3 tests, including real-mode resume without a URL session ID.                                                                                                                            |
| `pnpm lint`                                                                                                           | Passed with 0 errors and 4 pre-existing Fast Refresh warnings in `src/shared/ui/primitives.tsx`.                                                                                                 |
| `pnpm typecheck`                                                                                                      | Passed; `tsc -b --pretty false --force` completed without errors.                                                                                                                                |
| `pnpm test --maxWorkers=1`                                                                                            | Passed; 13 test files and all 61 tests passed.                                                                                                                                                   |
| `pnpm build`                                                                                                          | Passed; Vite transformed 310 modules. JavaScript chunks were **387.38 kB / 115.87 kB gzip**, **30.88 kB / 8.77 kB gzip**, and **19.74 kB / 4.89 kB gzip**; CSS was **61.57 kB / 13.15 kB gzip**. |
| `git diff --check`                                                                                                    | Passed; no whitespace errors.                                                                                                                                                                    |

No server was started; the backend contract does not currently expose a way to
discover open session IDs created on another device or browser tab.

## Reopening reports after a session ends

The active session ID is cleared after ending, which previously left the
Session reports navigation without a report to open. Started-session metadata
(session ID, offering ID, start time, and course label only) is now kept in
user-scoped local storage (up to 50 sessions), separate from the active
session pointer and attendance code. My teaching lists recent reports, and
Session reports opens the latest one by default with a selector for other
locally started sessions.
The report endpoint remains the source of attendance data. Demo reset clears
the local report references.

| Command                                                                                                               | Result                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm test --maxWorkers=1 src/app/App.test.tsx -t "starts a session, polls its returned code, and ends that session"` | Passed; verifies the report remains reachable after the session ends.                                                                                                                            |
| `pnpm test --maxWorkers=1 src/features/lecturer/pages/index.test.tsx`                                                 | Passed; 4 tests, including fetching a completed report from saved metadata without a session ID in the URL.                                                                                      |
| `pnpm lint`                                                                                                           | Passed with 0 errors and 4 pre-existing Fast Refresh warnings in `src/shared/ui/primitives.tsx`.                                                                                                 |
| `pnpm typecheck`                                                                                                      | Passed; `tsc -b --pretty false --force` completed without errors.                                                                                                                                |
| `pnpm test --maxWorkers=1`                                                                                            | Passed; 13 test files and all 62 tests passed.                                                                                                                                                   |
| `pnpm build`                                                                                                          | Passed; Vite transformed 310 modules. JavaScript chunks were **388.76 kB / 116.26 kB gzip**, **31.92 kB / 8.94 kB gzip**, and **19.74 kB / 4.89 kB gzip**; CSS was **61.59 kB / 13.16 kB gzip**. |
| `git diff --check`                                                                                                    | Passed; no whitespace errors.                                                                                                                                                                    |

This archive covers sessions started in this browser. The API contract still
has no endpoint to list prior sessions started on another device.

## Teaching request review and offering-creation authorization

Aligned the admin workspace with the backend offering/teaching-request API map.

Offering-creation authorization was re-checked against the contract.
`POST /offerings` (`createOffering`) carries only `BearerAuth` with no role
restriction; the server gates it and returns `403` when the caller cannot
create for the course. The admin create flow therefore correctly allows
department, faculty, and institution admins to create offerings, so no change
was needed there.

Running `pnpm sync:api` against the local backend spec at `../ATMs` was
attempted but **not applied**: that spec is behind the committed contract. It
introduces duplicate `"500"` response keys (invalid YAML, which blocks
`gen:api`) and deletes the `OfferingLecturer` schema, downgrading
`GET /offerings/{id}/lecturers` to an untyped object and breaking the typed
lecturer-assignment code. The committed `api/openapi.yaml` was restored; the
backend spec needs those fixes before a future sync.

Added the previously missing teaching-request review screen. Scoped admins
(department/faculty/institution) see `/admin/teaching-requests`, which lists
pending cross-department requests from `GET /teaching-requests` and approves or
rejects a selected request with `PATCH /teaching-requests/{id}`. Approval
creates the offering and lecturer assignment on the backend. Each row shows the
course, requesting lecturer, and a status badge with an icon and text. The mock
seeds one pending request and removes it on review; demo reset restores it.

## Directory pickers for lecturer and administrator assignment

Replaced the three hand-typed account-UUID inputs in the admin workspace with a
type-to-search directory picker. The backend added `GET /users`
(`listDirectoryUsers`), synced into `api/openapi.yaml` via `pnpm sync:api`; the
same sync collapsed the earlier duplicate `"500"` response keys, so type
generation now succeeds and `OfferingLecturer` stays typed.

A reusable `UserSearchSelect` (`src/shared/ui/UserSearchSelect.tsx`) debounces
input and calls `GET /users?q=&role=&department_id=`, shows matching users
(name + email) in a listbox, and reports the chosen `id` to its parent; once a
user is picked it shows a chip with a Change control. It now backs:
- the optional lecturer on the unified course/offering create form
  (`role=lecturer`),
- the Add-lecturer control in Manage lecturers (`role=lecturer`), and
- the user in Administrator roles (no role filter).

Native `required` on those inputs was replaced with explicit guards in the
submit handlers and a disabled Add-lecturer button, since the picker reports a
value only when a row is chosen.

The mock seeds a 14-lecturer directory spread across Computer Engineering,
Electrical Engineering, and General Studies, and `GET /users` filters it by
`q`, `role`, and `department_id`. As with the other mock admin endpoints, the
mock gates on the admin role rather than enforcing the full per-scope filtering
the real backend applies.

| Command | Result |
| --- | --- |
| `pnpm sync:api` | Passed; copied the backend spec and regenerated `src/api/schema.d.ts`. The sync added `/users` + `DirectoryUser` and fixed the duplicate `"500"` keys; `OfferingLecturer` remains typed. |
| `pnpm lint` | Passed with 0 errors and 4 pre-existing Fast Refresh warnings in `src/shared/ui/primitives.tsx`. |
| `pnpm typecheck` | Passed; `tsc -b --pretty false --force` completed without errors. |
| `pnpm test` | Passed; 13 test files and all 72 tests passed, including the three migrated create/assign tests now driving the picker and a new directory-search test spanning departments. |
| `pnpm build` | Passed; Vite transformed 310 modules. CSS was **64.81 kB / 13.68 kB gzip**; JS chunks were **389.89 kB / 116.50 kB**, **38.10 kB / 9.47 kB**, and **31.94 kB / 8.95 kB gzip**. |

## Registration-mode toggle on offering creation

The backend expanded the `registration_mode` description on `POST /offerings`
(enum unchanged: `auto`, `open`, `approval`, `closed`), documenting the two
primary modes as a Self-register / Needs approval toggle with `auto`/`closed`
as advanced. Synced via `pnpm sync:api`.

The create offering/course form now presents a segmented toggle instead of a
four-option dropdown: **Self-register** (`open`, students approved immediately)
and **Needs approval** (`approval`, a lecturer or admin reviews each request),
with an "Advanced registration modes" disclosure exposing **Automatic enrolment**
(`auto`) and **Closed** (`closed`). A helper line describes the selected mode.
The default stays `open`. The submitted `registration_mode` value is unchanged,
so no payload or endpoint behavior changed.

| Command | Result |
| --- | --- |
| `pnpm sync:api` | Passed; regenerated types from the updated `registration_mode` description. |
| `pnpm lint` | Passed with 0 errors and 4 pre-existing Fast Refresh warnings in `src/shared/ui/primitives.tsx`. |
| `pnpm typecheck` | Passed; `tsc -b --pretty false --force` completed without errors. |
| `pnpm test` | Passed; 13 test files and all 72 tests passed; the offering-creation test now selects the "Needs approval" toggle. |
| `pnpm build` | Passed; Vite transformed 310 modules. CSS was **65.37 kB / 13.79 kB gzip**; JS chunks were **389.89 kB / 116.49 kB**, **39.18 kB / 9.73 kB**, and **31.94 kB / 8.95 kB gzip**. |

## Blue / gold / white interaction redesign and dark-mode fix

Reworked the interactive design system around a theme-aware accent so the
palette reads as blue / gold / white in both themes, and fixed dark-mode
contrast where blue text sat on the navy surface.

New tokens in `src/styles/tokens.css`: `--accent` / `--accent-hover` /
`--on-accent` (light = blue, dark = gold), gold CTA tokens (`--cta`,
`--cta-hover`, `--on-cta`), `--ring` (blue in light, gold in dark), shadow
tokens, and a shared `--ease`. In dark mode `--blue-700` now resolves to a
readable light blue (`#9db8ff`) so the many blue accent/label texts are legible;
the brand mark was pinned to `--navy-800` so it stays a deep blue regardless.

Interaction changes in `src/app/app.css`:
- Primary buttons are now gold with navy text (the hero accent), with a hover
  lift and shadow; secondary buttons gain an accent border on hover; all buttons
  get a focus-visible ring and a disabled state.
- Link/text buttons use `--accent`, so they are blue in light and gold in dark
  (the previously unreadable blue-on-navy links), with a focus ring.
- Inputs get a focus ring and border transition; the segmented registration
  toggle's active state uses the accent (blue in light, gold in dark); the
  pending status pill uses theme-aware warning tokens; directory results fade in
  and option names use `--ink`.
- Motion: shared easing, button/link/input/segmented transitions, hover lifts,
  a `fade-rise` entrance on page headings, panels, and summary strips, and a
  `pop-in` on the search dropdown — all disabled under
  `prefers-reduced-motion`.

### Login entrance + ambient app motion

Added richer, still-restrained motion on top of the redesign (all in
`src/app/app.css`, all gated by `prefers-reduced-motion`):
- Login screen: staggered `login-rise` entrance on the brand, eyebrow, headline,
  sub-copy and (via `.login-form > *:nth-child`) the form controls, plus a slow
  90s rotation (`login-spin`) on the decorative ring so the panel feels alive.
- Authenticated app shell: an ambient drifting glow layer (`.app-shell::before`,
  `@keyframes ambient-drift`, ~28s) — a soft blue glow upper-left and a warm gold
  glow lower-right that slowly drift/scale behind the content. Alpha is higher in
  dark (aurora) and very subtle in light. `.app-shell` is `position: relative`
  and `.main-column` gets `z-index: 1` so content stays above the layer.
- Hardened reduced-motion: the global `prefers-reduced-motion` block now also
  zeroes `animation-delay`, so staggered/ambient elements never hold their hidden
  start frame during a delay.

Verified in a headless Chrome run (`pnpm dev:mock` with `VITE_USE_MOCKS=true`): a
mid-animation login frame shows the staggered text still rising; the settled
login and the `/admin` shell (light + dark) show the ambient glow in place.

| Command | Result |
| --- | --- |
| `pnpm lint` | Passed with 0 errors and 4 pre-existing Fast Refresh warnings in `src/shared/ui/primitives.tsx`. |
| `pnpm typecheck` | Passed; `tsc -b --pretty false --force` completed without errors. |
| `pnpm test` | Passed; 13 test files and all 72 tests passed (no behavioral change). |
| `pnpm build` | Passed; Vite transformed 310 modules. CSS was **71.76 kB / 15.09 kB gzip**; JS chunks were **389.89 kB / 116.49 kB**, **39.18 kB / 9.73 kB**, and **31.94 kB / 8.95 kB gzip**. |

#### Earlier redesign run (before the login/ambient motion)

| Command | Result |
| --- | --- |
| `pnpm lint` | Passed with 0 errors and 4 pre-existing Fast Refresh warnings in `src/shared/ui/primitives.tsx`. |
| `pnpm typecheck` | Passed; `tsc -b --pretty false --force` completed without errors. |
| `pnpm test` | Passed; 13 test files and all 72 tests passed (no behavioral change). |
| `pnpm build` | Passed; Vite transformed 310 modules. CSS was **67.77 kB / 14.29 kB gzip**; JS chunks were **389.89 kB / 116.49 kB**, **39.18 kB / 9.73 kB**, and **31.94 kB / 8.95 kB gzip**. |

| Command | Result |
| --- | --- |
| `pnpm lint` | Passed with 0 errors and 4 pre-existing Fast Refresh warnings in `src/shared/ui/primitives.tsx`. |
| `pnpm typecheck` | Passed; `tsc -b --pretty false --force` completed without errors. |
| `pnpm test` | 70 passed, including the new "lists teaching requests and approves one as a scoped admin" test. 1 pre-existing failure, "renders the home screen from backend live, timetable, and course data", is time-of-day dependent (its `campusClockAfter` slots cross midnight late at night) and fails identically on the clean committed tree; it is unrelated to this change. |
| `pnpm build` | Passed; Vite transformed 310 modules. CSS was **63.75 kB / 13.52 kB gzip**; JS chunks were **389.89 kB / 116.49 kB**, **36.02 kB / 8.78 kB**, and **31.94 kB / 8.95 kB gzip**. |

## Scanner (device) management UI

Built the scanner-management workspace against the backend `/devices` contract
(synced via `pnpm sync:api`, which added `listDevices`, `provisionDevice`,
`regenerateDevicePairingCode`, `rotateDeviceKey`, `revokeDevice`,
`enqueueDeviceEnrolment` plus the `DeviceListItem` / `ProvisionedDevice` /
`PairingCode` / `EnrolmentEnqueueResponse` schemas). All calls use the normal
Bearer session; the web app never handles device keys. New "Scanners" nav entry
and `/scanners` route are available to lecturers and administrators (the server
authorizes by scope). Live-verified in headless Chrome (list, provision → pairing
modal, light + dark).

- New `ScannerAdministration` component in `src/features/admin/pages/index.tsx`:
  - **List** (`GET /devices`): each scanner shows name, venue, a status badge
    (icon + text — unpaired = amber "Awaiting pairing", active = green, revoked =
    grey), relative last-seen, health (firmware / battery / queue) when present,
    and "pairing code pending (expires …)" when a code is outstanding. A list-level
    403 shows a no-access panel instead of an error.
  - **Provision** (`POST /devices`): venue picker (from `GET /venues`) + name;
    the returned `pairing_code` is shown exactly once in a modal — large, copyable,
    with its expiry and the "will not be shown again" note. Hidden when the venue
    directory returns 403.
  - **Re-pair / rotate**: "Issue pairing code" (`POST /devices/{id}/pairing-code`)
    for unpaired scanners and "Rotate key" (`POST /devices/{id}/rotate-key`, behind
    a confirm warning the scanner goes offline until re-paired) both surface a new
    code in the same once-only modal.
  - **Revoke** (`DELETE /devices/{id}`) behind a confirm; the row becomes
    "Revoked".
  - **Enrol a student** (`POST /devices/{id}/enrolments`): inline student picker
    (`UserSearchSelect` with `role="student"`); on success shows "Queued on slot N"
    with the finger-placement instruction. No firmware-facing screens were built.
- Error codes surfaced in `src/api/errors.ts`: `device_scope_denied`,
  `device_not_found`, `student_not_found`, `invalid_request`.
- Typed contracts added in `src/api/contracts.ts`; derived only from the generated
  schema. Mock support added in `src/mocks/store.ts` (two seeded scanners, a
  student directory for the picker, and the device CRUD/enrolment functions),
  `src/mocks/handlers.ts` (all six routes, scope-gated to admins + lecturers), and
  `src/mocks/useDemoState.ts`. New CSS: device-row layout, status-pill variants,
  the pairing-code block, and a real `.button-row` rule (it had none, so action
  links were running together).
- Two new tests in `src/app/App.test.tsx`: provisioning shows the pairing code
  once, and enrolling a student reports the slot.

| Command | Result |
| --- | --- |
| `pnpm lint` | Passed with 0 errors and 4 pre-existing Fast Refresh warnings in `src/shared/ui/primitives.tsx`. |
| `pnpm typecheck` | Passed; `tsc -b --pretty false --force` completed without errors. |
| `pnpm test` | Passed; 13 test files and all 74 tests passed (2 new scanner tests). |
| `pnpm build` | Passed; Vite transformed 311 modules. CSS was **72.72 kB / 15.29 kB gzip**; the admin chunk grew to **48.33 kB / 12.00 kB gzip**; main JS **391.84 kB / 116.99 kB gzip**. |

## Live academic term in the top bar

Replaced the hard-coded "2024 / 2025 · Semester 2" term pill with a `TermPill`
component in `src/app/App.tsx` that derives the active term from the backend.

- On mount it fetches `GET /academic-sessions` and `GET /semesters` (both open to
  any authenticated role — students, lecturers and admins) and picks the current
  session as the one flagged `current`, else the one whose `starts_on`/`ends_on`
  range covers today, else the most recent; the current semester is chosen the
  same way within that session. Session/semester fields come through the open
  `CatalogueItem` (`additionalProperties`), so they are read defensively.
- It renders `"<session> · <semester>"` and renders nothing while loading, on
  error, or when the backend has no calendar yet (so no stale term is shown).
- Mock support: `src/mocks/store.ts` now seeds a current academic session
  ("2026 / 2027", `current: true`) with Semester 1 (covers today) and Semester 2,
  restored on `resetDemoData`. Verified in headless Chrome: the pill shows
  "2026 / 2027 · Semester 1" for admin, lecturer and student.

| Command | Result |
| --- | --- |
| `pnpm lint` | Passed with 0 errors and 4 pre-existing Fast Refresh warnings in `src/shared/ui/primitives.tsx`. |
| `pnpm typecheck` | Passed; `tsc -b --pretty false --force` completed without errors. |
| `pnpm test` | Passed; 13 test files and all 74 tests passed. |
| `pnpm build` | Passed; Vite transformed 311 modules. CSS **72.87 kB / 15.31 kB gzip**; main JS **393.30 kB / 117.47 kB gzip**. |

## Delete a course (admin or higher)

Wired the backend `DELETE /courses/{id}` (`deleteCourse`, synced via
`pnpm sync:api`) into the admin Courses & offerings page. The endpoint is
admin-scoped and generic — it deletes whichever catalogue course the admin
selects, not a fixed one.

- **UI** (`src/features/admin/pages/index.tsx`, `CoursesAndOfferings`): when an
  existing course is chosen in the Course picker, a delete row appears with a red
  "Delete course" action and a note that a course with offerings must have them
  removed first. It opens a confirm dialog; on success the course is removed, the
  picker resets to "Create a new course…", and the catalogue reloads.
- **Contract handling**: 204 → "… was deleted"; 409 `course_has_offerings` →
  "Remove this course's offerings before deleting it." (the backend forbids
  deleting a course that still has offerings); 404 `course_not_found` and 403 are
  surfaced via `presentApiError`. New codes added to `src/api/errors.ts`.
- **Mock**: `deleteDemoCourse` in `src/mocks/store.ts` returns
  `deleted`/`has_offerings`/`not_found`; `DELETE /courses/:id` handler in
  `src/mocks/handlers.ts` is gated to admins. Courses derived from seeded
  offerings correctly return 409; a seeded offering-free course ("CSC 110 ·
  Introduction to Computing") demonstrates the 204 path. Both restored on reset.
- **Tests** (`src/app/App.test.tsx`): deletes a course with no offerings; blocks
  deleting a course that still has offerings (409). Verified live in headless
  Chrome for both paths.

| Command | Result |
| --- | --- |
| `pnpm lint` | Passed with 0 errors and 4 pre-existing Fast Refresh warnings in `src/shared/ui/primitives.tsx`. |
| `pnpm typecheck` | Passed; `tsc -b --pretty false --force` completed without errors. |
| `pnpm test` | Passed; 13 test files and all 77 tests passed (2 new course-delete tests). |
| `pnpm build` | Passed; CSS **73.21 kB / 15.37 kB gzip**. |

### Delete an offering (completes the two-step removal)

Added `DELETE /offerings/{id}` (`deleteOffering`) so an admin can remove a
course's offerings, after which the freed course can be deleted — the proper
two-step flow the course-delete 409 points to.

- **UI**: each offering row in the Courses list now has a red "Delete offering"
  action beside "Manage lecturers", with a confirm dialog ("removes the offering
  and its lecturer assignments; attendance already recorded is kept"). On success
  the offerings list and the course catalogue both reload (so the now
  offering-free course is immediately deletable), and any open lecturer manager
  for that offering closes. 403/404 surfaced via `presentApiError`.
- **Mock**: `deleteDemoOffering` in `src/mocks/store.ts` removes the offering and
  its lecturer assignments; because the demo derives catalogue courses from
  offerings, it promotes the now offering-free course into the standalone
  catalogue so the two-step flow works (and the course then deletes cleanly).
  `DELETE /offerings/:id` handler in `src/mocks/handlers.ts` is admin-gated.
- **Test**: "deletes an offering, then the freed course can be deleted" exercises
  the whole flow; verified live in headless Chrome (ENG 301 offering removed →
  course stayed offering-free → course deleted and gone from the catalogue).

| Command | Result |
| --- | --- |
| `pnpm lint` | Passed with 0 errors and 4 pre-existing Fast Refresh warnings in `src/shared/ui/primitives.tsx`. |
| `pnpm typecheck` | Passed; `tsc -b --pretty false --force` completed without errors. |
| `pnpm test` | Passed; 13 test files and all 78 tests passed (1 new offering-delete flow test). |
| `pnpm build` | Passed; CSS **73.21 kB / 15.37 kB gzip**. |

## Reflect a self-registered course immediately

A student self-registering for an `open` offering is approved immediately
(`POST /offerings/{id}/registrations` → `status: "approved"`, `on_roster: true`),
but it didn't show as registered in the Find-a-class browse view.

Root cause (from the contract): the default browse list is `GET /me/offerings`,
whose schema (`CatalogueItem` + `{session_open, next_timetable_slot}`) carries
**no** registration status — only `GET /offerings/search` returns
`is_registered`/`registration_status`. So the browse card had no server signal
that the student was registered.

Fix in `src/features/student/pages/index.tsx` (`FindClasses`):
- Also read `GET /me/courses` (approved registrations) and `GET /me/registrations`
  (pending requests) and build sets of their `offering_id`s. Each browse card is
  marked **Registered** when its id is in the approved set (or the just-registered
  result is approved) and **Pending** when in the pending set — so both
  already-registered and just-registered courses render correctly.
- On a successful registration the view now reloads `/me/courses` and
  `/me/registrations` (alongside the active browse/search list), so an open
  self-registration flips to "Registered" without a manual refresh.

The dashboard, My courses, History and timetable already read `/me/courses`,
`/me/live-classes` and `/me/timetable` (which, per the contract, return approved
registrations) and re-fetch on mount, so an approved self-registration appears
there on navigation — no change needed, confirmed against the spec.

- **Test** (`src/app/App.test.tsx`): "marks a browse offering as registered when
  it is in the student's approved courses" — proves the browse card reflects the
  `/me/courses` state (the same source the dashboard uses).

| Command | Result |
| --- | --- |
| `pnpm lint` | Passed with 0 errors and 4 pre-existing Fast Refresh warnings in `src/shared/ui/primitives.tsx`. |
| `pnpm typecheck` | Passed; `tsc -b --pretty false --force` completed without errors. |
| `pnpm test` | Passed; 13 test files and all 79 tests passed (1 new; one admin test is occasionally flaky under load and passes on re-run). |
| `pnpm build` | Passed; CSS **73.21 kB / 15.37 kB gzip**. |
