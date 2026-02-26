import type { ContractNode } from "./types.js";

/**
 * Walk up from a route node, collecting all available slot names
 * declared by ancestor layouts (and the node's own layout).
 *
 * Returns a map of slot name → declaring node.
 */
export function resolveAvailableSlots(
  node: ContractNode,
): Map<string, ContractNode> {
  const slots = new Map<string, ContractNode>();

  let current: ContractNode | null = node;
  while (current) {
    const layoutSlots = current.contract.layout?.slots;
    if (layoutSlots) {
      for (const slotName of Object.keys(layoutSlots)) {
        // Don't overwrite — closest ancestor wins for "declared by" tracking,
        // but all are available. We keep the first (closest) one found.
        if (!slots.has(slotName)) {
          slots.set(slotName, current);
        }
      }
    }
    current = current.parent;
  }

  return slots;
}

/**
 * Walk up ancestors (excluding the node itself) collecting all slot names
 * that the node could fill.
 */
export function resolveAncestorSlots(
  node: ContractNode,
): Map<string, ContractNode> {
  const slots = new Map<string, ContractNode>();

  let current = node.parent;
  while (current) {
    const layoutSlots = current.contract.layout?.slots;
    if (layoutSlots) {
      for (const slotName of Object.keys(layoutSlots)) {
        if (!slots.has(slotName)) {
          slots.set(slotName, current);
        }
      }
    }
    current = current.parent;
  }

  return slots;
}

/**
 * Check if a required slot is filled by walking down the default/redirect chain.
 *
 * Starting from a node, follow the default or redirect child. At each step,
 * check if the child fills the given slot name. Returns true if any node
 * in the chain fills it.
 */
export function isSlotFilledInChain(
  node: ContractNode,
  slotName: string,
): boolean {
  // First check if the node itself fills the slot (self-fill)
  if (node.contract.fills?.includes(slotName)) {
    return true;
  }

  // Follow default/redirect chain
  const targetName =
    node.contract.layout?.default ?? node.contract.layout?.redirect;
  if (!targetName) return false;

  const targetChild = node.children.get(targetName);
  if (!targetChild) return false;

  return isSlotFilledInChain(targetChild, slotName);
}
