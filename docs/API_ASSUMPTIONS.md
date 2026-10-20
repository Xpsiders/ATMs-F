# API contract notes

`api/openapi.yaml` is currently synced from the sibling backend repository. The
generated types in `src/api/schema.d.ts` are the source of truth for API
operations and payloads; frontend aliases are maintained in
`src/api/contracts.ts`.

## Confirmed contract details used by the UI

| Operation | Contract shape relied on by the frontend |
| --- | --- |
| `POST /auth/login` | Requires `institution_id`, `email`, and `password`; returns the access token and user profile/roles. The access token stays in memory. |
| `POST /auth/refresh` | Uses the refresh cookie (`credentials: "include"`); returns an access token or 401. |
| `POST /auth/signup-claim` | Requires `institution_id`, `matric_no`, and `email`; returns an enumeration-safe 202 acknowledgement. |
| `POST /auth/verify-email` | Requires `institution_id`, `matric_no`, six-digit `code`, and `password`; returns a token response. |
| `POST /auth/password/change` | Requires `current_password` and `new_password`. |
| `GET /me/offerings` | Returns paginated offerings visible to the authenticated lecturer; `id` is generated as UUID. Additional course display fields are allowed but not specified by the schema. |
| `GET /venues` | Returns paginated venue items with `id`, `name`, `latitude`, `longitude`, and `radius_meters`. |
| `GET /me/live-classes` | Returns live sessions visible to the authenticated student, including session/offering/venue IDs and course display fields. |
| `POST /checkins` | Requires session ID, six-digit code, coordinates, and accuracy; returns `present` or `late`, roster/accuracy flags, and distance. |
| `POST /sessions` | The frontend sends exactly `offering_id`, `venue_id`, boolean `rotating_code`, and numeric `late_after_min` as JSON. The response includes the created `session.id`, code, and server-authoritative remaining seconds. |
| `GET /sessions/{id}/code` | Returns `session`, `code`, and server-authoritative `seconds_remaining`. |
| `PATCH /sessions/{id}` | `{ rotating: false }` converts once to fixed code; response is the session code response. |
| `POST /sessions/{id}/end` | Ends a session and returns the session. |
| `GET /sessions/{id}/report?format=csv` | Returns report JSON or `text/csv`. |
| `GET /sessions/{id}/roster-sheet` | Returns a paginated `RosterPage` (`items` with `display_name` and `matric_no`) or CSV. |
| `POST /sessions/{id}/overrides/bulk` | Requires student IDs, status (`present`, `absent`, `late`, `excused`), reason code, and optional note; results use `applied` and optional `error_code`. |

`VITE_INSTITUTION_ID` must be set to the institution UUID for real login and
student-claim requests. The repository does not provide an institution-specific
default.

`GET /me/offerings` is used for the lecturer's selector rather than the
institution-wide `GET /offerings`. The generated catalogue item guarantees an
ID but permits additional fields; the selector displays `course_code` /
`course_title` or `code` / `title` when returned, and never substitutes an ID
for the course label.

The `POST /sessions` request schema forbids additional properties. The UI sends
only the two selected IDs and the two session options; venue coordinates and
radius are copied by the backend from the selected venue. The returned
`session.id` is the authoritative ID for code polling and session ending.

## Operations not present in the synced contract

The current OpenAPI does not define forgot-password, reset-password, standalone
signup-code verification, signup-password, or single-student override
operations. In real-API mode the corresponding unsupported auth flows report
that the current contract does not support them; the lecturer uses the defined
bulk override endpoint for one or more selected students. Do not add guessed
routes or payload fields without a backend contract update.

Session creation now uses `POST /sessions` and propagates its returned ID to
code polling, session ending, report links, and print-sheet requests. Student
check-in loads `GET /me/live-classes` and submits the selected class's returned
session ID. Mock sessions use generated UUIDs; no attendance-session ID is
hardcoded. Live/report summary numbers and mock report rows remain seeded. The
synced operations have not been validated against a running backend during
this task.

All API error responses use the contract's `ErrorEnvelope`. `Retry-After` is
parsed as either seconds or an HTTP date by the shared API client.
