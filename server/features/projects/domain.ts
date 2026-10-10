// Policies and read-model derivations ported from Prometheus-DX Projects.
export type ProjectStatus = 'PLANNING' | 'IN_PROGRESS' | 'DONE' | 'ARCHIVED';
export type ProjectAccess = 'CAN_VIEW' | 'CAN_EDIT';
export type ProjectMember = {
  id: string;
  status: 'INVITED' | 'ACTIVE' | 'DEACTIVATED';
  workspaceRole: 'MEMBER' | 'ADMINISTRATOR';
};

export type ProjectSnapshot = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  createdByMemberId: string;
  leadMemberId: string;
  departmentIds: readonly string[];
  members: readonly { memberId: string; accessLevel: ProjectAccess }[];
  stages: readonly {
    id: string;
    name: string;
    outcomes: readonly { status: string }[];
  }[];
  doneAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateProject = {
  name: string;
  description: string;
  leadMemberId: string;
  departmentIds: string[];
};

export type ProjectCommand =
  | { kind: 'SET_STATUS'; status: Exclude<ProjectStatus, 'ARCHIVED'> }
  | { kind: 'EDIT_DETAILS'; name: string; description: string };

export type ProjectMutation =
  | { kind: 'UNCHANGED' }
  | {
      kind: 'UPDATE_STATUS';
      actorMemberId: string;
      previousStatus: ProjectStatus;
      values: {
        status: Exclude<ProjectStatus, 'ARCHIVED'>;
        doneAt: string | null;
      };
    }
  | {
      kind: 'UPDATE_DETAILS';
      actorMemberId: string;
      values: { name: string; description: string };
    };

export class ProjectRuleError extends Error {
  constructor(
    message: string,
    public readonly kind: 'VALIDATION' | 'FORBIDDEN',
  ) {
    super(message);
    this.name = 'ProjectRuleError';
  }
}

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isProjectId(value: string): boolean {
  return uuid.test(value);
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ProjectRuleError('Invalid project data.', 'VALIDATION');
  }
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown, max: number): string {
  if (typeof value !== 'string')
    throw new ProjectRuleError('Invalid project data.', 'VALIDATION');
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) {
    throw new ProjectRuleError('Invalid project data.', 'VALIDATION');
  }
  return trimmed;
}

export function parseCreateProject(value: unknown): CreateProject {
  const input = record(value);
  const name = nonEmptyString(input.name, 160);
  const description = nonEmptyString(input.description, 4000);
  if (
    typeof input.leadMemberId !== 'string' ||
    !isProjectId(input.leadMemberId)
  ) {
    throw new ProjectRuleError('Choose an active Project Lead.', 'VALIDATION');
  }
  if (
    !Array.isArray(input.departmentIds) ||
    input.departmentIds.length === 0 ||
    !input.departmentIds.every(
      (id) => typeof id === 'string' && isProjectId(id),
    ) ||
    new Set(input.departmentIds).size !== input.departmentIds.length
  ) {
    throw new ProjectRuleError(
      'Choose existing, distinct departments.',
      'VALIDATION',
    );
  }
  return {
    name,
    description,
    leadMemberId: input.leadMemberId,
    departmentIds: [...input.departmentIds] as string[],
  };
}

export function parseDetails(
  value: unknown,
): Extract<ProjectCommand, { kind: 'EDIT_DETAILS' }> {
  const input = record(value);
  return {
    kind: 'EDIT_DETAILS',
    name: nonEmptyString(input.name, 160),
    description: nonEmptyString(input.description, 4000),
  };
}

export function parseStatus(
  value: unknown,
): Extract<ProjectCommand, { kind: 'SET_STATUS' }> {
  const input = record(value);
  if (
    input.status !== 'PLANNING' &&
    input.status !== 'IN_PROGRESS' &&
    input.status !== 'DONE'
  ) {
    throw new ProjectRuleError('Invalid project status.', 'VALIDATION');
  }
  return { kind: 'SET_STATUS', status: input.status };
}

export function canEditProject(
  project: ProjectSnapshot,
  actorMemberId: string,
): boolean {
  return (
    project.leadMemberId === actorMemberId ||
    project.members.some(
      (member) =>
        member.memberId === actorMemberId && member.accessLevel === 'CAN_EDIT',
    )
  );
}

export function projectMetrics(project: ProjectSnapshot) {
  const stages = project.stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    openOutcomesCount: stage.outcomes.filter(
      (outcome) => outcome.status !== 'ACCEPTED',
    ).length,
    total: stage.outcomes.length,
  }));
  const totalOutcomes = stages.reduce((sum, stage) => sum + stage.total, 0);
  const openOutcomes = stages.reduce(
    (sum, stage) => sum + stage.openOutcomesCount,
    0,
  );
  const activeStages = stages
    .filter((stage) => stage.openOutcomesCount > 0)
    .map(({ id, name, openOutcomesCount }) => ({
      id,
      name,
      openOutcomesCount,
    }));
  return {
    totalOutcomes,
    openOutcomes,
    acceptedOutcomes: totalOutcomes - openOutcomes,
    activeStagesCount: activeStages.length,
    activeStages,
    progressPercentage:
      project.status === 'DONE'
        ? 100
        : totalOutcomes === 0
          ? 0
          : Math.round(((totalOutcomes - openOutcomes) / totalOutcomes) * 100),
  };
}

export function presentProject(
  project: ProjectSnapshot,
  currentMemberId: string,
) {
  const access = project.members.find(
    (member) => member.memberId === currentMemberId,
  );
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    createdByMemberId: project.createdByMemberId,
    leadMemberId: project.leadMemberId,
    departmentIds: project.departmentIds,
    isParticipating: Boolean(access),
    currentMemberAccess: access?.accessLevel ?? null,
    canChangeStatus: canEditProject(project, currentMemberId),
    doneAt: project.doneAt,
    archivedAt: project.archivedAt,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    metrics: projectMetrics(project),
  };
}

export function decideProjectChange(
  current: ProjectSnapshot,
  actorMemberId: string,
  command: ProjectCommand,
  now: string,
): ProjectMutation {
  // Evaluate against the latest row inside the persistence transaction.
  if (
    !canEditProject(current, actorMemberId) ||
    current.status === 'ARCHIVED'
  ) {
    throw new ProjectRuleError(
      'Not permitted to modify this Project.',
      'FORBIDDEN',
    );
  }

  if (command.kind === 'EDIT_DETAILS') {
    if (
      current.name === command.name &&
      current.description === command.description
    ) {
      return { kind: 'UNCHANGED' };
    }
    return {
      kind: 'UPDATE_DETAILS',
      actorMemberId,
      values: { name: command.name, description: command.description },
    };
  }
  if (current.status === command.status) return { kind: 'UNCHANGED' };
  return {
    kind: 'UPDATE_STATUS',
    actorMemberId,
    previousStatus: current.status,
    values: {
      status: command.status,
      doneAt:
        command.status === 'DONE'
          ? now
          : current.status === 'DONE'
            ? null
            : current.doneAt,
    },
  };
}
