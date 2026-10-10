# Coding agent instructions

Read [architecture](docs/architecture.md) and [conventions](docs/conventions.md)
before changing application behavior. Read only task-relevant files and make
small, focused changes; avoid unrelated refactoring.

## Architecture and organization

- Keep React 19, Vite, TanStack Router, Hono, strict TypeScript, and Vercel
  Functions. The frontend and API deploy together as one independent application.
- `src/` is browser code, `server/` is server code, and `shared/` contains only
  runtime-independent contracts. Browser and server code must not import each
  other; shared contracts must not import either runtime or external packages.
  `api/` contains only Vercel entry points importing server code.
- Organize business features in `src/features/<feature>/` and
  `server/features/<feature>/`, named for business capabilities. Create only the
  files needed now; frontend and server feature folders need not be paired.
- Each feature exposes a small `index.ts` with explicit exports. All consumers
  outside that feature, including application routes, use that interface.
  Inside a feature, import implementation files directly. Avoid other barrels.
- Keep feature dependencies acyclic and intentional. Features must not import
  application composition (`src/app`, `src/routes`, `server/app.ts`). Shared
  components/utilities must not depend on features. Do not move feature-owned
  logic into shared folders merely to bypass a boundary.
- Frontend routes compose public feature UI. `server/app.ts` mounts public
  feature routers; feature `routes.ts` validates input, enforces access, invokes
  use cases, and maps results to HTTP. Business functions take explicit inputs
  and return values; keep Hono, Request/Response, and HTTP exceptions out of them.
  Pass external dependencies as function parameters when tests need substitution.
- ESLint enforces runtime imports, public feature entry points, composition
  direction, and direct Hono dependencies. Use literal imports with relative
  paths or the browser `@/` alias. Review cycles and public exports manually.
- Use conventional functions and React components, type-only imports, semantic
  HTML, accessible controls, and existing UI tokens. Keep strict checks enabled.
- Do not add a monorepo, plugin/installer system, scaffolding CLI, speculative
  layers, service container, event bus, or Atlas integration. Extract shared code
  only for demonstrated reuse. Authentication and persistence belong in a
  generated application when required.

## Dependencies and security

- Use the Node and pnpm versions in `.node-version` and `packageManager`. Pin
  new packages, commit the lockfile, and inspect required dependency build
  scripts before allowing them. Add dependencies only for a current need.
- Follow the update process in `docs/conventions.md`; retain overrides until
  their upstream cause is fixed and the audit and runtime checks pass.
- Validate untrusted input and enforce authorization on the server. Browser
  validation and TypeScript types do not provide access control.
- `VITE_*` values are public. Keep secrets in ignored `.env.local` locally and
  Vercel/GitHub environment secrets in production. Never expose secrets,
  private request data, or internal exception details in responses or logs.
- Before handling private business information, implement the application
  safeguards in [the production checklist](docs/security.md).

## Verification and workflow

- Add meaningful tests for changed behavior, failures, permissions, and
  regressions. Keep base tests independent of credentials and external services.
- Test business functions directly, and HTTP status/payload/headers through
  Hono `app.request` or the fetch entry point. Tests may import feature internals;
  production consumers may not. Keep tests in `tests/`; do not add another runner.
- Start with the smallest relevant check: `pnpm typecheck`, `pnpm lint`, or
  `pnpm test -- <test-file>`. Before merging, run `pnpm check` and
  `pnpm audit --audit-level=high`; CI uses `pnpm install --frozen-lockfile`.
- Use the runtime/browser smoke procedure in `docs/verification.md` when
  deployment configuration or Vercel integrations change. Do not add E2E
  tooling, start servers, or use browser tools for unrelated changes.
- Do not weaken checks to pass them. Report failures and unverified external
  actions accurately. Do not push, merge, deploy, or change remote settings
  without explicit authorization.
