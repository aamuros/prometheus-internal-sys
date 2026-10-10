---
status: proposed
---

# Neon PostgreSQL and first-party Better Auth for internal applications

For the fresh-start Prometheus Internal System (no DX data migration), **propose** Neon-hosted PostgreSQL with Prisma 7 for application persistence and **self-hosted Better Auth** mounted inside the existing Hono/Vercel function at `/api/auth/*`. Prefer Google OAuth initially, with access to the workspace restricted to authorized, active Members—not everybody with a Google account.

This preserves the existing single-origin React/Hono deployment, keeps session cookies first-party, lets Hono validate sessions and workspace permissions directly, and allows the separate Projects domain logic to remain independent of auth/framework details. Neon Managed Auth was considered because it reduces operation of the authentication service and branches auth state with databases, but it requires a separate managed authentication origin and a different identity-verification integration with the existing Hono app. Supabase was considered for DX compatibility but is less compelling with no legacy accounts or data to migrate.

**Consequences:** Authenticate identity using Better Auth's server APIs, enforce Member status and project-specific permissions in Hono, and manage PostgreSQL schema/migrations through Prisma. The production implementation needs a Neon project, direct migration URL and pooled runtime URL, separate environment secrets (including Google OAuth keys and `BETTER_AUTH_SECRET`), a maintained user-invite/onboarding policy, verified secure cookies/CSRF protections, backup/restore, and an end-to-end deployed sign-in test. Better Auth and Prisma packages and lockfile should be installed and pinned **only in their implementation PR**, not as unused infrastructure.

This is **not an accepted provider decision**: finalize the choice and its runtime integration against [backend decision #8](https://github.com/aamuros/prometheus-internal-sys/issues/8) after the relevant domain/authorization decisions. Do not activate new auth routes or change production infrastructure on the basis of this proposal.
