import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, relative } from "node:path";
import { routeContractYaml, pageStub, layoutStub } from "../templates/stubs.js";
import { buildContractTree } from "../contracts/walk.js";
import { collectAllNodes } from "../contracts/walk.js";
import { runBuild } from "./build.js";

// ANSI colours
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

// Track what sync did for the summary
const stats = {
  contractsCreated: 0,
  contractsUpdated: 0,
  contractsRemoved: 0,
  stubsCreated: 0,
  routesUnchanged: 0,
};

function logCreated(path: string): void {
  console.log(`  ${GREEN}+ created${RESET}  ${path}`);
}

function logUpdated(path: string): void {
  console.log(`  ${YELLOW}~ updated${RESET}  ${path}`);
}

function logRemoved(path: string): void {
  console.log(`  ${RED}- removed${RESET}  ${path}`);
}

interface TreeNode {
  id: string;
  name: string;
  param: string | null;
  slots: { name: string; required: boolean }[];
  fills: string[];
  defaultChild: string | null;
  redirectChild: string | null;
  children: TreeNode[];
}

function toPascalCase(segment: string): string {
  const cleaned = segment.replace(/[[\]]/g, "");
  return cleaned
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Detect source root — check if src/routes or src/components exist.
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

/**
 * Collect all node IDs from a tree.json tree (relative paths like "devices/[id]").
 */
function collectTreeIds(node: TreeNode): Set<string> {
  const ids = new Set<string>();
  function walk(n: TreeNode): void {
    ids.add(n.id);
    for (const child of n.children) {
      walk(child);
    }
  }
  walk(node);
  return ids;
}

/**
 * Generate _contract.yml content from a tree node.
 */
function nodeToContractYaml(node: TreeNode): string {
  const fills = node.fills.length > 0 ? node.fills : undefined;
  const slotNames = node.slots.map((s) => s.name);
  const requiredSlots = node.slots.filter((s) => s.required).map((s) => s.name);

  // Resolve defaultChild/redirectChild — they're relative paths like "devices/new".
  // We need just the last segment (the child folder name).
  let defaultChild: string | undefined;
  let redirectChild: string | undefined;

  if (node.defaultChild) {
    const child = node.children.find((c) => c.id === node.defaultChild);
    if (child) defaultChild = child.name;
  }
  if (node.redirectChild) {
    const child = node.children.find((c) => c.id === node.redirectChild);
    if (child) redirectChild = child.name;
  }

  return routeContractYaml({
    param: node.param ?? undefined,
    fills,
    slots: slotNames.length > 0 ? slotNames : undefined,
    requiredSlots: requiredSlots.length > 0 ? requiredSlots : undefined,
    default: defaultChild,
    redirect: redirectChild,
  });
}

/**
 * Sync a single tree node to the filesystem (recursive).
 */
function syncNode(node: TreeNode, routesDir: string, relPrefix: string): void {
  // The node's filesystem path. Root "/" maps to routesDir itself.
  const segments = node.id === "/" ? [] : node.id.split("/");
  const nodeDir = join(routesDir, ...segments);
  const contractPath = join(nodeDir, "_contract.yml");
  const relContract = `${relPrefix}${segments.length > 0 ? segments.join("/") + "/" : ""}_contract.yml`;

  // Ensure directory exists
  mkdirSync(nodeDir, { recursive: true });

  // Write or update _contract.yml
  const yaml = nodeToContractYaml(node);
  let changed = false;
  if (existsSync(contractPath)) {
    const existing = readFileSync(contractPath, "utf-8");
    if (existing !== yaml) {
      writeFileSync(contractPath, yaml, "utf-8");
      logUpdated(relContract);
      stats.contractsUpdated++;
      changed = true;
    }
  } else {
    writeFileSync(contractPath, yaml, "utf-8");
    logCreated(relContract);
    stats.contractsCreated++;
    changed = true;
  }

  // Create index.tsx stub only if it doesn't exist
  const indexPath = join(nodeDir, "index.tsx");
  const relIndex = `${relPrefix}${segments.length > 0 ? segments.join("/") + "/" : ""}index.tsx`;
  if (node.id !== "/" && !existsSync(indexPath)) {
    const name = toPascalCase(segments[segments.length - 1]);
    writeFileSync(indexPath, pageStub(name, node.fills), "utf-8");
    logCreated(relIndex);
    stats.stubsCreated++;
    changed = true;
  }

  // Create _layout.tsx stub only if slots are declared and file doesn't exist
  if (node.slots.length > 0) {
    const layoutPath = join(nodeDir, "_layout.tsx");
    const relLayout = `${relPrefix}${segments.length > 0 ? segments.join("/") + "/" : ""}_layout.tsx`;
    if (!existsSync(layoutPath)) {
      const name = toPascalCase(node.id === "/" ? "Root" : segments[segments.length - 1]);
      writeFileSync(layoutPath, layoutStub(name, node.slots.map((s) => s.name)), "utf-8");
      logCreated(relLayout);
      stats.stubsCreated++;
      changed = true;
    }
  }

  if (!changed) {
    stats.routesUnchanged++;
  }

  // Recurse into children
  for (const child of node.children) {
    syncNode(child, routesDir, relPrefix);
  }
}

/**
 * Remove _contract.yml for routes that exist on disk but not in tree.json.
 * Does NOT remove any other files.
 */
function pruneOrphans(treeIds: Set<string>, routesDir: string, relPrefix: string): void {
  const currentTree = buildContractTree(join(routesDir, ".."));
  if (!currentTree.routes) return;

  const existingNodes = collectAllNodes(currentTree.routes);

  for (const node of existingNodes) {
    const relPath = relative(routesDir, node.path).replace(/\\/g, "/") || "/";
    if (!treeIds.has(relPath)) {
      const contractPath = join(node.path, "_contract.yml");
      if (existsSync(contractPath)) {
        unlinkSync(contractPath);
        logRemoved(`${relPrefix}${relPath === "/" ? "" : relPath + "/"}_contract.yml`);
        stats.contractsRemoved++;
      }
    }
  }
}

/**
 * Run `strata sync <file>`.
 */
export function runSync(rootDir: string, treeFile: string): void {
  console.log(`\n${BOLD}strata sync${RESET} ${treeFile}\n`);

  if (!existsSync(treeFile)) {
    console.error(`File not found: ${treeFile}`);
    process.exit(1);
  }

  let tree: TreeNode;
  try {
    tree = JSON.parse(readFileSync(treeFile, "utf-8"));
  } catch (e) {
    console.error(`Failed to parse ${treeFile}: ${(e as Error).message}`);
    process.exit(1);
  }

  const sourceRoot = detectSourceRoot(rootDir);
  const isInsideSrc = sourceRoot !== rootDir;
  const relPrefix = isInsideSrc ? "src/routes/" : "routes/";
  const routesDir = join(sourceRoot, "routes");

  // Reset stats
  stats.contractsCreated = 0;
  stats.contractsUpdated = 0;
  stats.contractsRemoved = 0;
  stats.stubsCreated = 0;
  stats.routesUnchanged = 0;

  // Collect all IDs from the tree for orphan detection
  const treeIds = collectTreeIds(tree);

  // Prune contracts for routes removed from tree, then sync
  pruneOrphans(treeIds, routesDir, relPrefix);
  syncNode(tree, routesDir, relPrefix);

  // Summary
  const totalChanges = stats.contractsCreated + stats.contractsUpdated + stats.contractsRemoved + stats.stubsCreated;

  if (totalChanges === 0) {
    console.log(`  ${DIM}No changes — contracts already match tree.json${RESET}\n`);
  } else {
    console.log("");
    const parts: string[] = [];
    if (stats.contractsCreated > 0) parts.push(`${stats.contractsCreated} contract${stats.contractsCreated > 1 ? "s" : ""} created`);
    if (stats.contractsUpdated > 0) parts.push(`${stats.contractsUpdated} contract${stats.contractsUpdated > 1 ? "s" : ""} updated`);
    if (stats.contractsRemoved > 0) parts.push(`${stats.contractsRemoved} contract${stats.contractsRemoved > 1 ? "s" : ""} removed`);
    if (stats.stubsCreated > 0) parts.push(`${stats.stubsCreated} stub${stats.stubsCreated > 1 ? "s" : ""} scaffolded`);
    console.log(`  ${GREEN}\u2713${RESET} ${parts.join(", ")}\n`);
  }

  // Regenerate types
  runBuild(rootDir);

  // Hint
  if (totalChanges > 0) {
    console.log(`\n  ${DIM}Run the linter to check implementation: npx eslint src/routes/${RESET}`);
  }
}
