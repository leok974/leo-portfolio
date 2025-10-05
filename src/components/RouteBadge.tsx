import React from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface BackendSnap { last_backend?: string; last_ms?: number }
interface Scope { route?: "rag" | "faq" | "chitchat"; reason?: string; project_id?: string | null }

export function RouteBadge({
  scope, grounded, sourcesCount, backends,
  // Retain compact to avoid breaking existing callers
  compact,
}: {
  scope?: Scope; grounded?: boolean; sourcesCount?: number;
  backends?: { gen?: BackendSnap; embeddings?: BackendSnap; rerank?: BackendSnap };
  compact?: boolean;
}) {
  const route = (scope?.route ?? "chitchat") as "rag" | "faq" | "chitchat";

  // Outer pill color
  const variantColor =
    route === "rag" ? "bg-emerald-600 text-white dark:bg-emerald-600"
    : route === "faq" ? "bg-indigo-600 text-white dark:bg-indigo-600"
    : "bg-slate-600 text-white dark:bg-slate-600";

  // Chip accent map (border + faint tint)
  const chipAccent =
    route === "rag"
      ? "border-emerald-400 bg-emerald-400/10 text-emerald-50 dark:text-emerald-100"
      : route === "faq"
      ? "border-indigo-400 bg-indigo-400/10 text-indigo-50 dark:text-indigo-100"
      : "border-slate-400 bg-slate-400/10 text-slate-50 dark:text-slate-100";

  // Route-tinted dot color
  const dotColor =
    route === "rag" ? "bg-emerald-300"
    : route === "faq" ? "bg-indigo-300"
    : "bg-slate-300";

  const title = [
    `route: ${route}`,
    scope?.project_id ? `project: ${scope.project_id}` : null,
    `grounded: ${grounded ? "yes" : "no"}`,
    typeof sourcesCount === "number" ? `sources: ${sourcesCount}` : null,
    backends?.gen?.last_backend ? `gen: ${backends.gen.last_backend} (${Math.round(backends.gen.last_ms ?? 0)} ms)` : null,
    backends?.embeddings?.last_backend ? `embed: ${backends.embeddings.last_backend}` : null,
    backends?.rerank?.last_backend ? `rerank: ${backends.rerank.last_backend}` : null,
    scope?.reason ? `reason: ${scope.reason}` : null,
  ].filter(Boolean).join(" • ");

  const Chip: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
    <Badge
      variant="outline"
      className={cn(
        compact ? "ml-1 h-4 px-1 py-0 text-[10px] leading-none" : "ml-1 h-5 px-1.5 py-0 leading-none",
        "backdrop-blur-[1px]",
        chipAccent,
        "border-[1px]",
        className
      )}
    >
      {children}
    </Badge>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            data-testid="route-badge"
            className={cn(
              "group route-badge inline-flex items-center gap-1.5 rounded-full font-semibold",
              compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
              "shadow-sm border border-white/10 dark:border-black/10",
              variantColor
            )}
            title={title}
            aria-label={title}
          >
            {/* tinted dot + subtle hover pulse */}
            <span
              className={cn(
                compact ? "h-2 w-2" : "h-2.5 w-2.5",
                "rounded-full",
                dotColor,
                "ring-2 ring-white/40 dark:ring-black/30",
                "transition-transform duration-150",
                "group-hover:scale-110",
                "motion-safe:group-hover:animate-rb-pulse"
              )}
            />
            <span className="uppercase tracking-wider">{route}</span>

            {scope?.project_id && <Chip>{String(scope.project_id)}</Chip>}
            {grounded && <Chip>grounded</Chip>}
            {typeof sourcesCount === "number" && <Chip>{sourcesCount} src</Chip>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs leading-relaxed">
          <div className="font-semibold mb-1">Assistant route</div>
          <div className="text-slate-700 dark:text-slate-300 text-xs space-y-1">
            <div><b>Route</b>: {route}{scope?.project_id ? ` · ${scope.project_id}` : ""}</div>
            <div><b>Grounded</b>: {grounded ? "yes" : "no"} · <b>Sources</b>: {sourcesCount ?? 0}</div>
            {(backends?.gen?.last_backend || backends?.embeddings?.last_backend || backends?.rerank?.last_backend) && (
              <div>
                <b>Backends</b>:
                {backends?.gen?.last_backend && <> gen={backends.gen.last_backend} ({Math.round(backends.gen.last_ms ?? 0)}ms)</>}
                {backends?.embeddings?.last_backend && <> · embed={backends.embeddings.last_backend}</>}
                {backends?.rerank?.last_backend && <> · rerank={backends.rerank.last_backend}</>}
              </div>
            )}
            {scope?.reason && <div><b>Reason</b>: {scope.reason}</div>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
