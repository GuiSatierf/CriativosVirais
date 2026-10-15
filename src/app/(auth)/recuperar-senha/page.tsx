import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@/components/icons";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Recuperar senha · Criativos Virais",
};

// Password reset by email is not configured yet (no email sender), so support resets it.
export default function RecoverPasswordPage() {
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
