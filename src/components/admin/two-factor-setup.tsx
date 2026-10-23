"use client";
import { useRef, useState } from "react";
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

// Same header the server checks (src/lib/admin-enrollment.ts); kept literal so no server code ships.
const enrollmentHeader = "x-admin-enrollment-code";

// backupCodes is null when enrollment resumed after a reload; new codes are generated at the end.
type Step = { name: "password" } | { name: "scan"; totpURI: string; backupCodes: string[] | null } | { name: "codes"; backupCodes: string[] };

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
  // Kept only in memory for this flow: resuming needs them again to issue the recovery codes.
  const password = useRef("");

  function refusal(code: string | undefined) {
    if (code === "INVALID_ENROLLMENT_CODE") return "Código de ativação inválido ou vencido. Peça um novo a quem administra o servidor.";
    return "Senha incorreta.";
  }

  async function begin(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    password.current = String(form.get("password") ?? "");
    const enrollmentCode = String(form.get("enrollment") ?? "").trim();
    if (password.current.length === 0) return setError("Digite sua senha.");
    if (enrollmentCode.length === 0) return setError("Digite o código de ativação que você recebeu.");
    setPending(true);
    setError(null);
    const fetchOptions = { headers: { [enrollmentHeader]: enrollmentCode } };
    try {
      // A reload during setup resumes the key already created instead of replacing the one scanned.
      const pendingKey = await authClient.twoFactor.getTotpUri({ password: password.current, fetchOptions });
      if (pendingKey.data != null) return setStep({ name: "scan", totpURI: pendingKey.data.totpURI, backupCodes: null });
      if (pendingKey.error?.code !== "TOTP_NOT_ENABLED") return setError(refusal(pendingKey.error?.code));
      const result = await authClient.twoFactor.enable({ password: password.current, method: "totp", fetchOptions });
      if (result.error || result.data == null) return setError(refusal(result.error?.code));
      if (result.data.method !== "totp") return setError("Não foi possível iniciar a verificação. Tente novamente.");
      setStep({ name: "scan", totpURI: result.data.totpURI, backupCodes: result.data.backupCodes });
    } catch {
      setError("Não foi possível conectar. Verifique sua internet e tente novamente.");
    } finally {
      setPending(false);
    }
  }

  async function confirm(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step.name !== "scan") return;
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s/g, "");
    if (!appCode.test(code)) return setError("Digite os 6 números do app autenticador.");
    setPending(true);
    setError(null);
    try {
      const result = await authClient.twoFactor.verifyTotp({ code });
      if (result.error) return setError("Código incorreto ou vencido. Use o número que está no app agora.");
      if (step.backupCodes != null) return setStep({ name: "codes", backupCodes: step.backupCodes });
      const fresh = await authClient.twoFactor.generateBackupCodes({ password: password.current });
      if (fresh.error || fresh.data == null) return setError("Verificação ativada, mas não foi possível gerar os códigos de recuperação. Recarregue a página.");
      setStep({ name: "codes", backupCodes: fresh.data.backupCodes });
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
          <div className="space-y-2">
            <Label htmlFor="admin-enrollment">Código de ativação</Label>
            <Input id="admin-enrollment" name="enrollment" autoComplete="off" spellCheck={false} placeholder="XXXX-XXXX-XXXX" disabled={pending} aria-describedby="admin-enrollment-hint" />
            <p id="admin-enrollment-hint" className="text-xs text-muted-foreground">Quem tornou você admin recebeu este código no servidor e passou só para você.</p>
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
