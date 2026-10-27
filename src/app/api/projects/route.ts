import { z } from "zod";
import { apiTenant, handle, json, readJson } from "@/lib/http";
import { projectNameSchema } from "@/lib/project-name";
import { createProject } from "@/lib/projects";

const createSchema = z.object({ name: projectNameSchema }).strict();

export function POST(request: Request) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    const { name } = await readJson(request, createSchema, 1_000);
    return json(await createProject(tenantId, name), 201);
  });
}
