import Link from "next/link";
import { Brand } from "@/components/brand";
import { StatCard } from "@/components/stat-card";
import { legalPaths } from "@/lib/legal";

/** Static illustration of a generated batch, drawn with plain elements. */
function ProductPreview() {
  return (
    <div aria-hidden className="relative w-full max-w-md select-none">
      <div className="relative">
        <div className="absolute inset-x-6 -top-3 h-full rounded-xl border bg-card/60 shadow-(--shadow-panel)" />
        <div className="relative rounded-xl border bg-card shadow-(--shadow-floating)">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">Leva 01</p>
              <p className="text-xs text-muted-foreground">
                3 roteiros prontos
              </p>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              Para testar
            </span>
          </div>
          <ul className="divide-y">
            {[
              {
                label: "Roteiro 1 · Gancho",
                text: "“Eu travava em toda reunião em inglês. Até mudar uma coisa.”",
              },
              {
                label: "Roteiro 2 · Gancho",
                text: "“15 minutos por dia. Foi isso que bastou.”",
              },
            ].map((item) => (
              <li key={item.label} className="space-y-1 px-4 py-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {item.label}
                </p>
                <p className="text-sm leading-snug">{item.text}</p>
              </li>
            ))}
            <li className="space-y-2 px-4 py-3">
              <div className="h-2 w-24 rounded-full bg-muted" />
              <div className="h-2 w-4/5 rounded-full bg-muted" />
            </li>
          </ul>
        </div>
      </div>
      <div className="relative mt-4 grid grid-cols-2 gap-3">
        <StatCard label="Retorno" value="3,8x" hint="Exemplo: melhor criativo" />
        <StatCard label="Custo por venda" value="R$ 42" hint="Exemplo: últimos 7 dias" />
      </div>
    </div>
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <section
        aria-label="Sobre o Criativos Virais"
        className="hidden flex-col border-r bg-muted p-10 lg:flex xl:p-12"
      >
        <Link href="/" className="self-start rounded-lg">
          <Brand className="h-6" />
        </Link>
        <div className="flex flex-1 flex-col justify-center gap-10 py-12">
          <div className="max-w-md space-y-3">
            <p className="text-3xl font-semibold tracking-tight text-balance">
              Roteiros de anúncio a partir do que já vende.
            </p>
            <p className="text-base text-muted-foreground">
              Conte sobre a sua oferta, traga seus resultados e receba roteiros
              prontos para testar.
            </p>
          </div>
          <ProductPreview />
        </div>
      </section>
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-w-0 flex-col px-5 py-8 outline-none sm:px-8"
      >
        <Link href="/" className="self-start rounded-lg lg:hidden">
          <Brand className="h-5" />
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-(--shadow-panel) sm:p-8">
            {children}
            <p className="mt-6 border-t pt-4 text-center text-xs text-muted-foreground">
              <Link href={legalPaths.terms} className="rounded-sm underline underline-offset-4 hover:text-foreground">
                Termos de uso
              </Link>
              {" · "}
              <Link href={legalPaths.privacy} className="rounded-sm underline underline-offset-4 hover:text-foreground">
                Privacidade
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
