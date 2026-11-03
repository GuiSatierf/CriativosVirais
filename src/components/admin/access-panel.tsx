"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { Plus, Search } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, toastError } from "@/lib/client";
import { can, staffRoleLabel, staffRoles, type StaffRole } from "@/lib/staff";
import { cn } from "@/lib/utils";
import { BlockDialog, GrantDialog, RemoveDialog } from "./access-dialogs";
import { AdminHeading, type AdminNavigation } from "./admin-heading";
import { useServerSearch } from "./use-server-search";

export type AccessRow = {
  id: string;
  email: string;
  source: "manual" | "hotmart";
  note: string | null;
  createdAt: string;
  grantedBy: string | null;
  userId: string | null;
  banReason: string | null;
  teamRole: StaffRole | null;
  status: "waiting" | "active" | "blocked";
};
export type AccessList = { access: AccessRow[]; total: number };
type Filter = "all" | AccessRow["status"];

const statusLabel: Record<AccessRow["status"], string> = {
  waiting: "Aguardando cadastro",
  active: "Conta criada",
  blocked: "Bloqueada",
};
const statusTone: Record<AccessRow["status"], string> = {
  waiting: "text-warning",
  active: "text-success",
  blocked: "text-destructive",
};
const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "Todas as situações" },
  { value: "waiting", label: statusLabel.waiting },
  { value: "active", label: statusLabel.active },
  { value: "blocked", label: statusLabel.blocked },
];
const dayFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" });
const doneSchema = z.object({}).loose();
const accessListSchema = z.object({
  total: z.number(),
  access: z.array(
    z.object({
      id: z.string(),
      email: z.string(),
      source: z.enum(["manual", "hotmart"]),
      note: z.string().nullable(),
      createdAt: z.string(),
      grantedBy: z.string().nullable(),
      userId: z.string().nullable(),
      banReason: z.string().nullable(),
      teamRole: z.enum(staffRoles).nullable(),
      status: z.enum(["waiting", "active", "blocked"]),
    }),
  ),
});

function loadAccess(search: string): Promise<AccessList> {
  return api(`/api/admin/access?${search}`, accessListSchema);
}

/** The request's query string; "" asks for the unfiltered list the server already rendered. */
function accessSearch(query: string, filter: Filter) {
  const params = new URLSearchParams();
  const term = query.trim();
  if (term.length > 0) params.set("q", term);
  if (filter !== "all") params.set("situacao", filter);
  return params.toString();
}

function origin(row: AccessRow) {
  const source = row.source === "hotmart" ? "Hotmart" : "Manual";
  if (row.grantedBy == null) return source;
  return `${source} · ${row.grantedBy}`;
}

function StatusPill({ row }: { row: AccessRow }) {
  return (
    <span className="space-y-1">
      <Badge variant="outline" className={cn("gap-1.5", statusTone[row.status])}>
        <span aria-hidden className="size-1.5 rounded-full bg-current" />
        {statusLabel[row.status]}
      </Badge>
      {row.teamRole != null && <Badge variant="secondary" className="ml-1.5">{staffRoleLabel[row.teamRole]}</Badge>}
      {row.status === "blocked" && row.banReason != null && (
        <span className="block text-xs text-muted-foreground">Motivo: {row.banReason}</span>
      )}
    </span>
  );
}

/** Who may create an account: support frees and removes emails, admins and owners also block and unblock. */
export function AccessPanel({
  list: initial,
  actorId,
  navigation,
}: {
  list: AccessList;
  actorId: string;
  navigation: AdminNavigation;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [granting, setGranting] = useState(false);
  const [blocking, setBlocking] = useState<AccessRow | null>(null);
  const [removing, setRemoving] = useState<AccessRow | null>(null);

  const search = accessSearch(query, filter);
  const { access, total } = useServerSearch(initial, search, loadAccess);

  async function unblock(row: AccessRow) {
    if (row.userId == null) return;
    try {
      await api(`/api/admin/accounts/${row.userId}/block`, doneSchema, {}, "DELETE");
      toast.success("Conta desbloqueada. A pessoa já pode entrar.");
      router.refresh();
    } catch (error) {
      toastError(error);
    }
  }

  // Support frees and removes unused emails; blocking and unblocking stay with admins and owners.
  const canBlock = can(navigation.role, "manage-access");

  function action(row: AccessRow) {
    if (row.status === "waiting")
      return <Button variant="ghost" size="sm" onClick={() => setRemoving(row)}>Remover</Button>;
    if (canBlock === false) return null;
    if (row.status === "blocked")
      return <Button variant="ghost" size="sm" onClick={() => unblock(row)}>Desbloquear</Button>;
    // Team members are not blocked from the panel; the owner removes them in the Equipe tab.
    if (row.userId === actorId || row.teamRole != null) return null;
    return (
      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setBlocking(row)}>
        Bloquear
      </Button>
    );
  }

  return (
    <div className="space-y-5">
      <AdminHeading
        navigation={navigation}
        current="acessos"
        action={
          <Button onClick={() => setGranting(true)}>
            <Plus aria-hidden />
            Liberar e-mail
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2.5">
        <div className="relative w-full sm:w-80">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Buscar por e-mail"
            placeholder="Buscar por e-mail"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filter} items={filters} onValueChange={(value) => setFilter((value ?? "all") as Filter)}>
          <SelectTrigger aria-label="Filtrar por situação" className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {filters.map((item) => (
              <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {access.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          {search.length === 0 ? "Nenhum e-mail liberado ainda. Use “Liberar e-mail”." : "Nenhum e-mail encontrado com esse filtro."}
        </p>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border bg-card sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Liberado em</TableHead>
                  <TableHead className="w-0"><span className="sr-only">Ações</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {access.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium break-all whitespace-normal">{row.email}</TableCell>
                    <TableCell className="text-muted-foreground">{origin(row)}</TableCell>
                    <TableCell><StatusPill row={row} /></TableCell>
                    <TableCell className="tabular-nums">{dayFormat.format(new Date(row.createdAt))}</TableCell>
                    <TableCell className="text-right">{action(row)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="grid gap-2.5 sm:hidden">
            {access.map((row) => (
              <li key={row.id} className="space-y-2 rounded-xl border bg-card p-4">
                <p className="font-medium break-all">{row.email}</p>
                <p className="text-xs text-muted-foreground">{origin(row)} · {dayFormat.format(new Date(row.createdAt))}</p>
                <div className="flex items-center justify-between gap-2">
                  <StatusPill row={row} />
                  {action(row)}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {total > access.length && (
        <p className="text-sm text-muted-foreground">
          Mostrando os {access.length} mais recentes de {total.toLocaleString("pt-BR")}. Busque pelo e-mail para achar os outros.
        </p>
      )}
      <p className="text-xs text-muted-foreground">Toda ação aqui fica registrada com quem fez e quando.</p>

      <GrantDialog open={granting} onOpenChange={setGranting} />
      <BlockDialog row={blocking} onClose={() => setBlocking(null)} />
      <RemoveDialog row={removing} onClose={() => setRemoving(null)} />
    </div>
  );
}
