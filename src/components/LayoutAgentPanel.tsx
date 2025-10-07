import { WeightsEditor } from "./WeightsEditor";
import { ABAnalyticsPanel } from "./ABAnalyticsPanel";
import { LastRunBadge } from "./LastRunBadge";
import { ToastHost } from "@/lib/toast";

export function LayoutAgentPanel({ base = "" }: { base?: string }) {
  return (
    <div data-testid="layout-agent-panel" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Layout Optimization Tools</h2>
        <LastRunBadge base={base} />
      </div>
      <WeightsEditor base={base} />
      <ABAnalyticsPanel base={base} />
      <ToastHost />
    </div>
  );
}
