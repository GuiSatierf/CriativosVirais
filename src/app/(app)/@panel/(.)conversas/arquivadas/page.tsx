import { Panel } from "@/components/panel";
import { ArchivedConversationsView } from "@/components/views/archived-conversations";

export default function Page() {
  return (
    <Panel label="Conversas arquivadas">
      <ArchivedConversationsView />
    </Panel>
  );
}
