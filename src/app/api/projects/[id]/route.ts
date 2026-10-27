import { z } from "zod";
import { apiTenant, handle, HttpError, json, readJson } from "@/lib/http";
import { projectNameSchema } from "@/lib/project-name";
import { deleteProject, renameProject } from "@/lib/projects";

const renameSchema = z.object({ name: projectNameSchema }).strict();

async function projectId(context: { params: Promise<{ id: string }> }) {
  const id = z.uuid().safeParse((await context.params).id);
  if (!id.success) throw new HttpError(404, "Projeto não encontrado.");
  return id.data;
}

export function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    const id = await projectId(context);
    const { name } = await readJson(request, renameSchema, 1_000);
    await renameProject(tenantId, id, name);
    return json({ saved: true });
  });
}

export function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    await deleteProject(tenantId, await projectId(context));
    return json({ deleted: true });
  });
}
