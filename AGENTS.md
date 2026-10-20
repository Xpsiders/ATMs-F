# Repository guidance

- Read `AGENTS.md`, `docs/HANDOFF.md`, `docs/PROGRESS.md`, `api/openapi.yaml`, and inspect `docs/design-reference/` (when present) before work.
- Work on one task at a time, choosing the first partial or not-started item in `docs/PROGRESS.md` unless the user names another.
- Use pnpm only. Do not use npm or npx.
- Preserve existing behavior during refactors. Keep changes small and aligned with existing patterns.
- Keep the blue/gold theme: gold text is not used on light backgrounds, and every status badge has an icon and text.
- API payload types come only from generated API schema types. Keep API error codes in `src/api/errors.ts`.
- Never persist access tokens or attendance codes, queue or auto-retry mutations, or use `dangerouslySetInnerHTML`.
- After each task run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`; record actual output in `docs/PROGRESS.md`.
- Update progress documentation when implementation status changes. Commit completed work with a clear message; do not push unless requested.
