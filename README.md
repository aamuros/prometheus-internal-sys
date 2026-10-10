# Web Application Template

A standalone GitHub repository template for business applications. React and Hono ship together in one Vercel project. Each generated repository owns its code, dependencies, infrastructure, and deployment; it has no runtime connection to this template.

The starting application contains one home page, client routing and error handling, and `GET /api/health`. No database, authentication, or business features are installed.

## Stack and requirements

- React 19, Vite, TanStack Router, strict TypeScript
- Hono in a Node.js Vercel Function
- Tailwind CSS 4 and shadcn/ui configuration, tokens, and class utilities
- Vitest, Testing Library, ESLint, Prettier, GitHub Actions
- Node.js 24.19.0 (see `.node-version`) and pnpm 12.10.1 (see `packageManager`)

Direct dependencies are pinned; commit `pnpm-lock.yaml` when updating them. TypeScript 6 is retained because the pinned TypeScript ESLint tooling does not support TypeScript 7 yet. Vercel selects Node.js 24 from `package.json` and manages its runtime patch version.

## Create a project

1. On the template's GitHub page, select **Use this template → Create a new repository**.
2. Clone your new repository and enter its directory:

   ```sh
   git clone <your-new-repository-url>
   cd <your-new-repository>
   ```

3. Install the Node version in `.node-version`. Install pnpm 12.10.1, or, if Corepack is available, run `corepack enable` to expose the pinned package manager.
4. Install and start:

   ```sh
   pnpm install --frozen-lockfile
   pnpm dev
   ```

   Open the local URL printed by Vite (normally `http://127.0.0.1:5173`). The home page should show **Application ready** and **API connected**. `/api/health` returns `{"status":"ok"}`. The frontend and API share one origin, with server reloads and React refresh. No external credentials or environment files are required.

5. Rename the following metadata before deploying:

   | File                  | Update                                   |
   | --------------------- | ---------------------------------------- |
   | `package.json`        | `name` and `description`                 |
   | `index.html`          | page title and description               |
   | `src/routes/root.tsx` | visible application name                 |
   | `README.md`           | project-specific purpose and setup notes |

   Run `pnpm install` after changing package metadata and commit any lockfile changes. Run `pnpm format` after renaming. Configure the new repository's own branch protection, GitHub `production` environment, Vercel project, and optional integrations. Template generation copies files, not account settings. If your default branch is not `main`, update both workflows. Adapt the verification report to your application.

6. Run `pnpm check`, then start adding your application's features.

For a template repository, enable **Settings → General → Template repository** explicitly. Recommended branch protection: require pull requests and the **check** CI status, block force pushes and branch deletion, and require approvals appropriate to your team's access model.

## Commands

| Command                         | Purpose                                                    |
| ------------------------------- | ---------------------------------------------------------- |
| `pnpm dev`                      | Vite frontend and Hono API on one local origin             |
| `pnpm build`                    | Production frontend assets in `dist/`                      |
| `pnpm typecheck`                | Check frontend, server/function, and tooling separately    |
| `pnpm lint`                     | ESLint, including runtime and feature import boundaries    |
| `pnpm format:check`             | Verify formatting                                          |
| `pnpm format`                   | Apply formatting                                           |
| `pnpm test`                     | Run existing frontend and Hono tests plus function tests   |
| `pnpm test:watch`               | Watch unit tests                                           |
| `pnpm check`                    | Typecheck, lint, formatting, tests, and production build   |
| `pnpm preview`                  | Rebuild and serve frontend assets and API locally          |
| `pnpm audit --audit-level=high` | Review dependency vulnerabilities                          |
| `pnpm deploy`                   | Run checks and deploy production through pinned Vercel CLI |

`pnpm preview` needs no credentials. It runs the API in local Node.js and applies the static production headers from `vercel.json`. It does not emulate Vercel's CDN rewrites or function packaging. Unit tests use Node and jsdom and need no external services. Vercel bundles `api/index.ts` and its server imports separately during deployment; `pnpm build` builds the SPA only.

## Structure

```text
src/
  app/            React entry point and router assembly
  routes/         Root layout and home route
  components/     Not-found and error views
  lib/            Browser API access and UI class utility
  styles/         Tailwind and shared design tokens
shared/api.ts     Runtime-independent response contracts
server/app.ts     Hono middleware and routes
api/index.ts      Vercel Web Standard fetch entry point
vercel.json       Build settings, API/SPA routing, static security headers
vite.config.ts    Frontend tooling and local API middleware
tests/            Frontend smoke, API, and function tests
tools/            Local ESLint boundary rule
docs/             Architecture, conventions, and verification
.github/workflows/ CI and manually triggered deployment
```

Create `src/features/<feature>/` or `server/features/<feature>/` when a business feature needs them. Each feature exposes an explicit `index.ts`; outside consumers use that public interface. Mount public server routers from `server/app.ts`, keep HTTP adaptation in feature `routes.ts`, and test business functions directly. ESLint checks runtime boundaries and feature imports. Keep business logic outside `api/`: Vercel treats files there as function entry points. Empty feature directories and unused infrastructure configuration are omitted. See [feature organization](docs/architecture.md#feature-organization) for the dependency rules.

## Environment and security

The base needs no environment variables. `.env.example` explains the boundary:

- `VITE_*` values are public and embedded in the browser bundle. Never use them for secrets.
- Optional local server secrets belong in ignored `.env.local`; Vite's configuration loads them into Node's `process.env`. Server code reads them there, never through browser imports or shared modules. Existing environment values take precedence.
- Configure hosted server secrets in the Vercel project's **Environment Variables**, scoped to Development, Preview, or Production as appropriate. Redeploy after changing them.
- CI deployment credentials belong in GitHub environment secrets, not repository files.

API responses receive Hono's security headers. Static assets and SPA fallbacks receive the headers in `vercel.json`, which exclude API URLs to preserve their stricter CSP. The SPA's production CSP allows same-origin resources and blocks inline scripts/styles; evaluate it when integrating components or external services. Development omits the static production CSP so React refresh and CSS updates work.

**This unauthenticated starter must not store protected client information.** Before handling such information, implement authentication, server-side authorization, input validation, redacted logging, backup/restore procedures, and application-specific security validation. Use the [production security checklist](docs/security.md).

## Deploy to Vercel

Create your own Vercel project with the **Vite** preset and this repository as its root. `vercel.json` builds `dist/`, deploys the Hono entry as a Node.js Function, reserves `/api` and `/api/*` for JSON responses, and provides SPA deep-link fallbacks on the same domain. Database and authentication setup are optional and belong in the generated application.

For an authorized manual deployment:

```sh
pnpm dlx vercel@63.1.0 login
pnpm dlx vercel@63.1.0 link
pnpm deploy
```

To validate Vercel packaging locally after linking, run `pnpm dlx vercel@63.1.0 pull --environment=production`, then `pnpm dlx vercel@63.1.0 build --prod`. This contacts Vercel and requires your account. An optional `pnpm dlx vercel@63.1.0 dev` preview exercises platform routing; the default `pnpm dev` stays account-free.

The included **Deploy** workflow is manually triggered and allows only `main`. Configure a GitHub **production** environment with **Selected branches and tags → main**, and any required reviewers. Add `VERCEL_TOKEN` as an environment secret and `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` as environment variables (IDs are available in the linked project's ignored `.vercel/project.json`). The workflow installs with the frozen lockfile, audits, checks, pulls production configuration, builds Vercel output, and uploads it with `--prebuilt --prod`. CI runs without deployment secrets on pull requests and pushes to `main`.

If you connect Vercel's Git integration, pushes may automatically deploy previews and production independently of this manual workflow. Choose one release policy deliberately; configure Deployment Checks when CI must gate Git deployments. Verify `/`, a nested client URL, `/api/health`, `/api`, and an unknown API URL at the hosted HTTPS domain before relying on the release.

See [architecture](docs/architecture.md), [conventions](docs/conventions.md), [AGENTS.md](AGENTS.md), and the [verification report](docs/verification.md).
