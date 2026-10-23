import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { AdminSignOut } from "@/components/admin/admin-sign-out";
import { adminGate } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Criativos Virais", robots: { index: false, follow: false } };

/** Team-only area, outside the chat. Anyone but an admin gets the same 404 as a missing page. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const gate = await adminGate(await headers());
  if (gate.status === "not-admin") notFound();
  return (
    <div className="min-h-dvh bg-background">
      <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Brand className="h-5 sm:h-6" />
          <Badge variant="outline">Admin</Badge>
        </div>
        <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <span className="hidden truncate sm:inline">{gate.actor.name}</span>
          <AdminSignOut />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 pt-2 pb-10 sm:px-6">{children}</main>
    </div>
  );
}
