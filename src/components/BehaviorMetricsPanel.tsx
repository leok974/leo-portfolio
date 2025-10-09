import React, { useEffect, useState } from "react";
import { isPrivilegedUIEnabled } from "@/lib/devGuard";

export default function BehaviorMetricsPanel() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    isPrivilegedUIEnabled()
      .then(setEnabled)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-4 rounded-xl border border-neutral-800/30 bg-neutral-950/40">
        <div className="text-sm text-neutral-400">Loading...</div>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="p-4 rounded-xl border border-neutral-800/30 bg-neutral-950/40">
        <div className="text-sm text-neutral-300">
          <strong>Restricted:</strong> Behavior Metrics is visible only in the
          privileged panel.
        </div>
        <div className="text-xs text-neutral-500 mt-1">
          Enable the dev/privileged mode to view analytics (see DEVELOPMENT.md).
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-neutral-800/40 shadow-sm">
      <GuardedIframe />
    </div>
  );
}

function GuardedIframe() {
  const [src, setSrc] = React.useState("/agent/metrics/dashboard");
  
  React.useEffect(() => {
    try {
      const token = localStorage.getItem("dev:token");
      if (token) {
        setSrc(`/agent/metrics/dashboard?dev=${encodeURIComponent(token)}`);
      }
    } catch {}
  }, []);
  
  return (
    <iframe
      src={src}
      title="Behavior Metrics"
      className="w-full"
      style={{ height: "70vh" }}
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
    />
  );
}
