import { writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { buildContractTree } from "../contracts/walk.js";
import { generateAllTypes } from "../generate/types.js";

// ANSI colours
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

/**
 * Run `strata build` — generate .strata.types.ts files from contracts.
 * Returns the number of files generated.
 */
export function runBuild(rootDir: string): number {
  console.log(`\n${BOLD}strata build${RESET}\n`);

  const tree = buildContractTree(rootDir);
  const routesDir = join(rootDir, "routes");

  if (!tree.routes) {
    console.log(
      `  ${YELLOW}No route contracts found.${RESET} Run ${BOLD}strata init${RESET} first.\n`,
    );
    return 0;
  }

  const typeFiles = generateAllTypes(tree, routesDir);

  for (const file of typeFiles) {
    writeFileSync(file.path, file.content, "utf-8");
    const relPath = relative(rootDir, file.path);
    console.log(`  ${GREEN}\u2713${RESET} ${relPath}`);
  }

  console.log(
    `\n  ${GREEN}\u2713 Generated ${typeFiles.length} type file${typeFiles.length === 1 ? "" : "s"}${RESET}\n`,
  );

  return typeFiles.length;
}
