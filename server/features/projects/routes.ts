import { Hono } from 'hono';
import {
  ProjectRuleError,
  decideProjectChange,
  isProjectId,
  parseCreateProject,
  parseDetails,
  parseStatus,
  presentProject,
  type ProjectMember,
} from './domain.ts';
import type { ProjectStore } from './store.ts';

export type ProjectsDependencies = {
  /** Verify the token and resolve an authorized member from trusted server-side identity. */
  resolveMember(token: string): Promise<ProjectMember | null>;
  store: ProjectStore;
  now(): string;
};

/**
 * Isolated router. Intentionally NOT mounted by server/app.ts until real
 * authentication and a transactional PostgreSQL adapter are implemented.
 */
export function createProjectsRouter(deps: ProjectsDependencies) {
  const router = new Hono<{ Variables: { member: ProjectMember } }>();

  router.onError((error, c) => {
    if (error instanceof ProjectRuleError) {
      return c.json({ error: error.message }, error.statusCode);
    }
    return c.json({ error: 'Internal server error' }, 500);
  });

  router.use('*', async (c, next) => {
    const header = c.req.header('authorization') ?? '';
    const match = /^Bearer ([^\s]+)$/i.exec(header);
    if (!match?.[1]) return c.json({ error: 'Unauthorized' }, 401);
    const member = await deps.resolveMember(match[1]);
    if (!member) return c.json({ error: 'Unauthorized' }, 401);
    if (member.status !== 'ACTIVE')
      return c.json({ error: 'Access denied' }, 403);
    c.set('member', member);
    await next();
  });

  router.get('/', async (c) => {
    const member = c.get('member');
    return c.json(
      (await deps.store.list()).map((item) => presentProject(item, member.id)),
    );
  });

  router.post('/', async (c) => {
    const input = parseCreateProject(await c.req.json().catch(() => null));
    const project = await deps.store.create({
      ...input,
      createdByMemberId: c.get('member').id,
    });
    return c.json(presentProject(project, c.get('member').id), 201);
  });

  router.get('/:projectId', async (c) => {
    const id = c.req.param('projectId');
    if (!isProjectId(id))
      throw new ProjectRuleError('Invalid project ID.', 400);
    const project = await deps.store.get(id);
    if (!project) return c.json({ error: 'Not found' }, 404);
    return c.json(presentProject(project, c.get('member').id));
  });

  router.patch('/:projectId', async (c) => {
    const id = c.req.param('projectId');
    if (!isProjectId(id))
      throw new ProjectRuleError('Invalid project ID.', 400);
    const change = parseDetails(await c.req.json().catch(() => null));
    const updated = await deps.store.change(id, (current) =>
      decideProjectChange(current, c.get('member').id, change, deps.now()),
    );
    if (!updated) return c.json({ error: 'Not found' }, 404);
    return c.json(presentProject(updated, c.get('member').id));
  });

  router.patch('/:projectId/status', async (c) => {
    const id = c.req.param('projectId');
    if (!isProjectId(id))
      throw new ProjectRuleError('Invalid project ID.', 400);
    const change = parseStatus(await c.req.json().catch(() => null));
    const updated = await deps.store.change(id, (current) =>
      decideProjectChange(current, c.get('member').id, change, deps.now()),
    );
    if (!updated) return c.json({ error: 'Not found' }, 404);
    return c.json(presentProject(updated, c.get('member').id));
  });

  return router;
}
