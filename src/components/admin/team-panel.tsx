"use client";
import { useState } from "react";
import { UserPlus } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { staffRoleLabel } from "@/lib/staff";
import { cn } from "@/lib/utils";
import { AdminHeading, type AdminNavigation } from "./admin-heading";
import { AddMemberDialog, ChangeRoleDialog, NewCodeDialog, RemoveMemberDialog, type TeamRow } from "./team-dialogs";

function TwoFactorPill({ row }: { row: TeamRow }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5", row.twoFactorEnabled ? "text-success" : "text-warning")}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {row.twoFactorEnabled ? "Duas etapas ativa" : "Falta ativar"}
    </Badge>
  );
}

/** Owner-only list of the team, with roles, two-factor status and the actions on each person. */
export function TeamPanel({ team, actorId, navigation }: { team: TeamRow[]; actorId: string; navigation: AdminNavigation }) {
  const [adding, setAdding] = useState(false);
  const [changing, setChanging] = useState<TeamRow | null>(null);
  const [removing, setRemoving] = useState<TeamRow | null>(null);
  const [coding, setCoding] = useState<TeamRow | null>(null);

  function actions(row: TeamRow) {
    if (row.id === actorId) return <span className="text-xs text-muted-foreground">Você</span>;
    return (
      <div className="flex flex-wrap justify-end gap-1 sm:flex-nowrap">
        {!row.twoFactorEnabled && <Button variant="ghost" size="sm" onClick={() => setCoding(row)}>Novo código</Button>}
        <Button variant="ghost" size="sm" onClick={() => setChanging(row)}>Trocar papel</Button>
        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setRemoving(row)}>Remover</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <AdminHeading
        navigation={navigation}
        current="equipe"
        action={
          <Button onClick={() => setAdding(true)}>
            <UserPlus aria-hidden />
            Adicionar à equipe
          </Button>
        }
      />

      <div className="hidden overflow-hidden rounded-xl border bg-card sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pessoa</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Verificação em duas etapas</TableHead>
              <TableHead className="w-0"><span className="sr-only">Ações</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {team.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <p className="font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">{row.email}</p>
                </TableCell>
                <TableCell><Badge variant="secondary">{staffRoleLabel[row.role]}</Badge></TableCell>
                <TableCell><TwoFactorPill row={row} /></TableCell>
                <TableCell className="text-right whitespace-nowrap">{actions(row)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="grid gap-2.5 sm:hidden">
        {team.map((row) => (
          <li key={row.id} className="min-w-0 space-y-2 rounded-xl border bg-card p-4">
            <div className="min-w-0">
              <p className="truncate font-medium">{row.name}</p>
              <p className="truncate text-xs text-muted-foreground">{row.email}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary">{staffRoleLabel[row.role]}</Badge>
              <TwoFactorPill row={row} />
            </div>
            <div className="flex justify-end">{actions(row)}</div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Só o dono vê esta aba. Admin libera e bloqueia clientes e entra na conta deles; suporte só busca o cliente e entra na conta. Todos usam verificação em duas etapas.
      </p>

      <AddMemberDialog open={adding} onOpenChange={setAdding} />
      <ChangeRoleDialog row={changing} onClose={() => setChanging(null)} />
      <RemoveMemberDialog row={removing} onClose={() => setRemoving(null)} />
      <NewCodeDialog row={coding} onClose={() => setCoding(null)} />
    </div>
  );
}
