import { Command } from "commander";
import { runInit } from "./commands/init.js";
import { runCheck, findProjectRoot } from "./commands/check.js";
import { runBuild } from "./commands/build.js";
import { runAddRoute, runAddComponent } from "./commands/add.js";
import type { AddRouteOptions } from "./commands/add.js";
import { runTree } from "./commands/tree.js";
import { runSync } from "./commands/sync.js";
import { runArchitect } from "./commands/architect.js";

const COMPONENT_LEVELS = ["atom", "molecule", "organism"] as const;

const program = new Command();

program
  .name("strata")
  .description("Strata layout protocol CLI — contracts, scaffolding, and validation")
  .version("0.1.0");

// ---------------------------------------------------------------------------
// strata init
// ---------------------------------------------------------------------------

program
  .command("init")
  .description("Initialise a project with Strata contracts and skill file")
  .action(() => {
    runInit(process.cwd());
  });

// ---------------------------------------------------------------------------
// strata check
// ---------------------------------------------------------------------------

program
  .command("check")
  .description("Validate all contracts (reads YAML only, no source code)")
  .action(() => {
    const root = findProjectRoot(process.cwd());
    const result = runCheck(root);
    if (result.errors > 0) {
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// strata build
// ---------------------------------------------------------------------------

program
  .command("build")
  .description("Generate .strata.types.ts files from YAML contracts")
  .action(() => {
    const root = findProjectRoot(process.cwd());
    runBuild(root);
  });

// ---------------------------------------------------------------------------
// strata tree
// ---------------------------------------------------------------------------

program
  .command("tree")
  .description("Display the route/slot tree (--json for strata-architect format)")
  .option("--json", "Output as JSON for strata-architect")
  .action((options: { json?: boolean }) => {
    const root = findProjectRoot(process.cwd());
    runTree(root, !!options.json);
  });

// ---------------------------------------------------------------------------
// strata sync
// ---------------------------------------------------------------------------

program
  .command("sync <file>")
  .description("Sync a tree.json file to route contracts and stubs")
  .action((file: string) => {
    const root = findProjectRoot(process.cwd());
    runSync(root, file);
  });

// ---------------------------------------------------------------------------
// strata architect
// ---------------------------------------------------------------------------

program
  .command("architect")
  .description("Open the visual route/slot architect in the browser")
  .action(() => {
    const root = findProjectRoot(process.cwd());
    runArchitect(root);
  });

// ---------------------------------------------------------------------------
// strata add route|atom|molecule|organism
// ---------------------------------------------------------------------------

const addCmd = program
  .command("add")
  .description("Scaffold new routes and components");

addCmd
  .command("route <path>")
  .description("Scaffold a new route with contract and stubs")
  .option("--fills <slots>", "Comma-separated slot names this route fills")
  .option("--slots <slots>", "Comma-separated slot names this layout declares")
  .option("--default <child>", "Child name that renders at this route's URL")
  .option("--redirect <child>", "Child name that this route redirects to")
  .option("--param <name>", "Route parameter name (auto-detected from brackets)")
  .action((routePath: string, options: AddRouteOptions) => {
    const root = findProjectRoot(process.cwd());
    runAddRoute(root, routePath, options);
  });

for (const level of COMPONENT_LEVELS) {
  addCmd
    .command(`${level} <name>`)
    .description(`Scaffold a new ${level} component`)
    .action((name: string) => {
      const root = findProjectRoot(process.cwd());
      runAddComponent(root, level, name);
    });
}

program.parse();
