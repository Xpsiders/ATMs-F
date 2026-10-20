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
| `POST /checkins` | Requires session ID, six-digit code, coordinates, and accuracy; returns `present` or `late`, roster/accuracy flags, and distance. |
| `POST /sessions` | Requires offering/venue IDs and `rotating_code`; returns the session and code response. |
| `GET /sessions/{id}/code` | Returns `session`, `code`, and server-authoritative `seconds_remaining`. |
| `PATCH /sessions/{id}` | `{ rotating: false }` converts once to fixed code; response is the session code response. |
| `POST /sessions/{id}/end` | Ends a session and returns the session. |
| `GET /sessions/{id}/report?format=csv` | Returns report JSON or `text/csv`. |
| `GET /sessions/{id}/roster-sheet` | Returns a paginated `RosterPage` (`items` with `display_name` and `matric_no`) or CSV. |
| `POST /sessions/{id}/overrides/bulk` | Requires student IDs, status (`present`, `absent`, `late`, `excused`), reason code, and optional note; results use `applied` and optional `error_code`. |

`VITE_INSTITUTION_ID` must be set to the institution UUID for real login and
student-claim requests. The repository does not provide an institution-specific
default.

## Locally drafted operations

The sibling backend OpenAPI did not define these two operations when the
session-ID flows were connected. They are marked `x-draft: true` in
`api/openapi.yaml` and must be confirmed by the backend owner:

| Operation | Draft response fields relied on by the UI |
| --- | --- |
| `GET /me/live-classes` | `{ items: LiveClass[] }`; each item has `session_id`, `offering_id`, `course_code`, `course_title`, `venue_id`, `venue_name`, `lecturer_name`, `started_at`, `late_after_min`, `rotating_code`, and `already_checked_in`. |
| `GET /venues` | `{ items: Venue[], total }`; each venue has `id`, `name`, `latitude`, `longitude`, and `radius_m`. |

`GET /offerings` is present in the synced contract. The frontend relies only on
each item's `id`; display labels use the generated `Offering {id}` fallback
because the contract does not guarantee course title/code fields on this list.
`POST /sessions` accepts the selected offering and venue IDs plus session
options, and the frontend relies on the response's `session.id` as the
authoritative ID for code polling and ending that session. The mock store adds
richer demo descriptions separately.

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
two locally drafted operations have not been validated against a running
backend; the backend was unavailable during the implementation and both
operations must be confirmed by its owner before real-API use.

All API error responses use the contract's `ErrorEnvelope`. `Retry-After` is
parsed as either seconds or an HTTP date by the shared API client.
