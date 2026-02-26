// ---------------------------------------------------------------------------
// Contract types — mirrors _contract.yml shape
// Defined locally so strata-cli has no runtime dependency on strata-ui.
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
// Contract tree types — the in-memory representation of the parsed filesystem
// ---------------------------------------------------------------------------

export interface ContractNode {
  /** Filesystem path to the directory containing _contract.yml */
  path: string;
  /** The folder name (basename of path) */
  name: string;
  /** Parsed contract data */
  contract: StrataContract;
  /** Reference to parent node (null for root nodes) */
  parent: ContractNode | null;
  /** Child nodes keyed by folder name */
  children: Map<string, ContractNode>;
}

export interface ContractTree {
  /** All route nodes, with the root at the top */
  routes: ContractNode | null;
  /** Component contract nodes (atoms, molecules, organisms) — flat, no parent-child */
  components: ContractNode[];
}

// ---------------------------------------------------------------------------
// Validation result types
// ---------------------------------------------------------------------------

export type DiagnosticLevel = "error" | "warn";

export interface Diagnostic {
  level: DiagnosticLevel;
  message: string;
  file: string;
  rule: string;
}
