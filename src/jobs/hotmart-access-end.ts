import { z } from "zod";
import { endCancelledSubscription } from "@/lib/hotmart-blocks";

// Sent by the Hotmart webhook with startAfter set to the subscription's last paid day.
const jobSchema = z.object({
  email: z.email().max(254),
  subscription: z.string().min(1).max(100),
  cancelledAt: z.iso.datetime(),
});

export async function endHotmartAccess(data: unknown) {
  const job = jobSchema.parse(data);
  await endCancelledSubscription({ ...job, cancelledAt: new Date(job.cancelledAt) });
}
