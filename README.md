# Campus Attendance

A mobile-first campus attendance web app built with React, TypeScript, Vite and pnpm.

## Requirements

- Node.js 20.19+ (or 22.12+)
- pnpm 10.8.1

```sh
pnpm install
pnpm dev
```

Copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL`, `VITE_APP_NAME`, `VITE_USE_MOCKS=false`, and `VITE_INSTITUTION_ID` to the institution UUID used by the backend. The institution ID is an identifier, not a secret; never put credentials or tokens in browser environment variables. `pnpm dev:mock` starts the local demonstration experience.

## Commands

`pnpm run lint`, `pnpm run typecheck`, `pnpm test`, `pnpm run test:coverage`, `pnpm run build`, `pnpm run gen:api`.

The backend publishes its OpenAPI document in a sibling repository. `pnpm run sync:api` copies `../ATMs/api/openapi.yaml` in this workspace, then regenerates frontend API types. Set `API_SPEC_PATH` to use another source path (relative paths resolve from the current working directory). Generated `src/api/schema.d.ts` is ignored and regenerated; `api/openapi.yaml` is the tracked local copy.

For local development, the backend's `ALLOWED_ORIGIN` must equal the web app origin (`http://localhost:5173`). API requests include credentials so the browser sends the backend-managed httpOnly refresh cookie.

## Deploy

Deploy the static Vite build (`pnpm run build`, output `dist/`) to Vercel or Netlify. `vercel.json` includes SPA fallback and baseline security headers; configure the matching headers and SPA fallback on other hosts. Review the Content-Security-Policy `connect-src` against the deployed API origin, use HTTPS, and set the backend `ALLOWED_ORIGIN` to the deployed app origin. Never loosen the policy to allow arbitrary scripts or origins.

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md), [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md), [docs/DECISIONS.md](./docs/DECISIONS.md), [docs/API_ASSUMPTIONS.md](./docs/API_ASSUMPTIONS.md), [docs/TESTING_GAPS.md](./docs/TESTING_GAPS.md) and [docs/MANUAL_TEST_GUIDE.md](./docs/MANUAL_TEST_GUIDE.md).
