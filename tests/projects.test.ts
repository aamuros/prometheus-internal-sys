import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import {
  canEditProject,
  createProjectsRouter,
  decideProjectChange,
  parseCreateProject,
  presentProject,
  projectMetrics,
  type ProjectMember,
  type ProjectSnapshot,
  type ProjectStore,
} from '../server/features/projects/index';

const creatorId = '33333333-3333-4333-8333-333333333333';
const leadId = '44444444-4444-4444-8444-444444444444';
const editorId = '55555555-5555-4555-8555-555555555555';
const projectId = '66666666-6666-4666-8666-666666666666';
const departmentId = '11111111-1111-4111-8111-111111111111';

function project(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    id: projectId,
    name: 'Research platform',
    description: 'Build the platform.',
    createdByMemberId: creatorId,
    leadMemberId: leadId,
    departmentIds: [departmentId],
    status: 'PLANNING',
    members: [{ memberId: editorId, accessLevel: 'CAN_EDIT' }],
    stages: [],
    doneAt: null,
    archivedAt: null,
    createdAt: '2026-09-15T00:00:00.000Z',
    updatedAt: '2026-09-15T00:00:00.000Z',
    ...overrides,
  };
}

function testStore(current = project()) {
  const store: ProjectStore = {
    list: vi.fn(async () => [current]),
    get: vi.fn(async () => current),
    create: vi.fn(async () => current),
    change: vi.fn(async (_id, decide) => {
      const mutation = decide(current);
      if (mutation.kind === 'UNCHANGED') return current;
      return {
        ...current,
        ...mutation.values,
      };
    }),
  };
  return store;
}

function router(
  options: {
    activeMemberId?: string | null;
    status?: ProjectMember['status'];
    store?: ProjectStore;
  } = {},
) {
  const store = options.store ?? testStore();
  const app = new Hono();
  app.route(
    '/api/projects',
    createProjectsRouter({
      store,
      resolveMember: async (token) => {
        if (token !== 'valid-token' || options.activeMemberId === null)
          return null;
        return {
          id: options.activeMemberId ?? creatorId,
          status: options.status ?? 'ACTIVE',
          workspaceRole: 'ADMINISTRATOR' as const,
        };
      },
      now: () => '2026-10-10T00:00:00.000Z',
    }),
  );
  return { app, store };
}

const authenticated = { Authorization: 'Bearer valid-token' };
const jsonHeaders = { ...authenticated, 'Content-Type': 'application/json' };

describe('DX Projects domain port', () => {
  it('derives project metrics from outcomes and active stages', () => {
    expect(
      projectMetrics(
        project({
          stages: [
            {
              id: 'stage-one',
              name: 'Build',
              outcomes: [{ status: 'ACCEPTED' }, { status: 'FOR_REVIEW' }],
            },
            {
              id: 'stage-two',
              name: 'Ship',
              outcomes: [{ status: 'ACCEPTED' }],
            },
          ],
        }),
      ),
    ).toEqual({
      totalOutcomes: 3,
      acceptedOutcomes: 2,
      openOutcomes: 1,
      activeStagesCount: 1,
      activeStages: [{ id: 'stage-one', name: 'Build', openOutcomesCount: 1 }],
      progressPercentage: 67,
    });
    expect(
      projectMetrics(project({ status: 'DONE', stages: [] }))
        .progressPercentage,
    ).toBe(100);
    expect(
      projectMetrics(project({ status: 'PLANNING', stages: [] }))
        .progressPercentage,
    ).toBe(0);
  });

  it('does not give creators or administrators implicit Project Lead authority', () => {
    const current = project();
    expect(canEditProject(current, creatorId)).toBe(false);
    expect(canEditProject(current, leadId)).toBe(true);
    expect(canEditProject(current, editorId)).toBe(true);
    expect(
      canEditProject(
        project({ members: [{ memberId: editorId, accessLevel: 'CAN_VIEW' }] }),
        editorId,
      ),
    ).toBe(false);
  });

  it('validates and normalizes project creation without duplicate departments', () => {
    const input = {
      name: '  Research  ',
      description: '  Platform  ',
      leadMemberId: leadId,
      departmentIds: [departmentId],
    };
    expect(parseCreateProject(input)).toEqual({
      ...input,
      name: 'Research',
      description: 'Platform',
    });
    expect(() =>
      parseCreateProject({
        ...input,
        departmentIds: [departmentId, departmentId],
      }),
    ).toThrow();
    expect(() =>
      parseCreateProject({ ...input, leadMemberId: 'not-a-uuid' }),
    ).toThrow();
    expect(() => parseCreateProject({ ...input, name: '   ' })).toThrow();
  });

  it('records DONE timestamps, clears them when reopened and skips duplicate transitions', () => {
    const timestamp = '2026-10-10T00:00:00.000Z';
    expect(
      decideProjectChange(
        project(),
        leadId,
        { kind: 'SET_STATUS', status: 'DONE' },
        timestamp,
      ),
    ).toEqual({
      kind: 'UPDATE_STATUS',
      actorMemberId: leadId,
      previousStatus: 'PLANNING',
      values: { status: 'DONE', doneAt: timestamp },
    });
    expect(
      decideProjectChange(
        project({ status: 'DONE', doneAt: timestamp }),
        leadId,
        { kind: 'SET_STATUS', status: 'DONE' },
        timestamp,
      ),
    ).toEqual({ kind: 'UNCHANGED' });
    expect(
      decideProjectChange(
        project({ status: 'DONE', doneAt: timestamp }),
        editorId,
        { kind: 'SET_STATUS', status: 'IN_PROGRESS' },
        timestamp,
      ),
    ).toMatchObject({
      values: { status: 'IN_PROGRESS', doneAt: null },
    });
  });

  it('rejects status writes by unrelated members even if they are administrators', () => {
    expect(() =>
      decideProjectChange(
        project(),
        creatorId,
        { kind: 'SET_STATUS', status: 'DONE' },
        '2026-10-10T00:00:00.000Z',
      ),
    ).toThrow();
  });

  it('requires authentication before querying Projects', async () => {
    const { app, store } = router();
    const response = await app.request('/api/projects');
    expect(response.status).toBe(401);
    expect(store.list).not.toHaveBeenCalled();
  });

  it('denies inactive workspace members', async () => {
    const { app, store } = router({ status: 'DEACTIVATED' });
    const response = await app.request('/api/projects', {
      headers: authenticated,
    });
    expect(response.status).toBe(403);
    expect(store.list).not.toHaveBeenCalled();
  });

  it('allows active authorized members to view all projects, without edit permission from role alone', async () => {
    const { app } = router();
    const response = await app.request('/api/projects', {
      headers: authenticated,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      expect.objectContaining({
        id: projectId,
        canChangeStatus: false,
        isParticipating: false,
      }),
    ]);
  });

  it('validates create input and binds creator to the authenticated member', async () => {
    const { app, store } = router();
    const bad = await app.request('/api/projects', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ name: '' }),
    });
    expect(bad.status).toBe(400);
    expect(store.create).not.toHaveBeenCalled();

    const good = await app.request('/api/projects', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        name: '  New  ',
        description: '  Description ',
        leadMemberId: leadId,
        departmentIds: [departmentId],
      }),
    });
    expect(good.status).toBe(201);
    expect(store.create).toHaveBeenCalledWith({
      name: 'New',
      description: 'Description',
      leadMemberId: leadId,
      departmentIds: [departmentId],
      createdByMemberId: creatorId,
    });
  });

  it('denies status mutation to an unrelated member before persisting', async () => {
    const { app, store } = router();
    const response = await app.request(
      '/api/projects/' + projectId + '/status',
      {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({ status: 'DONE' }),
      },
    );
    expect(response.status).toBe(403);
    expect(store.change).toHaveBeenCalledOnce();
  });

  it('lets the assigned lead transition status through the transactional store seam', async () => {
    const { app } = router({ activeMemberId: leadId });
    const response = await app.request(
      '/api/projects/' + projectId + '/status',
      {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({ status: 'DONE' }),
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'DONE',
      doneAt: '2026-10-10T00:00:00.000Z',
    });
  });

  it('rejects invalid IDs and archived status changes', async () => {
    const { app } = router({
      activeMemberId: leadId,
      store: testStore(project({ status: 'ARCHIVED' })),
    });
    const invalid = await app.request('/api/projects/not-a-uuid/status', {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ status: 'DONE' }),
    });
    expect(invalid.status).toBe(400);
    const archived = await app.request(
      '/api/projects/' + projectId + '/status',
      {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({ status: 'DONE' }),
      },
    );
    expect(archived.status).toBe(403);
  });

  it('advertises archived Projects as read-only even to their lead and editors', () => {
    const archived = project({ status: 'ARCHIVED' });

    expect(presentProject(archived, leadId).canChangeStatus).toBe(false);
    expect(presentProject(archived, editorId).canChangeStatus).toBe(false);
    expect(() =>
      decideProjectChange(
        archived,
        leadId,
        { kind: 'SET_STATUS', status: 'DONE' },
        '2026-10-10T00:00:00.000Z',
      ),
    ).toThrow();
  });
});
