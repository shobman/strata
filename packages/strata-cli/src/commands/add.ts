import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  routeContractYaml,
  componentContractYaml,
  pageStub,
  layoutStub,
  componentStub,
} from "../templates/stubs.js";
import { runBuild } from "./build.js";

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
 * Convert a folder name to a PascalCase component name.
 * [fundId] → FundId, compliance → Compliance, fund-detail → FundDetail
 */
function toPascalCase(segment: string): string {
  const cleaned = segment.replace(/[[\]]/g, "");
  return cleaned
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export interface AddRouteOptions {
  fills?: string;
  slots?: string;
  default?: string;
  redirect?: string;
  param?: string;
}

/**
 * Run `strata add route <path>`.
 *
 * Creates the route folder, _contract.yml, index.tsx, and optionally _layout.tsx.
 * Then runs strata build.
 */
export function runAddRoute(
  rootDir: string,
  routePath: string,
  options: AddRouteOptions,
): void {
  const segments = routePath.replace(/\\/g, "/").split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  const componentName = toPascalCase(lastSegment);

  console.log(`\n${BOLD}strata add route${RESET} ${routePath}\n`);

  const fullDir = join(rootDir, "routes", ...segments);
  mkdirSync(fullDir, { recursive: true });

  // Auto-detect param from bracket segment
  let param = options.param;
  if (!param && lastSegment.startsWith("[") && lastSegment.endsWith("]")) {
    param = lastSegment.slice(1, -1);
  }

  // Parse comma-separated options
  const fills = options.fills
    ? options.fills.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const slots = options.slots
    ? options.slots.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  // 1. Create _contract.yml
  const contractPath = join(fullDir, "_contract.yml");
  if (existsSync(contractPath)) {
    logExists(`routes/${segments.join("/")}/_contract.yml`);
  } else {
    const yaml = routeContractYaml({
      param,
      fills: fills.length > 0 ? fills : undefined,
      slots: slots.length > 0 ? slots : undefined,
      default: options.default,
      redirect: options.redirect,
    });
    writeFileSync(contractPath, yaml, "utf-8");
    logCreated(`routes/${segments.join("/")}/_contract.yml`);
  }

  // 2. Create index.tsx stub (with FillSlot boilerplate)
  const indexPath = join(fullDir, "index.tsx");
  if (existsSync(indexPath)) {
    logExists(`routes/${segments.join("/")}/index.tsx`);
  } else {
    writeFileSync(indexPath, pageStub(componentName, fills), "utf-8");
    logCreated(`routes/${segments.join("/")}/index.tsx`);
  }

  // 3. If --slots provided, create _layout.tsx
  if (slots.length > 0) {
    const layoutPath = join(fullDir, "_layout.tsx");
    if (existsSync(layoutPath)) {
      logExists(`routes/${segments.join("/")}/_layout.tsx`);
    } else {
      writeFileSync(layoutPath, layoutStub(componentName, slots), "utf-8");
      logCreated(`routes/${segments.join("/")}/_layout.tsx`);
    }
  }

  // 4. Run strata build
  console.log("");
  runBuild(rootDir);
}

/**
 * Run `strata add atom|molecule|organism <Name>`.
 *
 * Creates the component directory and files.
 */
export function runAddComponent(
  rootDir: string,
  level: "atom" | "molecule" | "organism",
  name: string,
): void {
  const levelDir = level + "s"; // atom → atoms, molecule → molecules, etc.
  const componentDir = join(rootDir, "components", levelDir, name);

  console.log(`\n${BOLD}strata add ${level}${RESET} ${name}\n`);

  mkdirSync(componentDir, { recursive: true });

  // Create _contract.yml for the component level directory (if missing)
  const levelContractPath = join(
    rootDir,
    "components",
    levelDir,
    "_contract.yml",
  );
  if (!existsSync(levelContractPath)) {
    writeFileSync(levelContractPath, componentContractYaml(level), "utf-8");
    logCreated(`components/${levelDir}/_contract.yml`);
  }

  // Create component index.tsx
  const indexPath = join(componentDir, "index.tsx");
  if (existsSync(indexPath)) {
    logExists(`components/${levelDir}/${name}/index.tsx`);
  } else {
    writeFileSync(indexPath, componentStub(name, level), "utf-8");
    logCreated(`components/${levelDir}/${name}/index.tsx`);
  }

  console.log("");
}
