import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, relative, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { buildContractTree } from "../contracts/walk.js";
import type { ContractNode } from "../contracts/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
};

/**
 * Run `strata architect` — generate tree.json, start a lightweight HTTP server
 * serving the pre-built architect UI, and open the browser.
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

  // 2. Locate the pre-built UI files (bundled in dist/architect-ui/)
  const uiDir = join(__dirname, "architect-ui");
  if (!existsSync(join(uiDir, "index.html"))) {
    console.error("Architect UI files not found. Rebuild strata-cli.");
    process.exit(1);
  }

  const projectPath = resolve(rootDir);

  // 3. Start HTTP server
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    // API: GET/POST /api/tree?project=...
    if (url.pathname === "/api/tree") {
      const project = url.searchParams.get("project");
      if (!project) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing ?project= parameter" }));
        return;
      }

      const treePath = join(project, "tree.json");

      if (req.method === "GET") {
        if (!existsSync(treePath)) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "tree.json not found" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(readFileSync(treePath, "utf-8"));
        return;
      }

      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk: Buffer) => (body += chunk));
        req.on("end", () => {
          try {
            const data = JSON.parse(body);
            writeFileSync(treePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: (e as Error).message }));
          }
        });
        return;
      }
    }

    // Static files: serve from architect-ui/
    let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const fullPath = join(uiDir, filePath);

    if (!existsSync(fullPath)) {
      // SPA fallback — serve index.html for any unknown path
      const indexPath = join(uiDir, "index.html");
      const content = readFileSync(indexPath, "utf-8");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(content);
      return;
    }

    const ext = extname(fullPath);
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(readFileSync(fullPath));
  });

  // Find an available port starting from 5174
  let port = 5174;
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      port++;
      server.listen(port);
    }
  });

  server.on("listening", () => {
    const url = `http://localhost:${port}/?project=${encodeURIComponent(projectPath)}`;
    console.log(`  Serving at ${url}\n`);

    // Open browser
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

    console.log(`  Press Ctrl+C to stop\n`);
  });

  server.listen(port);
}
