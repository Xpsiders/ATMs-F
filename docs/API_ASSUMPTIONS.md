# API assumptions to confirm

The backend is being developed independently. This file records only guesses required to wire the UI; confirm these names and shapes against the final OpenAPI document.

| Endpoint                             | Assumption used by UI                                                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `POST /auth/refresh`                 | Refresh cookie is sent with credentials; success JSON contains `access_token`.                                         |
| `POST /auth/login`                   | JSON body is `{ email, password }`; access token is held in memory.                                                    |
| `POST /auth/signup/claim`            | JSON body is `{ matric, email }`; response is neutral whether or not the record matches.                               |
| `POST /auth/signup/verify`           | JSON body is `{ email, code }`; `code` is six digits.                                                                  |
| `POST /auth/signup/password`         | JSON body is `{ email, password }`; password must be at least 10 characters.                                           |
| `POST /auth/password/forgot`         | JSON body is `{ email }`; response is neutral to avoid account enumeration.                                            |
| `POST /auth/password/verify`         | JSON body is `{ email, code }`; `code` is six digits.                                                                  |
| `POST /auth/password/reset`          | JSON body is `{ email, code, password }`; password must be at least 10 characters.                                     |
| `POST /auth/password/change`         | JSON body is `{ current_password, password }`; new password must be at least 10 characters.                            |
| `GET /sessions/{id}/code`            | Returns `{ code, seconds_remaining, server_time }`; the server, not browser clock, controls rotation.                  |
| `POST /check-ins`                    | Body contains `session_id`, six-digit `code`, `lat`, `lng`, `accuracy`, and `device_hash`; success can include `late`. |
| `PATCH /sessions/{id}`               | `{ rotating: false }` switches the session once to a fixed code; success returns the fixed `code`.                     |
| `POST /sessions/{id}/end`            | Confirms ending an active session.                                                                                     |
| `POST /sessions/{id}/overrides`      | Records one audited status override.                                                                                   |
| `POST /sessions/{id}/overrides/bulk` | Receives selected student IDs, status and reason; records results per student.                                         |
| `GET /sessions/{id}/roster-sheet`    | Returns an array of `{ name, matric_number }` for the print-friendly roster.                                           |
| `GET /sessions/{id}/report.csv`      | Returns an authenticated `text/csv` download.                                                                          |
| Error envelope                       | Non-success response is `{ error: { code, message, details } }`; `Retry-After` may be seconds or an HTTP date.         |

The login response is assumed to contain only `access_token`; user identity and role resolution are not yet wired to a backend response.
Check-in success is assumed to contain `status`, `late`, and optionally `distance_meters`. Bulk override results are assumed to contain one `{ student_id, success, message? }` per student. Error `details` are not interpreted by the UI.

Error identifiers currently recognized centrally in `src/api/errors.ts`: `wrong_code`, `code_expired`, `session_closed`, `outside_radius`, `not_on_roster`, `already_checked_in`, `accuracy_too_poor`, `too_many_attempts`, `device_not_bound`, `code_locked`, `account_temporarily_locked`, `token_reuse_detected`, `lecturer_has_open_session`, `venue_has_open_session`, `no_active_session`, `device_key_revoked`, and `rate_limited`.

Every other endpoint, field, and final error-code spelling must be updated from the real spec when it arrives. Use `pnpm run sync:api` (`API_SPEC_PATH` can override the default source path); run `pnpm run typecheck` immediately afterward to surface drift.
