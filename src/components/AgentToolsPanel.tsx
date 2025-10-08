import React from "react";
import { ABAnalyticsDashboard } from "@/components/ABAnalyticsDashboard";
import { AutotuneButton } from "@/components/AutotuneButton";

/**
 * AgentToolsPanel - Admin/dev-only UI that combines all site agent tools.
 *
 * Includes:
 * - AB Analytics Dashboard (CTR trends, date filters, winner display)
 * - Autotune Button (adaptive weight optimization)
 * - Future: Scheduler controls, manual optimization, weight editor
 */
export function AgentToolsPanel() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Site Agent Tools</h1>
        <p className="mt-2 text-sm text-gray-600">
          Admin dashboard for layout optimization, A/B testing, and analytics
        </p>
      </div>

      {/* Autotune Section */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold">Adaptive Autotuning</h2>
        <p className="mb-4 text-sm text-gray-600">
          Apply A/B test insights to automatically adjust layout weights with a learning rate (alpha).
        </p>
        <AutotuneButton alpha={0.5} className="max-w-xs" />
      </section>

      {/* AB Analytics Section */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <ABAnalyticsDashboard />
      </section>

      {/* Future sections */}
      <section className="rounded-lg border border-gray-200 bg-gray-50 p-6">
        <h2 className="mb-2 text-xl font-semibold text-gray-400">Coming Soon</h2>
        <ul className="space-y-2 text-sm text-gray-500">
          <li>• Scheduler controls (YAML policy editor, manual triggers)</li>
          <li>• Weight editor (interactive sliders with approval workflow)</li>
          <li>• Audit log viewer (recent agent actions)</li>
          <li>• Performance metrics (optimization latency, success rates)</li>
        </ul>
      </section>
    </div>
  );
}

export default AgentToolsPanel;
