# Verification

## Vercel migration

The template keeps React, Vite, TanStack Router, Hono, strict TypeScript, Tailwind,
shadcn/ui, and the existing API/frontend tests. The API uses Vercel's Node.js Web
Standard `fetch` export, with one Hono app serving every API route. The frontend
build remains a static SPA. No database or authentication provider is installed.

Verified locally on 2026-10-09 using Node.js 24.19.0 and pnpm 12.10.1:

`pnpm install --frozen-lockfile --offline` also passed without changing the
lockfile, confirming the install policy used by CI.

| Check                            | Result                                                                                                                                                                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                     | Passed frontend/server/tooling typechecks, ESLint with zero warnings, formatting, all 16 tests in two files, and the production frontend build.                                                                             |
| `pnpm audit --audit-level=high`  | Passed; no known vulnerabilities found.                                                                                                                                                                                     |
| Development HTTP smoke           | 12 checks passed on `127.0.0.1:5175`: SPA shell and nested fallback, namespace boundary, health GET/HEAD/query string, 405/Allow, and JSON API 404s including trailing slash and nested paths.                              |
| Production-preview HTTP smoke    | The same routing checks plus built JavaScript/CSS assets passed (14 checks on `127.0.0.1:4175`). Static security headers and CSP matched `vercel.json`; API responses retained their stricter CSP and no-store policy.      |
| API errors and frontend behavior | Existing tests now exercise the Vercel fetch entry for API assertions, including safe 400/500 errors and minimal logs. Frontend tests retain the real Hono response integration, safe errors, and not-found views in jsdom. |
| External verification            | No Vercel project was linked, pushed, or deployed. Vercel function packaging/CDN routing, GitHub Actions execution, and real-browser CSP checks remain unverified.                                                          |

The only new application tooling dependency, `@hono/node-server@2.1.4`, has no
install lifecycle script and supports Node.js 20+ and Hono 4/5. Dependency build
permissions remain limited to the existing `esbuild` allowlist. The lockfile
contains no platform-specific dependencies from the previous host.

## Local routing smoke procedure

Use the Node and pnpm versions in `.node-version` and `packageManager`.

1. Run `pnpm install --frozen-lockfile`, `pnpm check`, and
   `pnpm audit --audit-level=high`.
2. Start `pnpm dev --port 5175 --strictPort`. With HTTP requests, verify:
   - `/` and `/nested/client/route` serve the React HTML shell.
   - `/api/health`, including a request with `Accept: text/html`, returns
     `200`, JSON `{"status":"ok"}`, and `Cache-Control: no-store`.
   - `HEAD /api/health` returns `200` with an empty body.
   - `POST /api/health` returns JSON `405` and `Allow: GET, HEAD`.
   - `/api`, `/api/`, and `/api/missing/nested` return JSON `404`, never HTML.
   - `/apiary` receives the SPA shell; only the `/api` namespace is reserved.
3. Stop development and start `pnpm preview --port 4175 --strictPort`.
   Repeat the routing checks. Fetch the generated JavaScript and CSS referenced
   by the shell; verify their content types. Check the static production CSP,
   `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and
   `Permissions-Policy` on the shell, client fallbacks, and assets. API responses
   must retain Hono's `default-src 'none'` CSP and no-store policy.
4. When browser verification is requested, check that the home page renders
   **Application ready** and **API connected**, an unknown client route shows
   the not-found view, and there are no blocked scripts or styles. Frontend
   tests already exercise the loader, Hono response, safe errors, and not-found
   behavior in jsdom; they do not establish real-browser CSP compatibility.

The local preview serves production frontend assets with the actual Hono fetch
handler in Node. It does not reproduce Vercel's function bundle or hosted CDN.

## Platform checks requiring your Vercel project

After linking an authorized project, `pnpm dlx vercel@63.1.0 dev` exercises Vercel
routing locally. `pnpm dlx vercel@63.1.0 pull --environment=production` followed by
`pnpm dlx vercel@63.1.0 build --prod` validates function packaging with the real
project settings. Linking/pulling needs account access; do not commit `.vercel/`
or pulled environment files.

After an authorized deployment, repeat the routing, asset, header, and browser
checks at the HTTPS domain. Confirm that rewrites preserve the incoming API URL
for Hono, including query strings and nested paths. Test application-specific
permissions, secrets, and integration failures once those features exist.

Vercel deployment, project settings, CI execution, custom domains, managed Node
patch versions, hosted headers/routing, and real-browser CSP remain unverified
unless evidence from those environments is recorded. Local tests require no
credentials, and no push or deployment is part of this migration.
