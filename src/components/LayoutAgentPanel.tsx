import { WeightsEditor } from "./WeightsEditor";
import WeightsEditorE2EStub from "./WeightsEditor.e2e";
import { ABAnalyticsPanel } from "./ABAnalyticsPanel";
import { LastRunBadge } from "./LastRunBadge";
import { ToastHost } from "@/lib/toast";
import { isE2E } from "@/lib/e2e";

export function LayoutAgentPanel({ base = "" }: { base?: string }) {
  const EditorComponent = isE2E ? WeightsEditorE2EStub : WeightsEditor;
  
  return (
    <div data-testid="layout-agent-panel" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Layout Optimization Tools</h2>
        <LastRunBadge base={base} />
      </div>
      <EditorComponent base={base} />
      <ABAnalyticsPanel base={base} />
      <ToastHost />
    </div>
  );
}
