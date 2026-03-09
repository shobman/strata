import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { URL } from "node:url";

/**
 * Vite plugin: serves and saves tree.json for a project.
 *
 * GET  /api/tree?project=/path/to/project  → reads <project>/tree.json
 * POST /api/tree?project=/path/to/project  → writes <project>/tree.json
 */
function projectTreePlugin() {
  return {
    name: "project-tree",
    configureServer(server) {
      server.middlewares.use("/api/tree", (req, res, next) => {
        const url = new URL(req.url, "http://localhost");
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
            res.end(JSON.stringify({ error: "tree.json not found in project" }));
            return;
          }
          const data = readFileSync(treePath, "utf-8");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(data);
          return;
        }

        if (req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => (body += chunk));
          req.on("end", () => {
            try {
              const data = JSON.parse(body);
              writeFileSync(treePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ ok: true }));
            } catch (e) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [projectTreePlugin(), react()],
  server: { port: 5174 },
});
