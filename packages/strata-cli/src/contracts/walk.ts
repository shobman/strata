import { readdirSync, statSync, existsSync } from "node:fs";
import { join, basename, relative, sep } from "node:path";
import { parseContractFile } from "./parse.js";
import type { ContractNode, ContractTree } from "./types.js";

const CONTRACT_FILE = "_contract.yml";
const COMPONENT_FOLDERS = new Set(["atoms", "molecules", "organisms"]);

/**
 * Recursively walk a directory tree, building ContractNode parent-child
 * relationships based on filesystem nesting.
 */
function walkDirectory(
  dirPath: string,
  parent: ContractNode | null,
): ContractNode | null {
  const contractPath = join(dirPath, CONTRACT_FILE);

  if (!existsSync(contractPath)) {
    return null;
  }

  const contract = parseContractFile(contractPath);
  const node: ContractNode = {
    path: dirPath,
    name: basename(dirPath),
    contract,
    parent,
    children: new Map(),
  };

  // Scan subdirectories for child contracts
  let entries: string[];
  try {
    entries = readdirSync(dirPath);
  } catch {
    return node;
  }

  for (const entry of entries) {
    // Skip hidden dirs, node_modules, dist, etc.
    if (entry.startsWith(".") || entry === "node_modules" || entry === "dist") {
      continue;
    }

    const childPath = join(dirPath, entry);
    try {
      if (!statSync(childPath).isDirectory()) continue;
    } catch {
      continue;
    }

    const childNode = walkDirectory(childPath, node);
    if (childNode) {
      node.children.set(entry, childNode);
    }
  }

  return node;
}

/**
 * Walk a components directory (atoms/, molecules/, organisms/).
 * These are flat — no parent-child relationships, just level validation.
 */
function walkComponentDir(dirPath: string): ContractNode | null {
  const contractPath = join(dirPath, CONTRACT_FILE);
  if (!existsSync(contractPath)) return null;

  const contract = parseContractFile(contractPath);
  return {
    path: dirPath,
    name: basename(dirPath),
    contract,
    parent: null,
    children: new Map(),
  };
}

/**
 * Given a root directory, find all _contract.yml files and build a ContractTree.
 *
 * Expects the root to contain:
 * - routes/ — hierarchical route tree
 * - components/ — flat component level directories (atoms/, molecules/, organisms/)
 *
 * Both are optional. If routes/ doesn't exist, tree.routes is null.
 */
/**
 * Detect source root — if `src/` contains routes or components, use it.
 */
function detectSourceRoot(rootDir: string): string {
  const srcDir = join(rootDir, "src");
  if (
    existsSync(srcDir) &&
    (existsSync(join(srcDir, "routes")) || existsSync(join(srcDir, "components")))
  ) {
    return srcDir;
  }
  return rootDir;
}

export function buildContractTree(rootDir: string): ContractTree {
  const sourceRoot = detectSourceRoot(rootDir);

  const tree: ContractTree = {
    routes: null,
    components: [],
  };

  // Walk routes/
  const routesDir = join(sourceRoot, "routes");
  if (existsSync(routesDir) && statSync(routesDir).isDirectory()) {
    tree.routes = walkDirectory(routesDir, null);
  }

  // Walk components/
  const componentsDir = join(sourceRoot, "components");
  if (existsSync(componentsDir) && statSync(componentsDir).isDirectory()) {
    let entries: string[];
    try {
      entries = readdirSync(componentsDir);
    } catch {
      entries = [];
    }

    for (const entry of entries) {
      if (!COMPONENT_FOLDERS.has(entry)) continue;
      const componentPath = join(componentsDir, entry);
      try {
        if (!statSync(componentPath).isDirectory()) continue;
      } catch {
        continue;
      }

      const node = walkComponentDir(componentPath);
      if (node) {
        tree.components.push(node);
      }
    }
  }

  return tree;
}

/**
 * Collect all nodes in the route tree via depth-first traversal.
 */
export function collectAllNodes(root: ContractNode | null): ContractNode[] {
  if (!root) return [];
  const result: ContractNode[] = [root];
  for (const child of root.children.values()) {
    result.push(...collectAllNodes(child));
  }
  return result;
}
