import type {
  CreateProject,
  ProjectMutation,
  ProjectSnapshot,
} from './domain.ts';

export type PersistedProjectCreate = CreateProject & {
  createdByMemberId: string;
};

/**
 * Production implementation must use database transactions for create/change.
 *
 * create: verify that the lead is ACTIVE and all departments exist at commit time;
 * persist Project, associations, initial PLANNING history and activity together.
 *
 * change: lock the Project, call decide with the CURRENT snapshot while locked,
 * apply the mutation and append USER status/activity history atomically.
 * UNCHANGED must not write history. Propagate policy failures without writing.
 * A missing project returns null. No automatic role privilege is inferred.
 */
export type ProjectStore = {
  list(): Promise<readonly ProjectSnapshot[]>;
  get(id: string): Promise<ProjectSnapshot | null>;
  create(input: PersistedProjectCreate): Promise<ProjectSnapshot>;
  change(
    id: string,
    decide: (current: ProjectSnapshot) => ProjectMutation,
  ): Promise<ProjectSnapshot | null>;
};
