import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { TwoFactorSetup } from "@/components/admin/two-factor-setup";
import { adminGate } from "@/lib/admin";

export default async function AdminSecurityPage() {
  const gate = await adminGate(await headers());
  if (gate.status === "not-admin") notFound();
  if (gate.status === "ok") redirect("/admin");
  return <TwoFactorSetup />;
}
