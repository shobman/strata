import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Contract types (mirrors _contract.yml shape)
// ---------------------------------------------------------------------------

export interface StrataLevel {
  name: "atom" | "molecule" | "organism" | "route";
  rank: 0 | 1 | 2 | 3;
  /** Override: which levels can be imported. Inferred from rank if absent. */
  canImport?: string[];
}

export interface StrataLayout {
  /** Map of slot names. Value is "required" or null (optional). */
  slots?: Record<string, "required" | null>;
  /** Child name that renders at parent URL (index route). */
  default?: string;
  /** Child name that parent URL redirects to. */
  redirect?: string;
}

export interface StrataContract {
  /** Route parameter name for dynamic segments. */
  param?: string;
  level: StrataLevel;
  /** Slot names this route fills (self or ancestor). */
  fills?: string[];
  layout?: StrataLayout;
  /** Variant names for conditional layouts. */
  variants?: string[];
  /** Default variant name. */
  default?: string;
  /** Resolver expression for variant selection. */
  resolve?: string;
}

// ---------------------------------------------------------------------------
// Component prop types
// ---------------------------------------------------------------------------

export interface SlotProviderProps {
  children: ReactNode;
}

export interface SlotTargetProps {
  name: string;
}

export interface FillSlotProps {
  name: string;
  children: ReactNode;
}
