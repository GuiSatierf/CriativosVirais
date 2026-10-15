import Link from "next/link";
import { House } from "@/components/icons";
import { Brand } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-svh flex-col items-center justify-center px-4 py-16 text-center outline-none"
    >
      <Link href="/" className="mb-10 rounded-lg" aria-label="Criativos Virais — início">
        <Brand className="h-5" />
      </Link>
      <p className="text-sm font-medium text-muted-foreground tabular-nums">404</p>
      <h1 className="mt-1 page-title">Página não encontrada</h1>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        O endereço pode estar errado ou a página foi removida.
      </p>
      <Link className={buttonVariants({ className: "mt-5" })} href="/">
        <House aria-hidden />
        Ir para o início
      </Link>
    </main>
  );
}
