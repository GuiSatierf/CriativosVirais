"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { LoaderCircle } from "@/components/icons";
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
import { api } from "@/lib/client";
import type { AccessRow } from "./access-panel";

const doneSchema = z.object({}).loose();
const emailSchema = z.email();
const minimumReason = 3;

/** Shared submit flow: one request, a success toast, a fresh list, or the server's pt-BR error inline. */
export function useAction(onDone: () => void) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(request: () => Promise<unknown>, success: string) {
    setPending(true);
    setError(null);
    try {
      await request();
      toast.success(success);
      onDone();
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível concluir. Tente novamente.");
    } finally {
      setPending(false);
    }
  }
  return { pending, error, setError, run };
}

export function Spinner({ pending }: { pending: boolean }) {
  if (!pending) return null;
  return <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden />;
}

export function GrantDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { pending, error, setError, run } = useAction(() => onOpenChange(false));
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const note = String(form.get("note") ?? "").trim();
    if (!emailSchema.safeParse(email).success) return setError("Informe um e-mail válido.");
    await run(() => api("/api/admin/access", doneSchema, { email, note: note.length > 0 ? note : null }), "Acesso liberado.");
  }
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!pending) { onOpenChange(next); setError(null); } }}>
      <AlertDialogContent>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Liberar acesso</AlertDialogTitle>
            <AlertDialogDescription>A pessoa poderá criar a conta com este e-mail.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="grant-email">E-mail da compra</Label>
            <Input id="grant-email" name="email" type="email" autoComplete="off" required autoFocus disabled={pending} aria-invalid={error ? true : undefined} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="grant-note">Observação <span className="text-muted-foreground">(opcional)</span></Label>
            <Input id="grant-note" name="note" maxLength={200} placeholder="Ex.: compra Hotmart #HP12345" disabled={pending} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <Button type="submit" disabled={pending}><Spinner pending={pending} />Liberar</Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function BlockDialog({ row, onClose }: { row: AccessRow | null; onClose: () => void }) {
  const { pending, error, setError, run } = useAction(onClose);
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (row?.userId == null) return;
    const userId = row.userId;
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    if (reason.length < minimumReason) return setError("Escreva o motivo: a pessoa vai ver esta mensagem.");
    await run(() => api(`/api/admin/accounts/${userId}/block`, doneSchema, { reason }), "Conta bloqueada. A pessoa foi desconectada.");
  }
  return (
    <AlertDialog open={row !== null} onOpenChange={(next) => { if (!pending && !next) { onClose(); setError(null); } }}>
      <AlertDialogContent>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Bloquear {row?.email}?</AlertDialogTitle>
            <AlertDialogDescription>A pessoa sai de todos os aparelhos e não consegue entrar até você desbloquear. Os dados dela continuam guardados.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="block-reason">Motivo</Label>
            <Input id="block-reason" name="reason" maxLength={200} required autoFocus placeholder="Ex.: assinatura cancelada na Hotmart" disabled={pending} aria-describedby="block-reason-hint" aria-invalid={error ? true : undefined} />
            <p id="block-reason-hint" className="text-xs text-muted-foreground">A pessoa vê este motivo quando tentar entrar.</p>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={pending}><Spinner pending={pending} />Bloquear</Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function RemoveDialog({ row, onClose }: { row: AccessRow | null; onClose: () => void }) {
  const { pending, error, setError, run } = useAction(onClose);
  async function remove() {
    if (row == null) return;
    const id = row.id;
    await run(() => api(`/api/admin/access/${id}`, doneSchema, {}, "DELETE"), "Acesso removido.");
  }
  return (
    <AlertDialog open={row !== null} onOpenChange={(next) => { if (!pending && !next) { onClose(); setError(null); } }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover o acesso de {row?.email}?</AlertDialogTitle>
          <AlertDialogDescription>Este e-mail deixa de poder criar conta. Ninguém se cadastrou com ele ainda.</AlertDialogDescription>
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
