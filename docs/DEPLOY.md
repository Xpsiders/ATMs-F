# Deploying the CampusCheck web app to Render

The web app is a **Vite single-page app**. It builds to static files in `dist/`
and is served by Render as a **Static Site**. It has no server of its own — it
talks to the ATMs backend API over HTTPS using cookie-based auth.

## What's in the repo for deploys

| File | Purpose |
| --- | --- |
| `render.yaml` | Render Blueprint: build command, publish dir, SPA rewrite, security headers, env vars. |
| `.env.example` | The full list of environment variables, documented. |
| `.node-version` | Pins Node `22.11.0` for reproducible builds. |

## Environment variables

All of these are **build-time** (Vite inlines `VITE_*` values into the bundle),
so changing one means a **rebuild/redeploy**, not just a restart.

| Variable | Required | Example (prod) | Notes |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | yes | `https://atms-api.onrender.com` | Backend origin, **no trailing slash**. Set in the dashboard (`sync: false`). |
| `VITE_INSTITUTION_ID` | yes | `10000000-0000-4000-8000-000000000001` | Institution UUID for the student claim flow. Set in the dashboard. |
| `VITE_APP_NAME` | no | `CampusCheck` | Display name. Defaulted in `render.yaml`. |
| `VITE_USE_MOCKS` | no | `false` | Keep `false` in prod. Mocks only run in dev/test builds anyway. |
| `NODE_VERSION` | no | `22.11.0` | Build Node version. Defaulted in `render.yaml`. |

`API_SPEC_PATH` is local tooling only (the `pnpm sync:api` script) — do not set it on Render.

## Deploy process (Blueprint — recommended)

1. Push this repo (including `render.yaml`) to GitHub/GitLab.
2. In Render: **New → Blueprint**, pick the repo. Render reads `render.yaml` and
   proposes the `campuscheck-web` static site.
3. Fill in the two `sync: false` env vars when prompted:
   - `VITE_API_BASE_URL` → your backend's HTTPS URL.
   - `VITE_INSTITUTION_ID` → the institution UUID.
4. **Edit the CSP** in `render.yaml`: change `connect-src ... https://your-atms-api.onrender.com`
   to your real backend origin (it must match `VITE_API_BASE_URL`), commit, push.
   If you skip this the app loads but every API call is blocked by the browser.
5. **Apply** the blueprint. Render runs `pnpm install --frozen-lockfile && pnpm build`
   and publishes `dist/`.

### Alternative: create the static site manually (no Blueprint)

New → Static Site → connect repo, then set:
- **Build command:** `pnpm install --frozen-lockfile && pnpm build`
- **Publish directory:** `dist`
- **Rewrite rule:** Source `/*` → Destination `/index.html` (Action: Rewrite)
- Add the env vars from the table above, plus the security headers from `render.yaml`.

## Backend prerequisites (auth will not work without these)

The app sends the refresh request and API calls with `credentials: "include"`
(cookies). Because the frontend and backend are on **different origins**, the
backend must:

1. **CORS**: allow the frontend origin exactly and allow credentials —
   `Access-Control-Allow-Origin: https://campuscheck-web.onrender.com` (not `*`)
   and `Access-Control-Allow-Credentials: true`.
2. **Cookies**: set the refresh cookie `Secure; SameSite=None` so the browser
   sends it cross-site over HTTPS.
3. Be reachable at `VITE_API_BASE_URL` over HTTPS, and be listed in the frontend
   CSP `connect-src`.

## Verifying a deploy

- Open the site URL; the login screen should render (no console CSP errors).
- Sign in. In DevTools → Network, `POST /auth/refresh` and `GET /me` should hit
  your `VITE_API_BASE_URL` and return 2xx (not blocked by CORS/CSP).
- Deep-link to a route (e.g. `/courses`) and hard-refresh — it should load, not
  404 (confirms the SPA rewrite).

## Local production preview

```sh
pnpm install
pnpm build
pnpm preview   # serves dist/ at http://localhost:4173
```
