import { existsSync, readFileSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { buildContractTree } from "../contracts/walk.js";
import { validate } from "../contracts/validate.js";
import type { Diagnostic } from "../contracts/types.js";

// ANSI colours
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

/**
 * Walk up from startDir looking for the project root.
 * Checks for package.json with strata dependency, then pnpm-workspace.yaml.
 */
export function findProjectRoot(startDir: string): string {
  let dir = startDir;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Check for package.json with strata dependency
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        const allDeps = {
          ...pkg.dependencies,
          ...pkg.devDependencies,
        } as Record<string, string>;
        if (allDeps["@shobman/strata-cli"] || allDeps["@shobman/strata-ui"]) {
          return dir;
        }
      } catch {
        // Ignore parse errors, keep walking
      }
    }

    // Check for pnpm-workspace.yaml
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return startDir;
}

/**
 * Run `strata check` — validate all contracts.
 * Returns { errors, warnings } counts for testing.
 */
export function runCheck(rootDir: string): {
  errors: number;
  warnings: number;
  diagnostics: Diagnostic[];
} {
  console.log(`\n${BOLD}strata check${RESET}\n`);

  const tree = buildContractTree(rootDir);

  if (!tree.routes && tree.components.length === 0) {
    console.log(
      `  ${YELLOW}No contracts found.${RESET} Run ${BOLD}strata init${RESET} first.\n`,
    );
    return { errors: 0, warnings: 0, diagnostics: [] };
  }

  const diagnostics = validate(tree);
  const errors = diagnostics.filter((d) => d.level === "error");
  const warnings = diagnostics.filter((d) => d.level === "warn");

  if (errors.length > 0) {
    for (const diag of errors) {
      const relFile = relative(rootDir, diag.file);
      console.log(`  ${RED}\u2717${RESET} ${relFile}`);
      console.log(
        `    ${DIM}${diag.rule}:${RESET} ${diag.message}`,
      );
    }
  }

  if (warnings.length > 0) {
    for (const diag of warnings) {
      const relFile = relative(rootDir, diag.file);
      console.log(`  ${YELLOW}\u26a0${RESET} ${relFile}`);
      console.log(
        `    ${DIM}${diag.rule}:${RESET} ${diag.message}`,
      );
    }
  }

  console.log("");

  if (errors.length === 0 && warnings.length === 0) {
    console.log(`  ${GREEN}\u2713 All checks passed${RESET}\n`);
  } else if (errors.length === 0) {
    console.log(
      `  ${GREEN}\u2713 All checks passed${RESET} ${DIM}(${warnings.length} warning${warnings.length === 1 ? "" : "s"})${RESET}\n`,
    );
  } else {
    console.log(
      `  ${RED}\u2717 ${errors.length} error${errors.length === 1 ? "" : "s"}${RESET}${
        warnings.length > 0
          ? `, ${YELLOW}${warnings.length} warning${warnings.length === 1 ? "" : "s"}${RESET}`
          : ""
      }\n`,
    );
  }

  return {
    errors: errors.length,
    warnings: warnings.length,
    diagnostics,
  };
}
