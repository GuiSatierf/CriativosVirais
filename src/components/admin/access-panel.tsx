"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { Plus, Search } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, toastError } from "@/lib/client";
import { cn } from "@/lib/utils";
import { BlockDialog, GrantDialog, RemoveDialog } from "./access-dialogs";

export type AccessRow = {
  id: string;
  email: string;
  source: "manual" | "hotmart";
  note: string | null;
  createdAt: string;
  grantedBy: string | null;
  userId: string | null;
  banReason: string | null;
  status: "waiting" | "active" | "blocked";
};
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
const doneSchema = z.object({}).passthrough();

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
      {row.status === "blocked" && row.banReason != null && (
        <span className="block text-xs text-muted-foreground">Motivo: {row.banReason}</span>
      )}
    </span>
  );
}

/** Admin list of who may create an account, with block, unblock and remove. */
export function AccessPanel({ access, actorId }: { access: AccessRow[]; actorId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [granting, setGranting] = useState(false);
  const [blocking, setBlocking] = useState<AccessRow | null>(null);
  const [removing, setRemoving] = useState<AccessRow | null>(null);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return access.filter((row) => (filter === "all" || row.status === filter) && row.email.includes(term));
  }, [access, query, filter]);

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

  function action(row: AccessRow) {
    if (row.status === "waiting")
      return <Button variant="ghost" size="sm" onClick={() => setRemoving(row)}>Remover</Button>;
    if (row.status === "blocked")
      return <Button variant="ghost" size="sm" onClick={() => unblock(row)}>Desbloquear</Button>;
    if (row.userId === actorId) return null;
    return (
      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setBlocking(row)}>
        Bloquear
      </Button>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="page-title">Painel de admin</h1>
          <p className="text-sm text-muted-foreground">Quem pode criar conta e usar o Criativos Virais.</p>
        </div>
        <Button onClick={() => setGranting(true)}>
          <Plus aria-hidden />
          Liberar e-mail
        </Button>
      </div>

      <Tabs value="acessos">
        <TabsList variant="line" className="w-full justify-start gap-6 overflow-x-auto rounded-none border-b p-0 group-data-horizontal/tabs:h-10">
          <TabsTrigger value="acessos" className="h-full flex-none rounded-none border-0 px-0.5 after:bottom-[-1px]!">
            Acessos
          </TabsTrigger>
          <TabsTrigger value="contas" disabled className="h-full flex-none rounded-none border-0 px-0.5">
            Contas <span className="hidden text-xs sm:inline">· em breve</span>
          </TabsTrigger>
          <TabsTrigger value="falhas" disabled className="h-full flex-none rounded-none border-0 px-0.5">
            Falhas <span className="hidden text-xs sm:inline">· em breve</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

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

      {visible.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          {access.length === 0 ? "Nenhum e-mail liberado ainda. Use “Liberar e-mail”." : "Nenhum e-mail encontrado com esse filtro."}
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
                {visible.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.email}</TableCell>
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
            {visible.map((row) => (
              <li key={row.id} className="space-y-2 rounded-xl border bg-card p-4">
                <p className="truncate font-medium">{row.email}</p>
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
      <p className="text-xs text-muted-foreground">Toda ação aqui fica registrada com quem fez e quando.</p>

      <GrantDialog open={granting} onOpenChange={setGranting} />
      <BlockDialog row={blocking} onClose={() => setBlocking(null)} />
      <RemoveDialog row={removing} onClose={() => setRemoving(null)} />
    </div>
  );
}
