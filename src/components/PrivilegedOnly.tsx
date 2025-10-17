import React from "react";
import type { ComponentChildren } from "preact";
import { isDevUIEnabled } from "../lib/devGuard";

interface PrivilegedOnlyProps {
  children: ComponentChildren;
}

export default function PrivilegedOnly({ children }: PrivilegedOnlyProps) {
  if (!isDevUIEnabled()) return null;
  return <>{children}</>;
}
