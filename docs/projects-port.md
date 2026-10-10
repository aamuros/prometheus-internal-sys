# Projects port: Prometheus DX → Internal System

## Scope (behavioral foundation, not a live feature)

This port extracts the first DX Project seam into framework-independent policy and read-model functions, plus a Hono router factory tested in isolation. The authenticated Projects API is **not registered** in `server/app.ts`: the new repository has no production authentication provider, database, or authorization-backed persistence adapter.

This is not a feature-complete Projects migration and must not be exposed as a production API until the missing integrations and tests below exist.

## Source and dependencies audited

| Legacy DX source | Reuse | Coupling / migration |
| --- | --- | --- |
| `shared/contracts/project.ts` | Status vocabulary and input semantics | DX Zod schemas; this slice validates using local functions without adding dependencies. Reassess schema library when more endpoints exist. |
| `server/projects/projects.service.ts` | Project authorization; lifecycle timestamps, derived metrics, creator/lead distinction | NestJS DI, Prisma transaction methods, raw SQL concurrency, notifications and activity recording |
| `server/projects/projects.controller.ts` | Authenticated list/get/create/edit/status HTTP behavior | NestJS guards/decorators replaced by a Hono router with a trusted member resolver |
| `server/projects/projects.service.test.ts` | Behavioral permission, metric, input, and status scenarios | Tests adapted to domain and Hono public interfaces |
| `server/projects/project-workflow.service.ts` | Deferred | Stages, Outcomes, dependency cycles, outcome memberships and ordering are separate features |
| `prisma/schema.prisma` | Reference only | Member, Department, Project, ProjectStatusHistory, ProjectMember, Stage, Outcome, ActivityLog and Notification relational requirements |
| `src/features/projects/ProjectsPage.tsx` | Deferred | Depends on DX auth context, TanStack Query, React Router, styling and a live authenticated API |

References: [DX Projects](https://github.com/Rex-Oliver-Jumawid/Prometheus-DX/tree/main/server/projects), [DX permission matrix](https://github.com/Rex-Oliver-Jumawid/Prometheus-DX/blob/main/.context/authorization.md), [DX metrics](https://github.com/Rex-Oliver-Jumawid/Prometheus-DX/blob/main/.context/derived-metrics.md).

## Preserved policy baseline

- Only ACTIVE, server-verified workspace members may use the Projects routes.
- Project viewing/creation are available to all active members; being creator or Administrator does not make someone a Project Lead or Project editor.
- Only the assigned Project Lead or Project Member with CAN_EDIT may edit details or change status.
- User-settable statuses are PLANNING, IN_PROGRESS, and DONE. The archived state is displayed but cannot be selected as a user status.
- Entering DONE stamps `doneAt`; leaving DONE clears it. Repeating the same status yields UNCHANGED, not a second history event.
- Progress is accepted Outcomes / total Outcomes rounded, with 0 for empty projects and 100 for manually DONE projects.
- The response intentionally hides raw membership and outcome arrays, returning a member-specific read model.

The archived-write behavior is conservative (read-only). DX's complete archive/restore workflow is outside this slice and still needs product confirmation.

## Transactional store seam required before mounting

`ProjectStore` is the only persistence seam. Its production adapter **must** enforce, inside database transactions:

1. Creation validates an ACTIVE lead and existing unique departments and atomically records initial PLANNING history, activity, and the created project. Port notifications separately with durable-after-commit delivery.
2. `change` obtains a row lock (or equivalent serialization), passes the current Project snapshot to the decision function *while locked*, atomically writes changes and history, and returns no mutation for UNCHANGED. Re-check active workspace membership at authorization time as appropriate.
3. Project lookup/list read the authoritative records; no in-memory data source is suitable for production.
4. Auth token verification and member resolution must be server-side, using the authorized Registry and account-deactivation rules.
5. Set sensible request-size limits and add integration tests for stale concurrent writes, denied permissions, invalid lead/departments, and history rollback.

A `ProjectStore` adapter that simply updates a row after the route checks access would be insecure due to a time-of-check/time-of-use race.

## Verification

Behavioral tests: `pnpm test -- tests/projects.test.ts`

Before merging: `pnpm check` and `pnpm audit --audit-level=high`.

The new application's CI must remain green. Run PostgreSQL integration tests, authenticated browser tests, and Vercel runtime checks **before** connecting the router to `server/app.ts`.

There are deliberately **no changes** to existing deployment, authentication, database, frontend routes or CI in this PR.
