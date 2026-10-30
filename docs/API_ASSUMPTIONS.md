# API contract notes

`api/openapi.yaml` is the frontend's working copy of the backend contract. Its
check-in GPS requirements and attendance classification values reflect the
backend rules supplied for this change; keep the sibling API specification in
sync. The generated types in `src/api/schema.d.ts` are the source of truth for
API operations and payloads; frontend aliases are maintained in
`src/api/contracts.ts`.

## Confirmed contract details used by the UI

| Operation | Contract shape relied on by the frontend |
| --- | --- |
| `POST /auth/login` | Requires `institution_id`, `email`, and `password`; returns the access token and user profile/roles. The access token stays in memory. |
| `POST /auth/refresh` | Uses the refresh cookie (`credentials: "include"`); returns an access token or 401. |
| `POST /auth/signup-claim` | Requires `institution_id`, `matric_no`, and `email`; returns an enumeration-safe 202 acknowledgement. |
| `POST /auth/verify-email` | Requires `institution_id`, `matric_no`, six-digit `code`, and `password`; returns a token response. |
| `POST /auth/password/change` | Requires `current_password` and `new_password`. |
| `GET /me/offerings` | Returns paginated offerings visible to the authenticated user; each item has an `id`, `session_open`, and nullable `next_timetable_slot`. Additional course display fields are allowed but not specified by the schema. |
| `GET /venues` | Returns paginated venue items with `id`, `name`, `latitude`, `longitude`, and `radius_meters`. |
| `GET /me/live-classes` | Returns live sessions visible to the authenticated student, including session/offering/venue IDs and course display fields. |
| `GET /me/timetable` | Returns today's timetable entries with offering, course, venue, start/end time, and live indicator. |
| `GET /me/courses` | Returns approved courses with session counts, attendance percentage, minimum threshold, and below-threshold boolean. |
| `GET /me/attendance?offering_id={uuid}` | Returns per-session attendance status, classification (including `proxy`), date, and optional override reason for one approved course. |
| `GET /me/registrations` | Returns pending registration requests with course labels and created timestamp. |
| `GET /departments` | Returns a paginated catalogue of departments. The generated catalogue item guarantees `id`; the UI uses `name` only when the backend includes it. |
| `GET /offerings/search?q=...` | Returns typed offering/course identity, department, level, kind, registration mode, lecturers, and registration status flags. |
| `POST /offerings/{id}/registrations` | Submits registration for open offerings or a request for approval-mode offerings; response includes approved/pending state. |
| `POST /checkins` | Requires session ID, six-digit code, `lat`, `lng`, `accuracy`, and the existing device hash. The frontend captures a fresh browser GPS fix for each attempt; `location_required` is retryable. The session code remains decisive: distance is evidence and never a frontend refusal. Response status is server-owned. |
| `POST /sessions` | The frontend sends exactly `offering_id`, `venue_id`, boolean `rotating_code`, and numeric `late_after_min` as JSON. The response includes the created `session.id`, code, and server-authoritative remaining seconds. |
| `GET /sessions/{id}/code` | Returns `session`, `code`, and server-authoritative `seconds_remaining`. |
| `PATCH /sessions/{id}` | `{ rotating: false }` converts once to fixed code; response is the session code response. |
| `POST /sessions/{id}/end` | Ends a session and returns the session. |
| `GET /sessions/{id}/report?format=csv` | Returns report JSON or `text/csv`. |
| `GET /sessions/{id}/roster-sheet` | Returns a paginated `RosterPage` (`items` with `display_name` and `matric_no`) or CSV. |
| `POST /sessions/{id}/overrides/bulk` | Requires student IDs, status (`present`, `absent`, `late`, `excused`), reason code, and optional note; results use `applied` and optional `error_code`. |
| `POST /imports/staff/preview` and `POST /imports/staff` | Both accept a raw `text/csv` body with `staff_no,email,display_name,department_id` headers. Preview returns parsed rows and row errors; commit revalidates and is atomic, returning 422 with row errors without committing any row. |
| `GET /signup-requests` | Returns pending requests scoped to the administrator's departments. The schema declares `items` as an array of unspecified objects, so the UI only enables review when it can read an `id` and does not assume request fields. |
| `POST /signup-requests/{id}/review` | Requires `status` (`approved` or `rejected`). Approval additionally sends `department_id`, `level`, `programme_id`, and `display_name`; the endpoint documents scope enforcement and audit recording. |
| `POST /auth/password/forgot` | Requires `institution_id` and `email`; returns the same 202 acknowledgement regardless of whether the account exists. |
| `POST /auth/password/reset` | Requires `institution_id`, `email`, one-time `code`, and `new_password` (12–72 characters). The backend enforces the attempt cap/rate limit; its exact threshold is not published, so the UI displays API errors rather than inventing a retry count. |
| `GET /venues` | Returns paginated venues with `active` and optional `department_id` in addition to location and radius. |
| `GET /venues/{id}/scanner-status` | Confirmed read-only endpoint for the lecturer Live session screen and other venue-reader roles. It returns exactly `status` (`online`, `offline`, or `no_scanner`) and nullable `last_seen_at`; the server computes online/offline from its heartbeat freshness policy. The backend must enforce institution isolation and avoid disclosing whether a foreign-tenant venue exists. The specific heartbeat cutoff is not published. |
| `POST /venues` / `PATCH /venues/{id}` / `DELETE /venues/{id}` | Create, update, or deactivate scoped venues. Create/update response schemas are generic objects without declared properties; the UI refreshes `GET /venues` after mutations instead of relying on response fields. |
| `GET/POST/PATCH/DELETE /academic-sessions` and `/semesters` | Lists are paginated generic catalogue items that guarantee only `id`; the UI reads optional names, dates, and parent-session IDs when present. Create/update bodies use generated request types; delete returns 204. |
| `POST /role-assignments` | Assigns only `department_admin` or `faculty_admin` with the matching `scope_type` and scope UUID. The UI collects the user/scope UUIDs because the contract exposes no user or faculty lookup for this form. |
| `GET /sessions/{id}/live` | Returns current paginated session counts and roster classification. The live screen polls this endpoint every five seconds and loads all returned roster pages; the contract does not include web/scan timestamps or scanner coverage here. |
| `GET /sessions/{id}/report` | JSON returns paginated attendance statuses, classifications (including review-needed `proxy`), optional backend reason codes, and scanner-coverage intervals. The report page shows status separately from classification and displays the reason when present. It renders server results without recalculating scan or GPS evidence; matching fingerprint scans may confirm attendance without a web check-in or override distant phone GPS. The contract does not include web/scan timestamps or department names, so those display as unavailable / department IDs. |
| `GET /sessions/{id}/report?format=pdf` | Returns the session report as `application/pdf`; the report screen downloads this server-generated PDF using the active session ID. |
| `GET /sessions/{id}/roster-sheet?format=pdf` | Returns the ordered attendance roster as `application/pdf`; the roster screen supports this PDF download as well as browser printing. |

`VITE_INSTITUTION_ID` must be set to the institution UUID for real login and
student-claim requests. The repository does not provide an institution-specific
default.

`GET /me/offerings` is used for the lecturer's selector rather than the
institution-wide `GET /offerings`. Its generated item guarantees an ID,
`session_open`, and `next_timetable_slot`, but permits additional course
display fields; the selector displays `course_code` / `course_title` or `code`
/ `title` when returned, and never substitutes an ID for the course label.

The `POST /sessions` request schema forbids additional properties. The UI sends
only the two selected IDs and the two session options; venue coordinates and
radius are copied by the backend from the selected venue. The returned
`session.id` is the authoritative ID for code polling and session ending.

## Operations not present in the synced contract

The current OpenAPI does not define standalone signup-code verification,
signup-password, or single-student override operations. In real-API mode the
corresponding unsupported auth flows report that the current contract does not
support them; the lecturer uses the defined bulk override endpoint for one or
more selected students. Do not add guessed routes or payload fields without a
backend contract update.

The email outbox retry worker is backend infrastructure. The contract exposes
no worker control or email-delivery endpoint, so it is intentionally not
represented as a frontend screen or operation.

The report screen derives its displayed totals from the classified JSON report
rows; it does not invent web-check-in or fingerprint-scan counts because those
totals are not part of `SessionReportPage`. The live screen uses the counts
provided by `/sessions/{id}/live`.

The development mock password-reset flow uses a one-time demo code maintained
only in `src/mocks/`; it is not a production default. The mock enforces
single-use behavior but does not model the backend's unpublished attempt cap.

The synced student contract includes the requested course, timetable,
attendance, pending registration, search, and registration operations. The
search result types the registration mode and status flags, but does not include
a backend-provided closed-registration reason. The UI therefore displays the
contract-supported state ("Registration is closed for this offering") without
claiming a more specific backend reason.

Class-search department filters load their options from authenticated
`GET /departments`, independently of search results. This is needed because
`GET /offerings/search` defaults an unfiltered student query to their home
department and level; deriving the filter options from those results would
hide other departments before the student could select them.

Session creation now uses `POST /sessions` and propagates its returned ID to
code polling, session ending, report links, and print-sheet requests. Student
check-in loads `GET /me/live-classes` and submits the selected class's returned
session ID. Mock sessions use generated UUIDs; no attendance-session ID is
hardcoded. Live/report summary numbers and mock report rows remain seeded. The
synced operations have not been validated against a running backend during
this task.

All API error responses use the contract's `ErrorEnvelope`. `Retry-After` is
parsed as either seconds or an HTTP date by the shared API client.
