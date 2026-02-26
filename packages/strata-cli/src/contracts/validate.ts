import type { ContractNode, ContractTree, Diagnostic } from "./types.js";
import { collectAllNodes } from "./walk.js";
import { resolveAncestorSlots, isSlotFilledInChain } from "./resolve.js";
import { join } from "node:path";

const CONTRACT_FILE = "_contract.yml";

const LEVEL_FOR_FOLDER: Record<string, string> = {
  atoms: "atom",
  molecules: "molecule",
  organisms: "organism",
};

/**
 * Run all structural validation rules against a ContractTree.
 * Returns an array of diagnostics (errors and warnings).
 */
export function validate(tree: ContractTree): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Validate route tree
  if (tree.routes) {
    const allRouteNodes = collectAllNodes(tree.routes);
    for (const node of allRouteNodes) {
      validateFillsReferenceRealSlots(node, diagnostics);
      validateDefaultRedirectMutualExclusivity(node, diagnostics);
      validateDefaultRedirectTargetExists(node, diagnostics);
      validateParamRouteExcludedFromDefaultRedirect(node, diagnostics);
      validateRequiredSlotsSatisfied(node, diagnostics);
      validateRouteLevelConsistency(node, diagnostics);
    }
  }

  // Validate component contracts
  for (const componentNode of tree.components) {
    validateComponentLevelConsistency(componentNode, diagnostics);
  }

  return diagnostics;
}

/**
 * Rule 1: Fills reference real slots.
 * For each fill in a route's contract, walk up ancestors and confirm
 * at least one ancestor declares that slot name.
 */
function validateFillsReferenceRealSlots(
  node: ContractNode,
  diagnostics: Diagnostic[],
): void {
  const fills = node.contract.fills;
  if (!fills || fills.length === 0) return;

  // Collect ancestor slots AND own slots (self-fill is valid)
  const ancestorSlots = resolveAncestorSlots(node);
  const ownSlots = node.contract.layout?.slots
    ? new Set(Object.keys(node.contract.layout.slots))
    : new Set<string>();

  for (const fillName of fills) {
    if (!ancestorSlots.has(fillName) && !ownSlots.has(fillName)) {
      diagnostics.push({
        level: "error",
        message: `Fill "${fillName}" does not match any slot declared by an ancestor or self. Available ancestor slots: ${
          ancestorSlots.size > 0
            ? [...ancestorSlots.keys()].join(", ")
            : "(none)"
        }`,
        file: join(node.path, CONTRACT_FILE),
        rule: "fills-reference-real-slots",
      });
    }
  }
}

/**
 * Rule 2: Required slots satisfied.
 * For each required slot in a layout, walk the default/redirect chain.
 * At least one route in the chain must fill it.
 */
function validateRequiredSlotsSatisfied(
  node: ContractNode,
  diagnostics: Diagnostic[],
): void {
  const slots = node.contract.layout?.slots;
  if (!slots) return;

  for (const [slotName, value] of Object.entries(slots)) {
    if (value !== "required") continue;

    if (!isSlotFilledInChain(node, slotName)) {
      diagnostics.push({
        level: "error",
        message: `Required slot "${slotName}" is not filled by any route in the default/redirect chain`,
        file: join(node.path, CONTRACT_FILE),
        rule: "required-slots-satisfied",
      });
    }
  }
}

/**
 * Rule 3: Default/redirect mutual exclusivity.
 * A contract cannot have both layout.default AND layout.redirect.
 */
function validateDefaultRedirectMutualExclusivity(
  node: ContractNode,
  diagnostics: Diagnostic[],
): void {
  const layout = node.contract.layout;
  if (!layout) return;

  if (layout.default !== undefined && layout.redirect !== undefined) {
    diagnostics.push({
      level: "error",
      message:
        "Contract has both layout.default and layout.redirect — these are mutually exclusive",
      file: join(node.path, CONTRACT_FILE),
      rule: "default-redirect-mutual-exclusivity",
    });
  }
}

/**
 * Rule 4: Default/redirect target exists.
 * The named child must actually exist as a subfolder with a contract.
 */
function validateDefaultRedirectTargetExists(
  node: ContractNode,
  diagnostics: Diagnostic[],
): void {
  const layout = node.contract.layout;
  if (!layout) return;

  for (const field of ["default", "redirect"] as const) {
    const target = layout[field];
    if (target === undefined) continue;

    if (!node.children.has(target)) {
      diagnostics.push({
        level: "error",
        message: `layout.${field} references "${target}" but no child folder with that name and a _contract.yml exists`,
        file: join(node.path, CONTRACT_FILE),
        rule: "default-redirect-target-exists",
      });
    }
  }
}

/**
 * Rule 5: Parameterised routes excluded.
 * If a child folder is [paramName], it cannot be a default or redirect target.
 */
function validateParamRouteExcludedFromDefaultRedirect(
  node: ContractNode,
  diagnostics: Diagnostic[],
): void {
  const layout = node.contract.layout;
  if (!layout) return;

  for (const field of ["default", "redirect"] as const) {
    const target = layout[field];
    if (target === undefined) continue;

    if (target.startsWith("[") && target.endsWith("]")) {
      diagnostics.push({
        level: "error",
        message: `layout.${field} targets parameterised route "${target}" — dynamic routes cannot be defaults or redirects`,
        file: join(node.path, CONTRACT_FILE),
        rule: "param-route-excluded-from-default-redirect",
      });
    }
  }
}

/**
 * Rule 6: Level rank consistency for routes.
 * If a contract is under routes/, it should be level "route" with rank 3.
 */
function validateRouteLevelConsistency(
  node: ContractNode,
  diagnostics: Diagnostic[],
): void {
  if (node.contract.level.name !== "route" || node.contract.level.rank !== 3) {
    diagnostics.push({
      level: "warn",
      message: `Route contract declares level "${node.contract.level.name}" (rank ${node.contract.level.rank}) but should be "route" (rank 3)`,
      file: join(node.path, CONTRACT_FILE),
      rule: "route-level-consistency",
    });
  }
}

/**
 * Rule 7: Component level consistency.
 * atoms/ folder should only contain atom contracts, molecules/ → molecule, etc.
 */
function validateComponentLevelConsistency(
  node: ContractNode,
  diagnostics: Diagnostic[],
): void {
  const expectedLevel = LEVEL_FOR_FOLDER[node.name];
  if (!expectedLevel) return;

  if (node.contract.level.name !== expectedLevel) {
    diagnostics.push({
      level: "warn",
      message: `Component in "${node.name}/" declares level "${node.contract.level.name}" but should be "${expectedLevel}"`,
      file: join(node.path, CONTRACT_FILE),
      rule: "component-level-consistency",
    });
  }
}
