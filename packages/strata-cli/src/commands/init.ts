import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { componentContractYaml, routeContractYaml } from "../templates/stubs.js";
import { SKILL_CONTENT } from "../templates/skill-content.js";

// ANSI colours
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function logCreated(path: string): void {
  console.log(`  ${GREEN}\u2713${RESET} Created ${path}`);
}

function logExists(path: string): void {
  console.log(`  ${YELLOW}\u2022${RESET} Already exists ${path}`);
}

/**
 * Create a file if it doesn't exist. Returns true if created, false if already present.
 */
function ensureFile(filePath: string, content: string, label: string): boolean {
  if (existsSync(filePath)) {
    logExists(label);
    return false;
  }
  mkdirSync(join(filePath, ".."), { recursive: true });
  writeFileSync(filePath, content, "utf-8");
  logCreated(label);
  return true;
}

/**
 * Detect the source root directory. If `src/` exists, scaffold inside it.
 * Otherwise scaffold at the project root (greenfield projects).
 */
function detectSourceRoot(rootDir: string): string {
  const srcDir = join(rootDir, "src");
  if (existsSync(srcDir)) {
    return srcDir;
  }
  return rootDir;
}

/**
 * Run `strata init` in the given root directory.
 * Idempotent — doesn't overwrite existing files.
 *
 * Detects existing `src/` directories and scaffolds inside them,
 * supporting both greenfield and existing projects.
 */
export function runInit(rootDir: string): void {
  console.log(`\n${BOLD}strata init${RESET}\n`);

  const sourceRoot = detectSourceRoot(rootDir);
  const isInsideSrc = sourceRoot !== rootDir;

  if (isInsideSrc) {
    console.log(`  Detected ${BOLD}src/${RESET} directory — scaffolding inside it\n`);
  }

  // 1. Component directories with contracts
  const components: Array<{
    dir: string;
    level: "atom" | "molecule" | "organism";
  }> = [
    { dir: "components/atoms", level: "atom" },
    { dir: "components/molecules", level: "molecule" },
    { dir: "components/organisms", level: "organism" },
  ];

  for (const { dir, level } of components) {
    const dirPath = join(sourceRoot, dir);
    mkdirSync(dirPath, { recursive: true });
    ensureFile(
      join(dirPath, "_contract.yml"),
      componentContractYaml(level),
      `${isInsideSrc ? "src/" : ""}${dir}/_contract.yml`,
    );
  }

  // 2. Routes root contract
  const routesDir = join(sourceRoot, "routes");
  mkdirSync(routesDir, { recursive: true });
  ensureFile(
    join(routesDir, "_contract.yml"),
    routeContractYaml({}),
    `${isInsideSrc ? "src/" : ""}routes/_contract.yml`,
  );

  // 3. Skill file → .claude/skills/STRATA-SKILL.md
  const skillDir = join(rootDir, ".claude", "skills");
  mkdirSync(skillDir, { recursive: true });
  ensureFile(
    join(skillDir, "STRATA-SKILL.md"),
    SKILL_CONTENT,
    ".claude/skills/STRATA-SKILL.md",
  );

  // 4. Add scripts to package.json
  const pkgPath = join(rootDir, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const raw = readFileSync(pkgPath, "utf-8");
      const pkg = JSON.parse(raw);
      const scripts = pkg.scripts ?? {};
      let changed = false;

      if (!scripts["strata:check"]) {
        scripts["strata:check"] = "strata check";
        changed = true;
      }
      if (!scripts["strata:build"]) {
        scripts["strata:build"] = "strata build";
        changed = true;
      }

      if (changed) {
        pkg.scripts = scripts;
        writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
        logCreated("strata scripts in package.json");
      } else {
        logExists("strata scripts in package.json");
      }
    } catch {
      console.log(
        `  ${YELLOW}\u2022${RESET} Could not update package.json (parse error)`,
      );
    }
  } else {
    console.log(
      `  ${YELLOW}\u2022${RESET} No package.json found — skipping script addition`,
    );
  }

  console.log(
    `\n${GREEN}Done!${RESET} Run ${BOLD}strata check${RESET} to validate your contracts.\n`,
  );
}
