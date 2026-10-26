import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AccessPanel } from "@/components/admin/access-panel";
import { AccountsPanel } from "@/components/admin/accounts-panel";
import { TeamPanel } from "@/components/admin/team-panel";
import { adminGate, listAccess, type AdminActor } from "@/lib/admin";
import { listAccounts } from "@/lib/admin-accounts";
import { listTeam } from "@/lib/admin-team";
import { listTeamInvites } from "@/lib/team-invites";
import { adminTabsFor, can, type AdminTab } from "@/lib/staff";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const gate = await adminGate(await headers());
  if (gate.status === "not-admin") notFound();
  // No client data is shown before the team member has turned on two-factor.
  if (gate.status === "needs-two-factor") redirect("/admin/seguranca");
  const tabs = adminTabsFor(gate.actor.role);
  const requested = (await searchParams).aba;
  // A tab the role lacks falls back to the first one it has.
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
  if (tab === "equipe") {
    const [team, invites] = await Promise.all([listTeam(), listTeamInvites()]);
    return (
      <TeamPanel
        team={team}
        invites={invites.map((invite) => ({ ...invite, expiresAt: invite.expiresAt.toISOString() }))}
        actorId={actor.id}
        navigation={navigation}
      />
    );
  }
  const { access, total } = await listAccess("", null, can(actor.role, "manage-access") === false);
  return (
    <AccessPanel
      list={{ access: access.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })), total }}
      actorId={actor.id}
      navigation={navigation}
    />
  );
}
