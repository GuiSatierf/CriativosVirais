"use client";
import { useEffect } from "react";
import { House, RotateCw } from "@/components/icons";
import "./globals.css";

/** Replaces the root layout when it fails, so it renders its own document. */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    if (error.digest)
      console.error("Erro ao carregar a aplicação", error.digest);
  }, [error.digest]);
  return (
    <html lang="pt-BR" className="font-sans">
      <body>
        <title>Algo deu errado · Criativos Virais</title>
        <main className="flex min-h-svh flex-col items-center justify-center px-4 py-16 text-center">
          <h1 className="section-title">Algo deu errado</h1>
          <p
            role="alert"
            className="mt-1.5 max-w-sm text-sm text-muted-foreground"
          >
            Não foi possível carregar o Criativos Virais.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => retry()}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-brand px-3.5 text-sm font-medium text-brand-foreground transition-colors duration-(--duration-fast) hover:bg-[color-mix(in_oklch,var(--brand),black_12%)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11"
            >
              <RotateCw className="size-4" aria-hidden />
              Tentar novamente
            </button>
            {/* A full reload is intended: the root layout itself failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-background px-3.5 text-sm font-medium transition-colors duration-(--duration-fast) hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11"
            >
              <House className="size-4" aria-hidden />
              Ir para o início
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
