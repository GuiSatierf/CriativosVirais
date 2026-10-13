import { requireTenant } from "@/lib/tenant";
import { AppSidebar } from "@/components/app-sidebar";
export const dynamic = "force-dynamic";
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await requireTenant();
  return (
    <div className="min-h-svh md:flex">
      <AppSidebar userName={tenant.user.name} />
      <main className="min-w-0 flex-1 p-5 md:p-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
