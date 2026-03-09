import { relative } from "node:path";
import { buildContractTree } from "../contracts/walk.js";
import type { ContractNode } from "../contracts/types.js";

// ANSI colours
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

/**
 * Shape matching strata-architect's tree node format.
 */
interface ArchitectNode {
  id: string;
  name: string;
  param: string | null;
  slots: { name: string; required: boolean }[];
  fills: string[];
  defaultChild: string | null;
  redirectChild: string | null;
  children: ArchitectNode[];
}

/**
 * Convert a ContractNode tree into the Architect's JSON shape.
 * `routesRoot` is the absolute path of the routes/ directory, used to create
 * relative IDs (e.g. "devices/[id]" instead of full filesystem paths).
 */
function toArchitectNode(node: ContractNode, routesRoot?: string): ArchitectNode {
  const slots = node.contract.layout?.slots
    ? Object.entries(node.contract.layout.slots).map(([name, value]) => ({
        name,
        required: value === "required",
      }))
    : [];

  const fills = node.contract.fills ?? [];

  const root = routesRoot ?? node.path;
  const relPath = (p: string) => relative(root, p).replace(/\\/g, "/") || "/";

  // Resolve default/redirect child IDs by matching child folder names
  let defaultChild: string | null = null;
  let redirectChild: string | null = null;

  if (node.contract.layout?.default) {
    const target = node.children.get(node.contract.layout.default);
    if (target) defaultChild = relPath(target.path);
  }

  if (node.contract.layout?.redirect) {
    const target = node.children.get(node.contract.layout.redirect);
    if (target) redirectChild = relPath(target.path);
  }

  const children = [...node.children.values()].map(c => toArchitectNode(c, root));

  return {
    id: relPath(node.path),
    name: node.name === "routes" ? "Root Layout" : node.name,
    param: node.contract.param ?? null,
    slots,
    fills,
    defaultChild,
    redirectChild,
    children,
  };
}

/**
 * Run `strata tree` — output the route tree as JSON for strata-architect.
 */
export function runTree(rootDir: string, json: boolean): void {
  const tree = buildContractTree(rootDir);

  if (!tree.routes) {
    console.error("No route contracts found. Run strata init first.");
    process.exit(1);
  }

  const architectTree = toArchitectNode(tree.routes);

  if (json) {
    console.log(JSON.stringify(architectTree, null, 2));
  } else {
    console.log(`\n${BOLD}strata tree${RESET}\n`);
    printTree(architectTree, "", "");
    console.log("");
  }
}

function describeNode(node: ArchitectNode): string {
  const parts: string[] = [];
  if (node.slots.length > 0) {
    parts.push(`slots: [${node.slots.map(s => s.required ? `${s.name}*` : s.name).join(", ")}]`);
  }
  if (node.fills.length > 0) {
    parts.push(`fills: [${node.fills.join(", ")}]`);
  }
  if (node.redirectChild) {
    const child = node.children.find(c => c.id === node.redirectChild);
    parts.push(`redirect \u2192 ${child?.name ?? "?"}`);
  }
  if (node.defaultChild) {
    const child = node.children.find(c => c.id === node.defaultChild);
    parts.push(`default \u2192 ${child?.name ?? "?"}`);
  }
  return parts.length > 0 ? `  ${parts.join("  ")}` : "";
}

/**
 * Pretty-print the route tree to the terminal.
 */
function printTree(node: ArchitectNode, prefix: string, childPrefix: string): void {
  console.log(`${prefix}${node.name}${describeNode(node)}`);

  for (let i = 0; i < node.children.length; i++) {
    const isLast = i === node.children.length - 1;
    printTree(
      node.children[i],
      `${childPrefix}${isLast ? "\u2514\u2500\u2500 " : "\u251c\u2500\u2500 "}`,
      `${childPrefix}${isLast ? "    " : "\u2502   "}`,
    );
  }
}
