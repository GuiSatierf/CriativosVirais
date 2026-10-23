"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { Copy } from "@/components/icons";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/client";
import { staffRoleLabel, staffRoles, type StaffRole } from "@/lib/staff";
import { Spinner, useAction } from "./access-dialogs";

export type TeamRow = { id: string; name: string; email: string; role: StaffRole; twoFactorEnabled: boolean };

const doneSchema = z.object({}).loose();
const codeSchema = z.object({ code: z.string().nullable() });
const emailSchema = z.email();

const roleHint: Record<StaffRole, string> = {
  support: "busca o cliente e entra na conta dele",
  admin: "também libera e bloqueia clientes",
  owner: "também cuida da equipe",
};
// Least power first, so the safest choice is the default.
const roleOptions = [...staffRoles].reverse().map((role) => ({ value: role, label: `${staffRoleLabel[role]} — ${roleHint[role]}` }));

function RoleSelect({ id, value, onChange, disabled }: { id: string; value: StaffRole; onChange: (role: StaffRole) => void; disabled: boolean }) {
  return (
    <Select value={value} items={roleOptions} onValueChange={(next) => next != null && onChange(next as StaffRole)} disabled={disabled}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {roleOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** The one-time activation code, shown once; the owner passes it privately to the person. */
function CodeNotice({ code }: { code: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Código copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o código e copie.");
    }
  }
  return (
    <div className="grid gap-2 rounded-lg border bg-muted/40 p-4">
      <p className="text-sm">Código de ativação, vale 24 horas:</p>
      <div className="flex items-center gap-2">
        <code className="font-mono text-lg font-semibold tracking-wider select-all">{code}</code>
        <Button type="button" variant="ghost" size="icon-sm" onClick={copy} aria-label="Copiar código"><Copy aria-hidden /></Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Passe só para a pessoa, por um canal privado. Ela entra na conta, abre /admin e ativa a verificação em duas etapas com a senha e este código. Ele não aparece de novo.
      </p>
    </div>
  );
}

export function AddMemberDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [role, setRole] = useState<StaffRole>("support");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  function close() {
    onOpenChange(false);
    setRole("support");
    setError(null);
    setCode(null);
    setAdded(false);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!emailSchema.safeParse(email).success) return setError("Informe um e-mail válido.");
    setPending(true);
    setError(null);
    try {
      const result = await api("/api/admin/team", codeSchema, { email, role });
      toast.success(`${email} agora é ${staffRoleLabel[role]}.`);
      router.refresh();
      if (result.code == null) return close();
      setCode(result.code);
      setAdded(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível adicionar. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!pending && !next) close(); }}>
      <AlertDialogContent>
        {added && code != null ? (
          <div className="grid gap-4">
            <AlertDialogHeader>
              <AlertDialogTitle>Pessoa adicionada à equipe</AlertDialogTitle>
              <AlertDialogDescription>Falta ela ativar a verificação em duas etapas no primeiro acesso ao painel.</AlertDialogDescription>
            </AlertDialogHeader>
            <CodeNotice code={code} />
            <AlertDialogFooter>
              <Button onClick={close}>Pronto</Button>
            </AlertDialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="grid gap-4">
            <AlertDialogHeader>
              <AlertDialogTitle>Adicionar à equipe</AlertDialogTitle>
              <AlertDialogDescription>
                A pessoa precisa ter criado a conta antes. No primeiro acesso ao painel, ela ativa a verificação em duas etapas com o código que aparece aqui.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="member-email">E-mail</Label>
              <Input id="member-email" name="email" type="email" autoComplete="off" required autoFocus disabled={pending} aria-invalid={error ? true : undefined} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="member-role">Papel</Label>
              <RoleSelect id="member-role" value={role} onChange={setRole} disabled={pending} />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
              <Button type="submit" disabled={pending}><Spinner pending={pending} />Adicionar</Button>
            </AlertDialogFooter>
          </form>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ChangeRoleDialog({ row, onClose }: { row: TeamRow | null; onClose: () => void }) {
  const [role, setRole] = useState<StaffRole | null>(null);
  const { pending, error, setError, run } = useAction(() => { onClose(); setRole(null); });
  const selected = role ?? row?.role ?? "support";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (row == null) return;
    const id = row.id;
    await run(() => api(`/api/admin/team/${id}`, doneSchema, { role: selected }, "PATCH"), `Papel trocado para ${staffRoleLabel[selected]}.`);
  }
  return (
    <AlertDialog open={row !== null} onOpenChange={(next) => { if (!pending && !next) { onClose(); setRole(null); setError(null); } }}>
      <AlertDialogContent>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Trocar o papel de {row?.name}</AlertDialogTitle>
            <AlertDialogDescription>Vale na próxima página que a pessoa abrir.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="change-role">Papel</Label>
            <RoleSelect id="change-role" value={selected} onChange={setRole} disabled={pending} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <Button type="submit" disabled={pending}><Spinner pending={pending} />Salvar</Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function RemoveMemberDialog({ row, onClose }: { row: TeamRow | null; onClose: () => void }) {
  const { pending, error, setError, run } = useAction(onClose);
  async function remove() {
    if (row == null) return;
    const id = row.id;
    await run(() => api(`/api/admin/team/${id}`, doneSchema, {}, "DELETE"), "Pessoa removida da equipe.");
  }
  return (
    <AlertDialog open={row !== null} onOpenChange={(next) => { if (!pending && !next) { onClose(); setError(null); } }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover {row?.name} da equipe?</AlertDialogTitle>
          <AlertDialogDescription>A pessoa sai de todos os aparelhos e perde o acesso ao painel. A conta dela continua existindo.</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <Button variant="destructive" onClick={remove} disabled={pending}><Spinner pending={pending} />Remover</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function NewCodeDialog({ row, onClose }: { row: TeamRow | null; onClose: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  function close() {
    onClose();
    setError(null);
    setCode(null);
  }

  async function issue() {
    if (row == null) return;
    setPending(true);
    setError(null);
    try {
      const result = await api(`/api/admin/team/${row.id}/code`, codeSchema, {});
      setCode(result.code);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível gerar o código. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={row !== null} onOpenChange={(next) => { if (!pending && !next) close(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Novo código de ativação para {row?.name}</AlertDialogTitle>
          <AlertDialogDescription>O código anterior deixa de valer.</AlertDialogDescription>
        </AlertDialogHeader>
        {code != null && <CodeNotice code={code} />}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          {code == null ? (
            <>
              <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
              <Button onClick={issue} disabled={pending}><Spinner pending={pending} />Gerar código</Button>
            </>
          ) : (
            <Button onClick={close}>Pronto</Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
