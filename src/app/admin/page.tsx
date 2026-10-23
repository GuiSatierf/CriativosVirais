import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AccessPanel } from "@/components/admin/access-panel";
import { AccountsPanel } from "@/components/admin/accounts-panel";
import { TeamPanel } from "@/components/admin/team-panel";
import { adminGate, listAccess, type AdminActor } from "@/lib/admin";
import { listAccounts } from "@/lib/admin-accounts";
import { listTeam } from "@/lib/admin-team";
import { adminTabsFor, type AdminTab } from "@/lib/staff";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const gate = await adminGate(await headers());
  if (gate.status === "not-admin") notFound();
  // No client data is shown before the team member has turned on two-factor.
  if (gate.status === "needs-two-factor") redirect("/admin/seguranca");
  const tabs = adminTabsFor(gate.actor.role);
  const requested = (await searchParams).aba;
  // Support starts on Contas, the only tab it has; a tab the role lacks falls back to the first.
  const current = tabs.find((tab) => tab === requested) ?? tabs[0];
  return <AdminTabPanel tab={current} actor={gate.actor} navigation={{ role: gate.actor.role, tabs }} />;
}

async function AdminTabPanel({
  tab,
  actor,
  navigation,
}: {
  tab: AdminTab;
  actor: AdminActor;
  navigation: { role: AdminActor["role"]; tabs: AdminTab[] };
}) {
  if (tab === "contas") {
    const accounts = await listAccounts("");
    return (
      <AccountsPanel
        accounts={accounts.map((row) => ({ ...row, lastAccess: row.lastAccess?.toISOString() ?? null }))}
        navigation={navigation}
      />
    );
  }
  if (tab === "equipe") return <TeamPanel team={await listTeam()} actorId={actor.id} navigation={navigation} />;
  const access = await listAccess();
  return (
    <AccessPanel
      access={access.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))}
      actorId={actor.id}
      navigation={navigation}
    />
  );
}
