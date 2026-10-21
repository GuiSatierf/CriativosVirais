import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AccessPanel } from "@/components/admin/access-panel";
import { adminGate, listAccess } from "@/lib/admin";

export default async function AdminPage() {
  const gate = await adminGate(await headers());
  if (gate.status === "not-admin") notFound();
  // No client data is shown before the admin has turned on two-factor.
  if (gate.status === "needs-two-factor") redirect("/admin/seguranca");
  const access = await listAccess();
  return (
    <AccessPanel
      access={access.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))}
      actorId={gate.actor.id}
    />
  );
}
