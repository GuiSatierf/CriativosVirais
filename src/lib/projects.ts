import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversations, projects } from "@/db/schema";
import { HttpError } from "./errors";
import { tenantValues, tenantWhere } from "./tenant-scope";

/** Enough for any real account; stops a script from filling the sidebar. */
const maxProjects = 100;

export function listProjects(tenantId: string) {
  return db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(tenantWhere(projects, tenantId))
    .orderBy(asc(projects.createdAt), asc(projects.id));
}

export async function createProject(tenantId: string, name: string) {
  return db.transaction(async (tx) => {
    const [{ total }] = await tx.select({ total: count() }).from(projects).where(tenantWhere(projects, tenantId));
    if (total >= maxProjects) throw new HttpError(409, `Você chegou ao limite de ${maxProjects} projetos. Apague um para criar outro.`);
    const [project] = await tx
      .insert(projects)
      .values(tenantValues(tenantId, { name }))
      .returning({ id: projects.id, name: projects.name });
    return project;
  });
}

export async function renameProject(tenantId: string, projectId: string, name: string) {
  const [row] = await db
    .update(projects)
    .set({ name })
    .where(tenantWhere(projects, tenantId, eq(projects.id, projectId)))
    .returning({ id: projects.id });
  if (row == null) throw new HttpError(404, "Projeto não encontrado.");
}

/** The conversations go back to "Conversas"; nothing inside a project is deleted with it. */
export async function deleteProject(tenantId: string, projectId: string) {
  await db.transaction(async (tx) => {
    await tx
      .update(conversations)
      .set({ projectId: null })
      .where(tenantWhere(conversations, tenantId, eq(conversations.projectId, projectId)));
    const [row] = await tx
      .delete(projects)
      .where(tenantWhere(projects, tenantId, eq(projects.id, projectId)))
      .returning({ id: projects.id });
    if (row == null) throw new HttpError(404, "Projeto não encontrado.");
  });
}

/** Refuses a project from another account before the foreign key turns it into a server error. */
export async function assertOwnProject(tenantId: string, projectId: string) {
  const [row] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(tenantWhere(projects, tenantId, eq(projects.id, projectId)));
  if (row == null) throw new HttpError(404, "Projeto não encontrado.");
}
