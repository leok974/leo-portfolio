import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 rounded-lg border bg-white/95 px-3 py-2 text-xs shadow-md backdrop-blur",
      "dark:bg-slate-900/90 dark:text-slate-100 border-slate-200 dark:border-slate-700",
      "animate-enter",
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = "TooltipContent";
