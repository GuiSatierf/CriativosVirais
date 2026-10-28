"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Ellipsis, KeyRound, LogIn, Pencil, Search } from "@/components/icons";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import { Spinner } from "./access-dialogs";
import { ChangeEmailDialog, SetPasswordDialog } from "./account-dialogs";
import { AdminHeading, type AdminNavigation } from "./admin-heading";
import { useServerSearch } from "./use-server-search";

export type AccountRow = { id: string; name: string; email: string; blocked: boolean; lastAccess: string | null };

const accountsSchema = z.object({
  accounts: z.array(
    z.object({ id: z.string(), name: z.string(), email: z.string(), blocked: z.boolean(), lastAccess: z.string().nullable() }),
  ),
});
const doneSchema = z.object({}).loose();
const minimumReason = 3;
const zone = "America/Sao_Paulo";
const timeFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: zone, hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: zone });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: zone });

/** "hoje, 14:02", "ontem, 19:40" or the date. */
function formatLastAccess(value: string | null) {
  // Sessions are deleted on sign-out, so no open session does not mean never signed in.
  if (value == null) return "Sem sessão aberta";
  const date = new Date(value);
  const day = dayKey.format(date);
  if (day === dayKey.format(new Date())) return `hoje, ${timeFormat.format(date)}`;
  if (day === dayKey.format(new Date(Date.now() - 86_400_000))) return `ontem, ${timeFormat.format(date)}`;
  return dayFormat.format(date);
}

function StatusPill({ row }: { row: AccountRow }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5", row.blocked ? "text-destructive" : "text-success")}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {row.blocked ? "Bloqueada" : "Ativa"}
    </Badge>
  );
}

async function loadAccounts(search: string) {
  const result = await api(`/api/admin/accounts?${search}`, accountsSchema);
  return result.accounts;
}

function useAccountSearch(initial: AccountRow[]) {
  const [query, setQuery] = useState("");
  const term = query.trim();
  const search = term.length === 0 ? "" : new URLSearchParams({ q: term }).toString();
  const accounts = useServerSearch(initial, search, loadAccounts);
  return { query, setQuery, accounts };
}

function EnterDialog({ row, onClose }: { row: AccountRow | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (row == null) return;
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    if (reason.length < minimumReason) return setError("Escreva o motivo do acesso.");
    setPending(true);
    setError(null);
    try {
      await api(`/api/admin/accounts/${row.id}/enter`, doneSchema, { reason });
      // The refresh makes every server component read the client's session.
      router.replace("/chat");
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível entrar. Tente novamente.");
      setPending(false);
    }
  }

  return (
    <AlertDialog open={row !== null} onOpenChange={(next) => { if (!pending && !next) { onClose(); setError(null); } }}>
      <AlertDialogContent>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Entrar na conta de {row?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Você vai ver e usar o Criativos Virais como esta pessoa, por até 1 hora. Trocar a senha e excluir a conta ficam bloqueados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="enter-reason">Motivo do acesso</Label>
            <Textarea
              id="enter-reason"
              name="reason"
              maxLength={200}
              required
              autoFocus
              rows={3}
              placeholder="Ex.: pediu ajuda para importar a planilha do Gerenciador"
              disabled={pending}
              aria-describedby="enter-reason-hint"
              aria-invalid={error ? true : undefined}
            />
            <p id="enter-reason-hint" className="text-xs text-muted-foreground">Fica no registro, junto com o seu nome e o horário.</p>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <Button type="submit" disabled={pending}><Spinner pending={pending} />Entrar na conta</Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Client accounts the team may open to help, without the client's password. */
export function AccountsPanel({ accounts: initial, navigation }: { accounts: AccountRow[]; navigation: AdminNavigation }) {
  const { query, setQuery, accounts } = useAccountSearch(initial);
  const [entering, setEntering] = useState<AccountRow | null>(null);
  const [changingEmail, setChangingEmail] = useState<AccountRow | null>(null);
  const [settingPassword, setSettingPassword] = useState<AccountRow | null>(null);

  function enterButton(row: AccountRow) {
    if (row.blocked) return <span className="text-xs text-muted-foreground">Desbloqueie para entrar</span>;
    return (
      <Button variant="ghost" size="sm" onClick={() => setEntering(row)}>
        <LogIn aria-hidden />
        Entrar como cliente
      </Button>
    );
  }

  function actions(row: AccountRow) {
    return (
      <div className="flex items-center justify-end gap-1">
        {enterButton(row)}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Mais ações para ${row.name}`} />}>
            <Ellipsis aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setChangingEmail(row)}>
              <Pencil aria-hidden />
              Trocar e-mail
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSettingPassword(row)}>
              <KeyRound aria-hidden />
              Definir senha nova
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <AdminHeading navigation={navigation} current="contas" />

      <div className="relative w-full sm:w-80">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Buscar por nome ou e-mail"
          placeholder="Buscar por nome ou e-mail"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-9"
        />
      </div>

      {accounts.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          {query.trim().length === 0 ? "Nenhum cliente criou conta ainda." : "Nenhum cliente encontrado com essa busca."}
        </p>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border bg-card sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Último acesso</TableHead>
                  <TableHead className="w-0"><span className="sr-only">Ações</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-normal">
                      <p className="font-medium">{row.name}</p>
                      <p className="text-xs break-all text-muted-foreground">{row.email}</p>
                    </TableCell>
                    <TableCell><StatusPill row={row} /></TableCell>
                    <TableCell className="tabular-nums">{formatLastAccess(row.lastAccess)}</TableCell>
                    <TableCell className="text-right">{actions(row)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="grid gap-2.5 sm:hidden">
            {accounts.map((row) => (
              <li key={row.id} className="min-w-0 space-y-2 rounded-xl border bg-card p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.name}</p>
                  <p className="text-xs break-all text-muted-foreground">{row.email}</p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusPill row={row} />
                  <span className="text-xs text-muted-foreground">Último acesso {formatLastAccess(row.lastAccess)}</span>
                </div>
                <div className="flex justify-end">{actions(row)}</div>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Entrar como cliente abre a conta por até 1 hora, sem senha. Toda entrada, troca de e-mail e senha nova fica registrada com quem fez e quando.
      </p>

      <EnterDialog row={entering} onClose={() => setEntering(null)} />
      <ChangeEmailDialog row={changingEmail} onClose={() => setChangingEmail(null)} />
      <SetPasswordDialog row={settingPassword} onClose={() => setSettingPassword(null)} />
    </div>
  );
}
