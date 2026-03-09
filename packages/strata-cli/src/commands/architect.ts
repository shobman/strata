import { existsSync, writeFileSync } from "node:fs";
import { join, resolve, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { buildContractTree } from "../contracts/walk.js";
import type { ContractNode } from "../contracts/types.js";

// ANSI colours
const GREEN = "\x1b[32m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

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

function toArchitectNode(node: ContractNode, routesRoot?: string): ArchitectNode {
  const slots = node.contract.layout?.slots
    ? Object.entries(node.contract.layout.slots).map(([name, value]) => ({
        name,
        required: value === "required",
      }))
    : [];

  const fills = node.contract.fills ?? [];
  const root = routesRoot ?? node.path;
  const relPath = (p: string) =>
    relative(root, p).replace(/\\/g, "/") || "/";

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

  const children = [...node.children.values()].map((c) =>
    toArchitectNode(c, root),
  );

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
 * Find the strata-architect package directory.
 * Looks for it as a sibling package (monorepo) or in node_modules.
 */
function findArchitectDir(): string | null {
  // Sibling package in monorepo
  const monorepo = join(__dirname, "..", "..", "strata-architect");
  if (existsSync(join(monorepo, "package.json"))) return monorepo;

  // Installed as a package
  try {
    const resolved = require.resolve("@shobman/strata-architect/package.json");
    return join(resolved, "..");
  } catch {
    return null;
  }
}

/**
 * Run `strata architect` — generate tree.json, start the architect dev server,
 * and open the browser.
 */
export function runArchitect(rootDir: string): void {
  console.log(`\n${BOLD}strata architect${RESET}\n`);

  // 1. Generate tree.json in the project root
  const tree = buildContractTree(rootDir);
  if (!tree.routes) {
    console.error("No route contracts found. Run strata init first.");
    process.exit(1);
  }

  const architectTree = toArchitectNode(tree.routes);
  const treeFile = join(rootDir, "tree.json");
  writeFileSync(treeFile, JSON.stringify(architectTree, null, 2) + "\n", "utf-8");
  console.log(`  ${GREEN}\u2713${RESET} Generated tree.json`);

  // 2. Find the architect package
  const architectDir = findArchitectDir();
  if (!architectDir) {
    console.error(
      "strata-architect package not found.\n" +
      "Install it or ensure it exists as a sibling package.",
    );
    process.exit(1);
  }

  // 3. Check if deps are installed
  if (!existsSync(join(architectDir, "node_modules"))) {
    console.log("  Installing architect dependencies...");
    execSync("npm install", { cwd: architectDir, stdio: "inherit" });
  }

  // 4. Start Vite dev server and capture the port from output
  const projectPath = resolve(rootDir);

  const vite = spawn("npx", ["vite"], {
    cwd: architectDir,
    stdio: ["inherit", "pipe", "pipe"],
    shell: true,
  });

  let browserOpened = false;

  function handleOutput(chunk: Buffer): void {
    const text = chunk.toString();
    process.stdout.write(text);

    // Strip ANSI codes and parse the port from Vite's output
    if (!browserOpened) {
      const stripped = text.replace(/\x1b\[[0-9;]*m/g, "");
      const match = stripped.match(/localhost:(\d+)/);
      if (match) {
        browserOpened = true;
        const port = match[1];
        const url = `http://localhost:${port}/?project=${encodeURIComponent(projectPath)}`;
        console.log(`\n  Opening ${url}\n`);

        // Windows `start` needs an empty title argument before the URL
        if (process.platform === "win32") {
          try {
            execSync(`start "" "${url}"`, { stdio: "ignore" });
          } catch {
            console.log(`  Open manually: ${url}`);
          }
        } else {
          const openCmd = process.platform === "darwin" ? "open" : "xdg-open";
          try {
            execSync(`${openCmd} "${url}"`, { stdio: "ignore" });
          } catch {
            console.log(`  Open manually: ${url}`);
          }
        }
      }
    }
  }

  vite.stdout!.on("data", handleOutput);
  vite.stderr!.on("data", handleOutput);

  // Keep running until user kills it
  vite.on("close", (code) => {
    process.exit(code ?? 0);
  });
}
