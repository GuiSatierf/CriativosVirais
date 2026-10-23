"use client";
import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AdminTab, StaffRole } from "@/lib/staff";

export type AdminNavigation = { role: StaffRole; tabs: AdminTab[] };

const tabLabel: Record<AdminTab, string> = { acessos: "Acessos", contas: "Contas", equipe: "Equipe" };
const tabDescription: Record<AdminTab, string> = {
  acessos: "Quem pode criar conta e usar o Criativos Virais.",
  contas: "Encontre o cliente e entre na conta dele para ajudar.",
  equipe: "Quem da equipe usa o painel e o que cada um pode fazer.",
};
const trigger = "h-full flex-none rounded-none border-0 px-0.5";

/** Panel title, the current tab's purpose, its main action and the tabs this role may open. */
export function AdminHeading({
  navigation,
  current,
  action,
}: {
  navigation: AdminNavigation;
  current: AdminTab;
  action?: React.ReactNode;
}) {
  const router = useRouter();
  const isSupport = navigation.role === "support";
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="page-title">{isSupport ? "Painel do suporte" : "Painel de admin"}</h1>
          <p className="text-sm text-muted-foreground">{tabDescription[current]}</p>
        </div>
        {action}
      </div>

      {/* Swipes sideways on narrow screens; the active underline must not add a scrollbar. */}
      <Tabs value={current} onValueChange={(tab) => router.push(`/admin?aba=${tab}`)}>
        <TabsList variant="line" className="w-full justify-start gap-6 overflow-x-auto rounded-none border-b p-0 [scrollbar-width:none] group-data-horizontal/tabs:h-10 [&::-webkit-scrollbar]:hidden">
          {navigation.tabs.map((tab) => (
            <TabsTrigger key={tab} value={tab} className={`${trigger} after:bottom-[-1px]!`}>
              {tabLabel[tab]}
            </TabsTrigger>
          ))}
          {!isSupport && (
            <TabsTrigger value="falhas" disabled className={trigger}>
              Falhas <span className="hidden text-xs sm:inline">· em breve</span>
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>
    </>
  );
}
