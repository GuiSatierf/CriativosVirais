import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";
import { privacyMarkdown } from "@/content/legal";
import { legalPaths } from "@/lib/legal";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Política de privacidade"
      description="Que dados o Criativos Virais usa, para quê e como você controla."
      text={privacyMarkdown}
      other={{ label: "Termos de uso", href: legalPaths.terms }}
    />
  );
}
