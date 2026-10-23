import type { Metadata } from "next";
import { Panel } from "@/components/panel";
import { CreativesView } from "@/components/views/creatives";

export const metadata: Metadata = { title: "Resultados" };

export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Panel label="Resultados">
      <CreativesView {...props} />
    </Panel>
  );
}
