"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, LoaderCircle } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/lib/auth-client";
import { QrCode } from "./qr-code";

type Step = { name: "password" } | { name: "scan"; totpURI: string; backupCodes: string[] } | { name: "codes"; backupCodes: string[] };

const appCode = /^\d{6}$/;

/** Key from the otpauth URI, for people who type it instead of scanning. */
function setupKey(totpURI: string) {
  const secret = new URL(totpURI).searchParams.get("secret");
  if (secret == null) return "";
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

/** First admin access: turn on two-factor before any client data is shown. */
export function TwoFactorSetup() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ name: "password" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function begin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    if (password.length === 0) return setError("Digite sua senha.");
    setPending(true);
    setError(null);
    try {
      const result = await authClient.twoFactor.enable({ password, method: "totp" });
      if (result.error || result.data == null) return setError("Senha incorreta.");
      if (result.data.method !== "totp") return setError("Não foi possível iniciar a verificação. Tente novamente.");
      setStep({ name: "scan", totpURI: result.data.totpURI, backupCodes: result.data.backupCodes });
    } catch {
      setError("Não foi possível conectar. Verifique sua internet e tente novamente.");
    } finally {
      setPending(false);
    }
  }

  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step.name !== "scan") return;
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s/g, "");
    if (!appCode.test(code)) return setError("Digite os 6 números do app autenticador.");
    setPending(true);
    setError(null);
    try {
      const result = await authClient.twoFactor.verifyTotp({ code });
      if (result.error) return setError("Código incorreto ou vencido. Use o número que está no app agora.");
      setStep({ name: "codes", backupCodes: step.backupCodes });
    } catch {
      setError("Não foi possível conectar. Verifique sua internet e tente novamente.");
    } finally {
      setPending(false);
    }
  }

  async function copyCodes(codes: string[]) {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      toast.success("Códigos copiados.");
    } catch {
      toast.error("Não foi possível copiar. Anote os códigos.");
    }
  }

  const spinner = pending ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden /> : null;

  return (
    <div className="mx-auto mt-6 max-w-md space-y-5 rounded-xl border bg-card p-6">
      <header className="space-y-1.5">
        <h1 className="text-xl font-semibold">Proteja o acesso de admin</h1>
        <p className="text-sm text-muted-foreground">
          O painel vê dados de todos os clientes. Antes de entrar, ative a verificação em duas etapas.
        </p>
      </header>

      {step.name === "password" && (
        <form onSubmit={begin} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-password">Confirme sua senha</Label>
            <PasswordInput id="admin-password" name="password" autoComplete="current-password" autoFocus disabled={pending} />
          </div>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <Button type="submit" className="w-full" disabled={pending}>{spinner}Continuar</Button>
        </form>
      )}

      {step.name === "scan" && (
        <form onSubmit={confirm} noValidate className="space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Abra um app autenticador (Google Authenticator, 1Password, Authy).</li>
            <li>Leia o código abaixo com o app.</li>
            <li>Digite o número de 6 dígitos que aparecer.</li>
          </ol>
          <div className="flex justify-center">
            <QrCode value={step.totpURI} label="Código para o app autenticador" />
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Não consegue ler? Digite esta chave no app: <span className="font-mono text-foreground">{setupKey(step.totpURI)}</span>
          </p>
          <div className="space-y-2">
            <Label htmlFor="admin-code">Código de 6 dígitos</Label>
            <Input id="admin-code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} autoFocus disabled={pending} aria-invalid={error ? true : undefined} />
          </div>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <Button type="submit" className="w-full" disabled={pending}>{spinner}Ativar</Button>
        </form>
      )}

      {step.name === "codes" && (
        <div className="space-y-4">
          <Alert>
            <AlertDescription>
              Guarde estes códigos de recuperação num lugar seguro. Cada um entra uma vez, se você perder o celular.
            </AlertDescription>
          </Alert>
          <ul className="grid grid-cols-2 gap-2 rounded-lg border bg-background p-3 font-mono text-sm">
            {step.backupCodes.map((code) => <li key={code}>{code}</li>)}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => copyCodes(step.backupCodes)}><Copy aria-hidden />Copiar códigos</Button>
            <Button className="flex-1" onClick={() => { router.replace("/admin"); router.refresh(); }}>Já guardei, entrar no painel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
