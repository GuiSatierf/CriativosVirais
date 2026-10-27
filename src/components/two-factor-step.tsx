"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LogIn } from "@/components/icons";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const appCode = /^\d{6}$/;
/** How long a trusted browser skips the code; Better Auth's default trust period. */
const trustedDays = 30;

/** Second step of sign-in for accounts with two-factor: the authenticator code, or a recovery code. */
export function TwoFactorStep() {
  const router = useRouter();
  const [recovery, setRecovery] = useState(false);
  const [remember, setRemember] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s/g, "");
    if (!recovery && !appCode.test(code)) return setError("Digite os 6 números do app autenticador.");
    if (recovery && code.length === 0) return setError("Digite um código de recuperação.");
    setError(null);
    setPending(true);
    try {
      const result = recovery
        ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice: remember })
        : await authClient.twoFactor.verifyTotp({ code, trustDevice: remember });
      if (result.error) {
        setError(recovery ? "Código de recuperação inválido." : "Código incorreto ou vencido. Use o número que está no app agora.");
        return;
      }
      router.replace("/chat");
      router.refresh();
    } catch {
      setError("Não foi possível conectar. Verifique sua internet e tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <h1 className="page-title">Confirme que é você</h1>
        <p className="text-sm text-muted-foreground">
          {recovery
            ? "Digite um dos códigos de recuperação que você guardou ao ativar a verificação."
            : "Digite o código de 6 números que aparece no seu app autenticador."}
        </p>
      </header>
      <form onSubmit={submit} aria-busy={pending} noValidate className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="code">{recovery ? "Código de recuperação" : "Código do app"}</Label>
          <Input
            key={recovery ? "recovery" : "app"}
            id="code"
            name="code"
            required
            autoFocus
            autoComplete="one-time-code"
            inputMode={recovery ? "text" : "numeric"}
            maxLength={recovery ? 40 : 7}
            disabled={pending}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "code-error" : undefined}
          />
        </div>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-snug">
          <input
            type="checkbox"
            name="remember"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            disabled={pending}
            className="mt-0.5 size-4 shrink-0 accent-foreground pointer-coarse:size-5"
          />
          <span>
            Lembrar este computador por {trustedDays} dias
            <span className="block text-muted-foreground">Não marque em computador de outra pessoa.</span>
          </span>
        </label>
        {error && (
          <Alert variant="destructive" id="code-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button className="mt-2 w-full" type="submit" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden /> : <LogIn aria-hidden />}
          {pending ? "Confirmando…" : "Confirmar e entrar"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        <button
          type="button"
          className="rounded-sm font-medium text-foreground underline underline-offset-4 hover:decoration-2 pointer-coarse:py-2"
          onClick={() => {
            setRecovery((current) => !current);
            setError(null);
          }}
        >
          {recovery ? "Usar o código do app" : "Perdeu o celular? Use um código de recuperação"}
        </button>
      </p>
    </div>
  );
}
