# Conventions

## Names and ownership

Use kebab-case file names, PascalCase React components and types, and camelCase functions and variables. Name features for business capabilities rather than generic architectural layers. Keep related functionality together. A feature's `index.ts` is its explicit public interface: outside consumers import it; internal files import each other directly. Avoid other barrels and wildcard public re-exports. See [feature organization](architecture.md#feature-organization) for ownership and dependency rules.

`src/` owns browser behavior, `server/` owns server behavior, and `shared/` owns small environment-independent contracts. Browser and server code must not import each other. Shared contracts depend only on other shared contracts, with no external packages. The `@/` alias always refers to `src/`; shared contracts use an explicit relative import. Use literal import paths so lint can check boundaries. Shared components and utilities must not import features.

## TypeScript and API patterns

Keep strict checks enabled. Use `unknown` for external data and narrow or validate it; avoid unchecked `as` casts, `any`, and non-null assertions. Prefer functions and explicit types at public boundaries. Use `import type` for type-only dependencies. Library declarations use `skipLibCheck`; application code remains fully checked in separate frontend, server, and tooling passes.

Use resource-oriented `/api/<resource>` URLs and normal HTTP verbs. Keep handlers in feature `routes.ts`: validate input, enforce access, call business functions, and map results to JSON with accurate status codes. Business functions must not accept Hono contexts or Request/Response objects, return HTTP responses, or throw `HTTPException`. Use explicit inputs and return values or domain errors; translate them in routes. Successful response shapes may be resource-specific; errors use `{ error: string }`. Never include secrets, raw provider errors, or stack traces in responses. Throw `HTTPException` only in the HTTP layer with an intentional status; its message is not exposed by the global handler. Add explicit method handling where a route needs a 405 response and `Allow` header.

Validate request data on the server and enforce authorization there when access control is added. Do not rely on frontend validation or shared TypeScript types for security. No global CORS middleware is needed for same-origin requests.

## Errors, UI, and logging

Use the root router boundary for unexpected route loading and rendering errors. Keep expected business errors near the interaction, with accessible messages. Use semantic HTML, visible keyboard focus, and named controls. Reuse semantic Tailwind tokens rather than hardcoding arbitrary colors. Add shadcn components individually when needed, for example `pnpm dlx shadcn@4.21.4 add button`; review the resulting source and dependencies, pin any added packages, and test the production CSP. A component that uses inline styles may need a deliberate CSP adjustment.

Request logs are intentionally minimal. Never log credentials, authorization headers, full bodies, sensitive query strings, or exception messages by default. When diagnostics are required, define what may be recorded and its retention. Avoid exception details in user-facing error views.

## Testing and verification

Run the smallest relevant check while working, then `pnpm check` before merging or deploying. Add tests for meaningful business behavior, failure paths, permissions, and regressions. Keep tests in `tests/`; they may import feature internals. Test business functions directly with explicit inputs and substituted external dependencies where needed. Prefer accessible queries in frontend tests; API tests should assert status, payload, and relevant headers through Hono or the fetch entry point. Keep the base tests independent of databases and external accounts. `tests/architecture.test.ts` verifies boundary enforcement against the actual ESLint configuration without adding example features.

Vitest uses Node for Hono and jsdom for frontend tests. These verify handlers and React behavior, not Vercel CDN routing. After changing deployment configuration or adding runtime-specific integrations, run `pnpm preview` and check the complete flow in the local Node.js runtime. Browser/E2E tooling is optional and should be added when real workflows justify it.

## Dependencies and changes

Use the pinned pnpm version and commit the lockfile. CI installs with `--frozen-lockfile`. pnpm settings live in `pnpm-workspace.yaml` even though this repository contains only one application. Exact versions, strict peer checks, and the small explicit dependency-build allowlist make installation predictable. Do not approve additional dependency build scripts without inspecting why they are required.

Add a library only for a current requirement. Read its official documentation, check Node.js/Vercel compatibility and peer requirements, and pin the tested version. Use `pnpm audit` when adding or updating dependencies. CI fails on high or critical advisories. No dependency overrides are currently needed. The obsolete `sharp` override was removed with the tooling that required it.

When upgrading Node, TypeScript, Vite, Vercel tooling, or test infrastructure, run all checks and local preview from a clean install. In particular, do not upgrade TypeScript beyond the range supported by TypeScript ESLint. Verify runtime changes against Vercel’s supported Node.js major version. Keep business features separate from foundation changes, avoid opportunistic refactoring, and document decisions only when their rationale will help future maintainers.

## Dependency update process

- Review updates monthly; investigate high/critical security advisories promptly
  and resolve them before release. Use `pnpm outdated` and
  `pnpm audit --audit-level=high` to identify specific work.
- Update a small related set on a dedicated branch with
  `pnpm add --save-exact <package>@<version>` (add `-D` for development tooling).
  Review changelogs, peer requirements, Node.js compatibility, lockfile changes,
  and any new build scripts. Avoid blanket upgrades.
- Check whether an override's parent dependency now accepts a patched version.
  Remove an obsolete override, regenerate the lockfile, and audit again.
- Run a frozen clean install, `pnpm check`, and the audit. For runtime or build
  tooling updates, also run the local preview smoke procedure in
  [verification](verification.md). Commit package metadata and the lockfile
  together and review the CI result before merging.
- Review pinned GitHub Action SHAs during the same maintenance window. Pin
  reviewed replacements to full commit SHAs and verify their CI run. No automatic
  dependency-update service is required for the base template.
