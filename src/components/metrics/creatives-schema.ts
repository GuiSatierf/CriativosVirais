import { z } from "zod";
import { metricsSchema } from "@/lib/connectors/types";

/** Row limit applied by the creatives query. */
export const creativesLimit = 1000;

export const creativeRowSchema = metricsSchema.extend({
  creative_key: z.string(),
  name: z.string().nullable(),
  campaign_key: z.string().nullable(),
  period_from: z.string().nullable(),
  period_to: z.string().nullable(),
  video_status: z.string().nullable(),
  hidden: z.boolean().default(false),
});
export type CreativeRow = z.infer<typeof creativeRowSchema>;

const rows = z.array(creativeRowSchema);

/**
 * Accepts the plain array response and the `{ rows, truncated }` shape; when
 * the server does not report truncation, a full page implies it.
 */
export const creativesResponseSchema = z
  .union([
    rows,
    z.object({ rows, truncated: z.boolean().optional() }),
    z.object({ items: rows, truncated: z.boolean().optional() }),
  ])
  .transform((data) => {
    const list = Array.isArray(data)
      ? data
      : "rows" in data
        ? data.rows
        : data.items;
    const truncated = Array.isArray(data) ? undefined : data.truncated;
    return {
      rows: list,
      truncated: truncated ?? list.length >= creativesLimit,
    };
  });
export type CreativesResponse = z.infer<typeof creativesResponseSchema>;
