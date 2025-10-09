import React from "react";
import { isDevUIEnabled } from "../lib/devGuard";

interface PrivilegedOnlyProps {
  children: React.ReactNode;
}

export default function PrivilegedOnly({ children }: PrivilegedOnlyProps) {
  if (!isDevUIEnabled()) return null;
  return <>{children}</>;
}
