/**
 * OverlayApprovalBadge - Shows count of tasks awaiting approval
 *
 * Polls the API every 60s to count tasks with status=awaiting_approval
 * since UTC midnight. Hides when count is zero to keep header tidy.
 */
import React, { useEffect, useMemo, useState, useCallback } from "react";

interface Paged {
  items: Array<any>;
  next_cursor?: string | null;
}

interface OverlayApprovalBadgeProps {
  pollMs?: number;              // refresh interval (default: 60s)
  sinceUtcMidnight?: boolean;   // only count today's tasks (default: true)
}

export default function OverlayApprovalBadge({
  pollMs = 60_000,              // refresh every 60s
  sinceUtcMidnight = true
}: OverlayApprovalBadgeProps) {
  const API_BASE = (window as any).__API_BASE__ || import.meta.env.VITE_API_BASE || "/api";
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const since = useMemo(() => {
    if (!sinceUtcMidnight) return undefined;
    const now = new Date();
    const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    return utcMidnight.toISOString();
  }, [sinceUtcMidnight]);

  const fetchCount = useCallback(async () => {
    setLoading(true);
    try {
      let total = 0;
      let cursor: string | null = null;
      const params = new URLSearchParams({ limit: "200", status: "awaiting_approval" });
      if (since) params.set("since", since);

      // paginate until empty (cap to avoid pathological loops)
      for (let i = 0; i < 50; i++) {
        const url = `${API_BASE}/agents/tasks/paged?` + params.toString() + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : "");
        const r = await fetch(url);
        const data: Paged = await r.json();
        total += data.items?.length || 0;
        cursor = (data.next_cursor ?? null) as string | null;
        if (!cursor) break;
      }
      setCount(total);
    } catch (error) {
      console.error("Failed to fetch approval count:", error);
    } finally {
      setLoading(false);
    }
  }, [API_BASE, since]);

  useEffect(() => {
    fetchCount();
    const t = setInterval(() => fetchCount(), pollMs);
    return () => clearInterval(t);
  }, [fetchCount, pollMs]);

  // Hidden when zero to keep header tidy
  if (loading) {
    return (
      <span
        data-testid="approval-badge"
        title="Awaiting approval (loading)"
        className="inline-flex items-center justify-center text-[11px] rounded-full px-2 h-5 bg-amber-500/15 text-amber-300 border border-amber-700/30"
      >
        …
      </span>
    );
  }
  if (!count) return null;

  return (
    <span
      data-testid="approval-badge"
      title="Awaiting approval today"
      className="inline-flex items-center justify-center text-[11px] rounded-full px-2 h-5 bg-amber-500/15 text-amber-300 border border-amber-700/30"
    >
      {count}
    </span>
  );
}
