import type { Metadata } from "next";
import { Panel } from "@/components/panel";
import { ArchivedConversationsView } from "@/components/views/archived-conversations";

export const metadata: Metadata = { title: "Conversas arquivadas" };

export default function Page() {
  return (
    <Panel label="Conversas arquivadas">
      <ArchivedConversationsView />
    </Panel>
  );
}
