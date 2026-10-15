import Link from "next/link";
import { House, SearchX } from "@/components/icons";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <span className="mb-4 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX strokeWidth={1.75} className="size-5" aria-hidden />
      </span>
      <h1 className="section-title">Página não encontrada</h1>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        O conteúdo pode ter sido removido ou não pertence a esta conta.
      </p>
      <Link className={buttonVariants({ className: "mt-5" })} href="/chat">
        <House aria-hidden />
        Ir para o início
      </Link>
    </div>
  );
}
