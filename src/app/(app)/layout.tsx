import { requireTenant } from "@/lib/tenant";
import { getRecentConversations } from "@/lib/onboarding";
import { AppShell } from "@/components/app-shell";
import { avatarUrl } from "@/lib/avatar";
export const dynamic = "force-dynamic";
export default async function AppLayout({
  children,
  panel,
}: {
  children: React.ReactNode;
  /** Intercepted pages (levas, resultados, oferta…) opened over the chat. */
  panel: React.ReactNode;
}) {
  const { tenantId, user } = await requireTenant();
  // The history drawer groups these by date and filters them client-side.
  const conversations = await getRecentConversations(tenantId, 50);
  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        image: avatarUrl(user.id, user.image),
      }}
      conversations={conversations}
      panel={panel}
    >
      {children}
    </AppShell>
  );
}
