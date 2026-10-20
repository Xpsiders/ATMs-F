# Manual test guide

1. For the mock demo, set `VITE_USE_MOCKS=true` in the local environment and run `pnpm dev`. Open a fresh browser session: it should show the login page, not a dashboard. The mock does not require the API server.
2. On the login page, use the dev-only **Demo accounts** panel to sign in as each role. Confirm student, lecturer, department-admin and institution-admin each open the matching dashboard. Also try the listed credentials manually from [MOCK_DATA.md](./MOCK_DATA.md).
3. While signed in, use **Reset demo data** in the app bar and confirm the shared roster, attendance report, and session state return to their seed values. Then use **Log out and reset demo** in the login panel; confirm the login page returns and a reload does not restore the prior mock role.
4. For a real API run, start the backend, set `VITE_API_BASE_URL`, and configure its `ALLOWED_ORIGIN` to the app origin (`http://localhost:5173` in development). Run `pnpm dev`; refresh requests include credentials for the backend refresh cookie.
5. As a student, claim a signup using matric number and email, verify email, set a password, and check that known and unknown matric numbers receive the same claim response.
6. Search classes with a typo, filter by department/level/kind, inspect pagination, and exercise open, approval, closed and automatic registration modes.
7. Register for a class, open check-in, allow or deny GPS, enter/paste a code, retry location, and check success, late, wrong/expired code, outside-radius, off-roster, duplicate, poor-accuracy, lockout, device-not-bound and closed-session responses. In mock mode, use the development scenario selector to check the centralized API error messages.
8. As a lecturer, start a session, show projector mode, observe a server-polled rotating code and live roster, unlock a locked student, end the session, and inspect/override a report. Switch to fixed code and confirm that no rotating-code option returns.
9. Preview a CSV with valid and invalid rows, correct it, then commit. Register a scanner and verify the device key appears once and requires explicit save confirmation.
10. Visit a lecturer/admin URL as a student and confirm the API-backed 403 experience; test a missing URL, dark mode, keyboard-only navigation and offline/slow-network handling.
11. Check student screens at 375px and lecturer/admin screens at 768px and 1280px.
12. On a phone, use Board mode with the projector off, portrait orientation and the screen awake; also try it without Wake Lock support. Confirm Escape exits fullscreen on a keyboard.
13. During a check-in, enable airplane mode and confirm no submission is queued or retried; restore the connection and check in manually.
14. Unplug a scanner mid-session and verify the coverage warning and API-returned web-only statuses. Test the report's bulk override reason and per-row result.
15. Print the roster sheet and confirm student name, matric number, course, date, venue and blank signature column are legible.
16. In a dark room, set minimum screen brightness and verify the code and status contrast; test dark, light and auto theme modes.

Things to try to break: double-tap Check in; submit an expired session; leave a tab stale through code rotation; trigger a 429 cooldown; upload a huge/binary CSV; render names containing `<script>`; and navigate directly to a forbidden route.
