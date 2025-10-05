import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  "data-testid"?: string;
}
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "form-input rounded-2xl border-neutral-300 dark:border-neutral-700",
        "focus:ring-2 focus:ring-indigo-500 focus-ring",
        "flex h-9 w-full bg-transparent px-3 text-sm",
        "placeholder:text-slate-400",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
