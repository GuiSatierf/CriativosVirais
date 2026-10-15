import { Panel } from "@/components/panel";
import { BatchView } from "@/components/views/batch";

export default function Page(props: { params: Promise<{ batchId: string }> }) {
  return (
    <Panel label="Leva">
      <BatchView {...props} />
    </Panel>
  );
}
