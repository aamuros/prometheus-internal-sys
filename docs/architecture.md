# Architecture

## One application, one deployment

This is a feature-oriented modular monolith: one React SPA and one Hono API, deployed together as one Vercel project with CDN-hosted Vite assets and one Node.js Vercel Function. A small team can change UI and API behavior in the same pull request without managing independent services or a shared package platform. Each generated repository is independent.

`api/index.ts` exports the Hono app's Web Standard `fetch` handler, supported by Vercel's Node.js runtime. `vercel.json` selects Vite, builds `dist/`, and rewrites `/api` and `/api/*` to this function, preserving the original request URL for Hono. The SPA fallback explicitly excludes the API namespace; missing API routes return JSON 404 responses even on direct browser navigation. Existing static files are served by the CDN before the SPA fallback.

`pnpm dev` and `pnpm preview` attach the same fetch handler to Vite using Hono's Node request adapter. Development reloads the server module through Vite; preview serves built frontend assets with production static headers. This local middleware is development tooling, not part of the frontend bundle or a second deployed service. Local HTTP checks do not emulate Vercel's CDN or function packaging. Use `pnpm dlx vercel@63.1.0 dev` for an optional platform preview after linking your own Vercel project.

## Frontend/backend boundary

`src/` runs in the browser; `server/` runs on the server. Separate TypeScript configurations keep browser globals and Node.js runtime globals distinct. ESLint rejects imports in both directions, including type-only imports, and keeps Node.js modules out of browser code. `api/` is only the Vercel entry layer: it may import server code; server modules must not import it. Application code must not import tests or tooling.

`shared/` contains runtime-independent request/response contracts, grouped by feature when needed. It may depend only on other shared files, with no external packages, UI, business implementation, credentials, or server configuration. Consumers use type-only imports for types. Do not share server domain models automatically: publish only the data needed across the HTTP boundary.

The health request uses same-origin `fetch` and checks the small response shape at runtime. TypeScript contracts do not validate untrusted input. A Hono RPC client or schema validation can be added when a larger API warrants it; the base does not need either abstraction. No CORS policy is needed for this same-origin application; do not add permissive CORS by default.

## Routing and UI

TanStack Router uses its supported code-based route tree. With two routes, explicit assembly avoids a generator, generated source, and another development dependency. The library recommends file-based routing for larger applications; migrate when route count makes it worthwhile. Route views live under `src/routes/`, and `src/app/router.ts` assembles the tree. The root route owns layout, pending, not-found, and safe error views. Route errors hide internal exception details.

The home loader calls the real health endpoint, demonstrating the integration without adding a client-side cache library. For richer server state, TanStack Query is the approved default, but it is not needed for a single request.

Tailwind 4 uses its Vite plugin and CSS-first `@theme` configuration. `components.json`, semantic CSS tokens, and `cn` provide the shadcn/ui foundation. The supported `new-york` style uses the established `clsx`/`tailwind-merge` utility. Add individual components only as needed, review their installed dependencies and styles, and verify the production CSP. There is no preinstalled component collection, icon pack, animation library, or dark-mode switch.

## Feature organization

Name features for business capabilities, using the same name across runtimes when both exist. A feature owns its UI, API behavior, business rules, and tests. Create `src/features/<feature>/` or `server/features/<feature>/` only when needed; a feature does not require both. Keep related changes within that owner instead of spreading business code across global controller/service/model folders.

| Location                              | Responsibility                                                     |
| ------------------------------------- | ------------------------------------------------------------------ |
| `src/features/<feature>/`             | Feature UI, hooks, and browser API access                          |
| `server/features/<feature>/routes.ts` | Hono router and HTTP adaptation                                    |
| Other server feature files            | Plain business functions and needed external integrations          |
| Feature `index.ts`                    | Small public interface with explicit named/type exports            |
| `shared/<feature>.ts`                 | HTTP contracts, only when both runtimes need them                  |
| `tests/`                              | Direct business tests, API/UI tests, and boundary regression tests |

These are placement rules, not a scaffold. Choose implementation filenames that describe their purpose; do not create empty folders or placeholder services.

### Public interfaces and dependencies

- Every consumer outside a feature imports its `index.ts`, including application routes and other features. Export only intended UI, use cases, types, and the server router needed by composition. Do not expose implementation helpers or wildcard-export the whole feature.
- Inside a feature, import sibling implementation files directly rather than importing its own public index. `index.ts` is the only warranted barrel.
- Cross-feature imports use the other feature's public interface in the same runtime. Keep these dependencies intentional and acyclic; compose multi-feature flows in the caller that owns the business operation. Do not add a generic orchestration framework or event bus.
- Frontend routes compose public feature UI; `server/app.ts` mounts public feature routers at `/api/<resource>`. Features must not import these composition files. Shared components and utilities must not depend on features; promote code only after reuse is demonstrated.

ESLint's local rule in `tools/eslint-boundaries.ts` enforces runtime direction, public entry points, composition direction, and direct Hono imports in business files. It covers imports, re-exports, literal dynamic imports, `require`, and TypeScript import types. Use relative paths or `@/` (browser only); computed module paths are rejected. Tooling and tests can import both runtimes and feature internals. No feature registry, boundary library, or dependency graph service is required. Review dependency cycles, public export selection, and transitive HTTP coupling in code review; lint does not prove their absence.

### HTTP and business logic

Feature `routes.ts` parses and validates input, enforces authorization when needed, invokes business functions, and translates results/errors into HTTP. Business functions accept explicit values and return values or domain errors. They must not use Hono contexts, Request/Response objects, status codes, or `HTTPException`. Keep Hono imports in `routes.ts` and the public `index.ts`. Pass external dependencies as function parameters when substitution is needed for tests; do not introduce a service container or interface for every function.

Test business rules directly, without constructing HTTP requests. Test validation, authorization, error mapping, status codes, and response headers through Hono `app.request` or the fetch entry point. Keep the existing Vitest Node/jsdom setup and credential-free base tests. The health endpoint is a trivial platform route, so it stays in `server/app.ts`; extracting a health service would add indirection without independent behavior. Add persistence adapters only for a real persistence requirement.

## API and security defaults

Hono returns JSON, a minimal uncached health response, 404 for unknown routes, 405 for unsupported health methods, and safe error envelopes. `HTTPException` status codes are preserved while their messages are hidden. A generic exception becomes a 500 response. Request logs include only method, status, and duration, avoiding URLs, query strings, headers, bodies, and exception messages that may contain protected information. Add controlled diagnostics and request correlation when needed.

API headers are set in Hono; `vercel.json` covers static responses and client-route fallbacks while excluding `/api` and `/api/*`. Local preview reads those static headers from the same configuration. Explicit API routing preserves Hono's stricter API CSP, uncached responses, and safe error envelopes. Same-origin requests avoid unnecessary CORS middleware. Vercel selects Node.js 24 from `package.json`; it manages runtime patch versions independently of the pinned local version.

## Complexity and future integrations

The runtime already has one app, explicit route assembly, plain functions, and no unused business layers. Keep them. Separate browser/server/tooling typechecks and the local Vite API adapter support real runtime boundaries and same-origin development; they are not separate applications. The public feature index is a deliberate exception to avoiding barrels: it defines ownership without introducing packages or a registry.

Do not add repositories, base services, dependency-injection containers, internal HTTP calls, event buses, schema libraries, or caching layers in anticipation of future features. Add an integration only for a current application requirement, inside the owning server feature when appropriate, and verify its Node.js/Vercel compatibility. Database and authentication infrastructure belong in the generated application when required, not in this template.

Applications handling protected information also need the safeguards in [the production checklist](security.md). These are application-specific requirements, not capabilities supplied by this unauthenticated template.

## Official guidance checked

- [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Node.js Functions and Web Standard fetch exports](https://vercel.com/docs/functions/runtimes/node-js) and [function signatures](https://vercel.com/docs/functions/functions-api-reference)
- [Vercel rewrites and headers](https://vercel.com/docs/project-configuration/vercel-json)
- [Hono on Vercel](https://hono.dev/docs/getting-started/vercel) and [Vercel's Hono guide](https://vercel.com/docs/frameworks/backend/hono)
- [Hono Node.js request adapter](https://hono.dev/docs/getting-started/nodejs)
- [TanStack code-based routing](https://tanstack.com/router/latest/docs/framework/react/routing/code-based-routing)
- [Tailwind with Vite](https://tailwindcss.com/docs/installation/using-vite) and [shadcn Vite setup](https://ui.shadcn.com/docs/installation/vite)
- [Vitest configuration](https://vitest.dev/guide/)

The Hono guide describes a standalone API's zero-configuration preset. This combined SPA/API deliberately uses the Vite preset and an `/api` Web Standard function, avoiding a second project or framework. See the verification report for tested versions and limitations.
