"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LoaderCircle, Trash2 } from "@/components/icons";
import { toast } from "sonner";
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
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

const minPassword = 12;
const spin = "animate-spin motion-reduce:animate-none";

/** Changes the password and signs out every other device. */
export function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current) return setError("Digite a sua senha atual.");
    if (next.length < minPassword)
      return setError(`A nova senha precisa ter pelo menos ${minPassword} caracteres.`);
    if (next !== confirm) return setError("As novas senhas não são iguais.");
    setError(undefined);
    setPending(true);
    try {
      const result = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (result.error) {
        setError(
          result.error.status === 400 || result.error.status === 401
            ? "A senha atual está incorreta."
            : "Não foi possível trocar a senha. Tente novamente.",
        );
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Senha alterada. Outros aparelhos foram desconectados.");
    } catch {
      setError("Não foi possível trocar a senha. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="senha-atual">Senha atual</Label>
        <PasswordInput
          id="senha-atual"
          autoComplete="current-password"
          enterKeyHint="next"
          required
          aria-invalid={error && !current ? true : undefined}
          aria-describedby={error ? "senha-erro" : undefined}
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="senha-nova">Nova senha</Label>
        <PasswordInput
          id="senha-nova"
          autoComplete="new-password"
          enterKeyHint="next"
          required
          minLength={minPassword}
          maxLength={128}
          aria-invalid={error && current && next.length < minPassword ? true : undefined}
          aria-describedby={error ? "senha-nova-dica senha-erro" : "senha-nova-dica"}
          value={next}
          onChange={(event) => setNext(event.target.value)}
        />
        <p id="senha-nova-dica" className="text-xs text-muted-foreground">
          Pelo menos {minPassword} caracteres.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="senha-confirmar">Confirme a nova senha</Label>
        <PasswordInput
          id="senha-confirmar"
          autoComplete="new-password"
          enterKeyHint="done"
          required
          aria-invalid={error && next.length >= minPassword && next !== confirm ? true : undefined}
          aria-describedby={error ? "senha-erro" : undefined}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </div>
      {error && (
        <p id="senha-erro" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? <LoaderCircle className={spin} aria-hidden /> : <KeyRound aria-hidden />}
        {pending ? "Salvando…" : "Trocar senha"}
      </Button>
    </form>
  );
}

/** Permanently deletes the account and all its data after the password is confirmed. */
export function DeleteAccount() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password || pending) return;
    setPending(true);
    setError(undefined);
    try {
      const result = await authClient.deleteUser({ password });
      if (result.error) {
        setError(
          result.error.status === 400 || result.error.status === 401
            ? "Senha incorreta."
            : "Não foi possível excluir a conta. Tente novamente.",
        );
        return;
      }
      router.replace("/signup");
      router.refresh();
    } catch {
      setError("Não foi possível excluir a conta. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden />
        Excluir conta
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (pending) return;
          setOpen(next);
          if (!next) {
            setPassword("");
            setError(undefined);
          }
        }}
      >
        <AlertDialogContent>
          <form onSubmit={submit} noValidate className="grid gap-4">
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir sua conta?</AlertDialogTitle>
              <AlertDialogDescription>
                Conversas, levas, criativos, vídeos, resultados e integrações
                serão apagados para sempre. Não dá para desfazer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="excluir-senha">Digite sua senha para confirmar</Label>
              <PasswordInput
                id="excluir-senha"
                autoComplete="current-password"
                enterKeyHint="done"
                required
                autoFocus
                value={password}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "excluir-erro" : undefined}
                onChange={(event) => setPassword(event.target.value)}
              />
              {error && (
                <p id="excluir-erro" role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
              <Button
                type="submit"
                variant="destructive"
                disabled={!password || pending}
              >
                {pending ? <LoaderCircle className={spin} aria-hidden /> : <Trash2 aria-hidden />}
                {pending ? "Excluindo…" : "Excluir para sempre"}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
