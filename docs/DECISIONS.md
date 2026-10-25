# Engineering decisions

- **Toolchain:** Node 20.19+ / 22.12+ and pnpm 10.8.1 (`packageManager` is pinned). pnpm's build-script allowlist contains only `esbuild`, which Vite/Vitest require to install their platform binary and run transforms.
- **Font:** self-hosted, latin-subset Sora 600/700 for headings and DM Sans 400/500/700 for body, via `@fontsource`.
- **API schema:** the draft OpenAPI file is committed as `api/openapi.yaml`; generated TypeScript output is ignored and regenerated with `pnpm run gen:api`.
- **API sync:** `pnpm run sync:api` copies the sibling API contract at `../ATMs/api/openapi.yaml` in this workspace, or the path supplied by `API_SPEC_PATH`, then generates types. The script builds the default path using `node:path` so Windows backslashes are not parsed as JavaScript string escapes.
- **Theme:** a small CSS variable token system is used with Tailwind v4; no component-library runtime was added. UI controls follow a compact, native-accessible component style.
- **Device identity:** `device_hash` is a stable random browser UUID in local storage with in-memory fallback. It is a weak anti-abuse signal, never proof of identity or a security boundary.
- **Mocks:** the first implementation uses deterministic local sample data and explicit development-only scenario controls. Production requests use the typed API client; no student data is included.
- **PWA:** a service worker is deferred as requested. A later PWA phase should cache only the static shell; attendance mutations, tokens, codes and location must never be queued or persisted.
