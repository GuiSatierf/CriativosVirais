import { z } from "zod";
import { handle, apiTenant, HttpError } from "@/lib/http";
import { getBatch } from "@/lib/batches";
import { exportBatch } from "@/lib/export";
export function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { tenantId } = await apiTenant(request);
    const id = z.uuid().parse((await context.params).id);
    const batch = await getBatch(tenantId, id);
    if (!batch) throw new HttpError(404, "Leva não encontrada.");
    return new Response(new Uint8Array(await exportBatch(batch)), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="leva-${batch.roundNumber}.docx"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
