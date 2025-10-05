import * as React from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface ShieldBadgeProps {
  flagged?: boolean;
  blocked?: boolean;
  className?: string;
}

export function ShieldBadge({ flagged, blocked, className }: ShieldBadgeProps) {
  if (!flagged && !blocked) return null;
  const variant = blocked ? ("destructive" as const) : ("secondary" as const);
  const Icon = blocked ? ShieldAlert : ShieldCheck;
  const label = blocked ? "blocked" : "flagged";
  const title = blocked
    ? "Guardrails blocked this message (prompt injection)."
    : "Guardrails flagged this message (possible prompt injection).";
  return (
    <Badge
      data-testid="guardrails-badge"
      className={className}
      variant={variant as any}
      title={title}
    >
      <Icon aria-hidden className="mr-1 h-3.5 w-3.5" />
      {`guardrails: ${label}`}
    </Badge>
  );
}
