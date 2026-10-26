import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import { Brand } from "@/components/brand";
import { legalDraft, legalVersion } from "@/lib/legal";

const markdown: Components = {
  h2: ({ children }) => <h2 className="mt-8 mb-2 text-lg font-semibold">{children}</h2>,
  p: ({ children }) => <p className="mb-3 text-[0.9375rem] leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 list-disc space-y-1.5 pl-5 text-[0.9375rem] leading-relaxed">{children}</ul>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
};

/** A public legal page: one readable column, the version on top and the other document at the end. */
export function LegalDocument({
  title,
  description,
  text,
  other,
}: {
  title: string;
  description: string;
  text: string;
  other: { label: string; href: string };
}) {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-2xl px-5 pt-8 pb-16 outline-none">
      <Link href="/" className="mx-auto mb-10 flex w-fit rounded-lg">
        <Brand className="h-6" />
      </Link>
      <p className="mb-3 w-fit rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
        {legalDraft ? `Versão ${legalVersion} · rascunho em revisão` : `Versão ${legalVersion}`}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1.5 text-muted-foreground">{description}</p>
      <article className="mt-6">
        <ReactMarkdown components={markdown}>{text}</ReactMarkdown>
      </article>
      <p className="mt-10 border-t pt-4 text-sm text-muted-foreground">
        Veja também:{" "}
        <Link href={other.href} className="rounded-sm underline underline-offset-4 hover:text-foreground">
          {other.label}
        </Link>
        {" · "}
        <Link href="/" className="rounded-sm underline underline-offset-4 hover:text-foreground">
          Voltar ao Criativos Virais
        </Link>
      </p>
    </main>
  );
}
