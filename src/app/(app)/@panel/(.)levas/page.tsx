import type { Metadata } from "next";
import { Panel } from "@/components/panel";
import { BatchesView } from "@/components/views/batches";

export const metadata: Metadata = { title: "Levas" };

export default function Page(props: { searchParams: Promise<{ arquivadas?: string }> }) {
  return (
    <Panel label="Levas">
      <BatchesView {...props} />
    </Panel>
  );
}
