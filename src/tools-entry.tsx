import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { AgentToolsPanel } from "@/components/AgentToolsPanel";
import { isPrivilegedUIEnabled } from "@/lib/devGuard";
import "@/styles/tailwind.css";

function ToolsPage() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    isPrivilegedUIEnabled()
      .then((result) => {
        setEnabled(result);
        console.debug(`[ToolsPage] isPrivilegedUIEnabled()=${result}`);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="mb-2 text-xl font-semibold text-gray-800">
            Tools Unavailable
          </h1>
          <p className="text-sm text-gray-600">
            Admin tools are restricted. Enable dev mode or authenticate to access this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-7xl p-6">
      <AgentToolsPanel />
    </div>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <ToolsPage />
    </React.StrictMode>
  );
}
