"use client";
import { z } from "zod";
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
import { PasswordInput } from "@/components/ui/password-input";
import { api } from "@/lib/client";
import { maxPasswordLength, minPasswordLength, newPasswordSchema } from "@/lib/password-rules";
import { Spinner, useAction } from "./access-dialogs";

type Account = { id: string; name: string; email: string };

const doneSchema = z.object({}).loose();
const emailSchema = z.email();

export function ChangeEmailDialog({ row, onClose }: { row: Account | null; onClose: () => void }) {
  const { pending, error, setError, run } = useAction(onClose);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (row == null) return;
    const id = row.id;
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!emailSchema.safeParse(email).success) return setError("Informe um e-mail válido.");
    await run(() => api(`/api/admin/accounts/${id}/email`, doneSchema, { email }, "PATCH"), "E-mail trocado. O cliente entra com o novo e-mail.");
  }
  return (
    <AlertDialog open={row !== null} onOpenChange={(next) => { if (!pending && !next) { onClose(); setError(null); } }}>
      <AlertDialogContent>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Trocar o e-mail de {row?.name}</AlertDialogTitle>
            <AlertDialogDescription>Hoje: {row?.email}. Depois de salvar, o cliente entra só com o e-mail novo.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="client-email">E-mail novo</Label>
            <Input id="client-email" name="email" type="email" autoComplete="off" required autoFocus disabled={pending} aria-invalid={error ? true : undefined} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <Button type="submit" disabled={pending}><Spinner pending={pending} />Salvar e-mail</Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function SetPasswordDialog({ row, onClose }: { row: Account | null; onClose: () => void }) {
  const { pending, error, setError, run } = useAction(onClose);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (row == null) return;
    const id = row.id;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const parsed = newPasswordSchema.safeParse(password);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Senha inválida.");
    if (password !== String(form.get("confirm") ?? "")) return setError("As senhas não são iguais.");
    await run(() => api(`/api/admin/accounts/${id}/password`, doneSchema, { password }, "PUT"), "Senha nova definida. Passe para o cliente por um canal privado.");
  }
  return (
    <AlertDialog open={row !== null} onOpenChange={(next) => { if (!pending && !next) { onClose(); setError(null); } }}>
      <AlertDialogContent>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Definir uma senha nova para {row?.name}</AlertDialogTitle>
            <AlertDialogDescription>A senha antiga deixa de valer. O registro guarda quem trocou e quando, nunca a senha.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="client-password">Senha nova</Label>
            <PasswordInput id="client-password" name="password" autoComplete="new-password" required autoFocus minLength={minPasswordLength} maxLength={maxPasswordLength} disabled={pending} aria-describedby="client-password-hint" aria-invalid={error ? true : undefined} />
            <p id="client-password-hint" className="text-xs text-muted-foreground">Pelo menos {minPasswordLength} caracteres.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="client-password-confirm">Confirme a senha nova</Label>
            <PasswordInput id="client-password-confirm" name="confirm" autoComplete="new-password" required disabled={pending} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <Button type="submit" disabled={pending}><Spinner pending={pending} />Definir senha</Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
