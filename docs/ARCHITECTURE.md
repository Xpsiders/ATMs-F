# Architecture

React and TypeScript are bootstrapped by Vite. `src/app` owns routing, session state, role-aware navigation and shared page chrome. Feature folders own screen state, validation and feature-level API boundaries. `src/shared/lib/apiClient.ts` centralizes credentials, in-memory bearer tokens, refresh coordination, typed API failures and authenticated downloads. `src/api` holds the generated OpenAPI types and centralized error presentation. The mock experience uses deterministic, safe sample records.

The refresh token is exclusively an httpOnly server cookie (`credentials: "include"`); access tokens are memory-only. Check-in sends a per-browser UUID signal and real browser geolocation. Do not interpret frontend route guards or device hashes as authorization: the backend is authoritative.

`pnpm run sync:api` replaces the draft from `../ATMs/api/openapi.yaml` in this workspace (or `API_SPEC_PATH`) and runs the OpenAPI type generator. Relative `API_SPEC_PATH` values resolve from the current working directory. Run typecheck and update `docs/API_ASSUMPTIONS.md` after syncing.
