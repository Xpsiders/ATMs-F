# Demo accounts and mock data

All credentials and records below are fictional development fixtures. Enable the demo panel and mock session with `VITE_USE_MOCKS=true` while running the Vite development server. Do not reuse these passwords outside the local demo. No mock access token is created or persisted.

## Demo accounts

| Email | Password | Role | Dashboard |
|---|---|---|---|
| `amara.student@campus.example` | `StudentDemo!2026` | Student | Student overview |
| `ngozi.lecturer@campus.example` | `LecturerDemo!2026` | Lecturer (Dr. Ngozi Eze) | Teaching |
| `admin.department@campus.example` | `DepartmentDemo!2026` | Department admin | Department dashboard |
| `admin.institution@campus.example` | `InstitutionDemo!2026` | Institution admin | Institution dashboard |

The one-click login controls select the role without storing the displayed password. The current role is held in memory and in the dev-only `campuscheck-mock-role` session-storage flag. A fresh session without that flag receives a mock `401` from `POST /auth/refresh`.

## Seeded offerings and classes

| Offering | Department / level | Type / registration | Where it appears |
|---|---|---|---|
| ENG 301 — Engineering Mathematics III | Electrical Engineering / 300 | General / Open / Dr. Ngozi Eze | Student home, timetable, check-in, lecturer live session, report, print sheet |
| CPE 305 — Computer Architecture | Computer Engineering / 300 | Core / Approval / Mr. Chidi Obi | Student class search; demo registration can create a pending approval request |
| GST 201 — General Studies | General Studies / 300 | General / Open / Dr. Tunde Bello | Student home, timetable, courses and class search; attendance seed is 68% |
| CPE 318 — Embedded Systems Design | Computer Engineering / 300 | Elective / Closed / Prof. Ada Nwosu | Student class search |
| CSC 342 — Human Computer Interaction | Computer Science / 300 | Core / seeded teaching-card fields are not defined | Lecturer teaching list |
| CSC 326 — Database Management | Computer Science / 300 | Core / seeded teaching-card fields are not defined | Lecturer teaching list and student schedule |
| CSC 318 — Software Engineering | Computer Science / 300 | Core / seeded teaching-card fields are not defined | Lecturer teaching list and student schedule |

The initial in-memory mock store has ENG 301, CPE 305, GST 201, and CPE 318. Student home, search, course cards, registration actions, timetable, attendance history, check-in, lecturer roster/report, scanner state, session fixed-code state, and print sheet use mock API handlers backed by the shared mock store. Real-mode student screens call the API directly and do not read this store.

## Session, students, attendance, scanners

| Kind | Seed |
|---|---|
| Session | A UUID generated at mock-store initialization, ENG 301, started 20 October 2026 at 08:02 UTC, LT 2, live, rotating code `381204`, full scanner coverage |
| Live counts | 184 registered, 142 web check-ins, 12 fingerprint scans |
| Scanner | `scanner-lt2`, Engineering Building · Lecture Theatre 2, online |
| Student | Amara Okafor — id `2021-18420`, matric `2021 / 18420`, Computer Engineering |
| Student | Tunde Adebayo — id `2021-19422`, matric `2021 / 19422`, Electrical Engineering |
| Student | Zara Mohammed — id `2021-20117`, matric `2021 / 20117`, Computer Engineering |
| Student | Daniel Eze — id `2021-18653`, matric `2021 / 18653`, Electrical Engineering |
| Student | Ifeoma Obi — id `2021-17703`, matric `2021 / 17703`, Computer Engineering |
| Student | Chidi Nwosu — id `2021-19401`, matric `2021 / 19401`, Electrical Engineering |

The report sample starts with six rows: two verified, one suspected proxy, one scan-only, and two absent. These are server-shaped sample classifications, not a reclassification algorithm or a representative set for the session totals. The print-sheet page displays all six seeded students.

## Scenario switches

| Switch | Available values / behavior | Screen |
|---|---|---|
| Check-in error selector | Success with code `381204`, plus `wrong_code`, `code_expired`, `session_closed`, `outside_radius`, `not_on_roster`, `already_checked_in`, `accuracy_too_poor`, `too_many_attempts`, `device_not_bound`, `code_locked`, `account_temporarily_locked`, `no_active_session`, `rate_limited`, `device_key_revoked`, `token_reuse_detected`, `lecturer_has_open_session`, `venue_has_open_session` | Student check-in; development-only |
| Live-session scenario selector | Normal scanner/projector state, scanner offline, projector unavailable; scanner selection updates shared scanner coverage | Lecturer live session; development-only |
| Report scanner selector | Scanner online / scanner offline; updates the same shared scanner state as the live screen | Lecturer report; development-only |
| Network state | Uses browser `online` / `offline` events; there is no mock scenario selector yet | App shell and check-in |
| Fixed-code switch | Confirmed action changes shared session state to a fixed code; student check-in reads the current session code; there is no separate scenario selector | Lecturer live session |
| Attendance updates | Successful student check-in updates that student's session row; lecturer overrides update the same row and add an audit event | Student check-in / lecturer report / student history |
| Reset demo data | Restores the seed store without logging out; available in the authenticated app bar and login demo panel ("Log out and reset demo") | Any authenticated demo role / login |

The addendum's dedicated mock selectors for network offline and "session switched to fixed code" are not implemented yet. The actions can be tested directly using browser network events and the fixed-code confirmation.
