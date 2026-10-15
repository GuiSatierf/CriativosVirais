"use client";
import { useEffect } from "react";
import Link from "next/link";
import { MessageSquare, RotateCw, TriangleAlert } from "@/components/icons";
import { Button, buttonVariants } from "@/components/ui/button";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Only the digest is logged; it matches the server log without exposing details.
    if (error.digest) console.error("Erro ao carregar a página", error.digest);
  }, [error.digest]);
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <span className="mb-4 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <TriangleAlert strokeWidth={1.75} className="size-5" aria-hidden />
      </span>
      <h1 className="section-title">Algo deu errado</h1>
      <p role="alert" className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        Não foi possível carregar esta página. Tente de novo em instantes.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button onClick={() => retry()}>
          <RotateCw aria-hidden />
          Tentar novamente
        </Button>
        <Link className={buttonVariants({ variant: "outline" })} href="/chat">
          <MessageSquare aria-hidden />
          Ir para a conversa
        </Link>
      </div>
    </div>
  );
}
