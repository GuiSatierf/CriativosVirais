import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "@/components/icons";
import { PasswordResetRequest } from "@/components/password-reset-request";
import { buttonVariants } from "@/components/ui/button";
import { canSendEmail } from "@/lib/email";

export const metadata: Metadata = {
  title: "Recuperar senha",
};

// Installations without an email sender keep the support message instead of a form that cannot deliver.
function SupportNotice() {
  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <h1 className="page-title">Recuperar senha</h1>
        <p className="text-sm text-muted-foreground">
          Ainda não é possível redefinir a senha por e-mail.
        </p>
      </header>
      <p className="rounded-xl border bg-card p-4 text-sm">
        Fale com o suporte e informe o e-mail da sua conta. Nós redefinimos a
        senha para você.
      </p>
      <Link
        href="/login"
        className={buttonVariants({ variant: "outline", className: "w-full" })}
      >
        <ArrowLeft aria-hidden />
        Voltar para o login
      </Link>
    </div>
  );
}

export default async function RecoverPasswordPage() {
  // The sender comes from runtime configuration, never from the build.
  await connection();
  if (!canSendEmail()) return <SupportNotice />;
  return <PasswordResetRequest />;
}
