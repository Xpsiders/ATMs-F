# Deploying the CampusCheck web app to Vercel

The web app is a **Vite single-page app**. It builds to static files in `dist/`
and Vercel serves them on its edge network. It has no server of its own — it
talks to the ATMs backend API over HTTPS using cookie-based auth.

## What's in the repo for deploys

| File | Purpose |
| --- | --- |
| `vercel.json` | Framework, build/install commands, SPA rewrite, and security headers. |
| `.env.example` | The full list of environment variables, documented. |
| `.node-version` | Pins Node `22.11.0` (Vercel uses the `22.x` line). |

`vercel.json` sets:
- `framework: vite`, `buildCommand: pnpm build`, `outputDirectory: dist`.
  `pnpm build` runs the `prebuild` hook (`gen:api`) first, so the generated API
  types (`src/api/schema.d.ts`, gitignored) are regenerated during the build.
- `installCommand: pnpm install --frozen-lockfile` (pnpm is auto-detected from
  `packageManager` / the lockfile).
- A `/(.*) → /index.html` rewrite so React Router works on deep links / refresh.
- Baseline security headers + a Content-Security-Policy.

## Environment variables

All are **build-time** — Vite inlines `VITE_*` values into the bundle, so
changing one requires a **redeploy**, not just a restart. Set them in the Vercel
dashboard (Project → Settings → Environment Variables) for the Production (and
Preview) environments.

| Variable | Required | Example (prod) | Notes |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | yes | `https://atms-api.example.com` | Backend origin, **no trailing slash**. |
| `VITE_INSTITUTION_ID` | yes | `10000000-0000-4000-8000-000000000001` | Institution UUID for the student claim flow. |
| `VITE_APP_NAME` | no | `CampusCheck` | Display name (defaults in code). |
| `VITE_USE_MOCKS` | no | `false` | Keep `false` in prod. Mocks only run in dev/test builds anyway. |

`API_SPEC_PATH` is local tooling only (the `pnpm sync:api` script) — do not set it on Vercel.

## Deploy process

1. Push this repo (including `vercel.json`) to GitHub/GitLab/Bitbucket.
2. In Vercel: **Add New → Project**, import the repo. Vercel detects the **Vite**
   framework and reads `vercel.json` — leave the build settings as proposed.
3. Add the env vars above (at least `VITE_API_BASE_URL` and `VITE_INSTITUTION_ID`)
   for **Production** (and **Preview** if you want PR previews to reach the API).
4. **Edit the CSP** in `vercel.json`: change `connect-src ... https://your-atms-api.example.com`
   to your real backend origin — it must match `VITE_API_BASE_URL`. Commit & push.
   If you skip this the app loads but the browser blocks every API call.
5. **Deploy.** Vercel runs `pnpm install --frozen-lockfile` then `pnpm build` and
   serves `dist/`. Every push to the production branch redeploys; other branches
   and PRs get preview URLs.

### CLI alternative

```sh
pnpm dlx vercel        # first run links/creates the project (preview deploy)
pnpm dlx vercel --prod # promote to production
```
Set env vars with `vercel env add VITE_API_BASE_URL production` (etc.).

## Backend prerequisites (auth will not work without these)

The app sends the refresh request and API calls with `credentials: "include"`
(cookies). Because the frontend (`*.vercel.app` or your custom domain) and the
backend are on **different origins**, the backend must:

1. **CORS**: allow the frontend origin exactly and allow credentials —
   `Access-Control-Allow-Origin: https://<your-app>.vercel.app` (not `*`) and
   `Access-Control-Allow-Credentials: true`. Add preview origins too if needed.
2. **Cookies**: set the refresh cookie `Secure; SameSite=None` so the browser
   sends it cross-site over HTTPS.
3. Be reachable at `VITE_API_BASE_URL` over HTTPS and listed in the CSP
   `connect-src`.

## Verifying a deploy

- Open the deployment URL; the login screen renders with no console CSP errors.
- Sign in. In DevTools → Network, `POST /auth/refresh` and `GET /me` hit your
  `VITE_API_BASE_URL` and return 2xx (not blocked by CORS/CSP).
- Deep-link to a route (e.g. `/courses`) and hard-refresh — it loads, not a 404
  (confirms the SPA rewrite).

## Local production preview

```sh
pnpm install
pnpm build
pnpm preview   # serves dist/ at http://localhost:4173
```
