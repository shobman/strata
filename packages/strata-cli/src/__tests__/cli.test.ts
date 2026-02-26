import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runInit } from "../commands/init.js";
import { runCheck } from "../commands/check.js";
import { runBuild } from "../commands/build.js";
import { runAddRoute, runAddComponent } from "../commands/add.js";
import { pathToTypeName, generateTypeFile } from "../generate/types.js";
import { buildContractTree } from "../contracts/walk.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let testDir: string;
let testCounter = 0;

function createTestDir(): string {
  testCounter++;
  const dir = join(tmpdir(), `strata-cli-cmd-test-${Date.now()}-${testCounter}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeContract(dir: string, yaml: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "_contract.yml"), yaml, "utf-8");
}

function readFile(path: string): string {
  return readFileSync(path, "utf-8");
}

// ---------------------------------------------------------------------------
// 1. strata init — creates expected file structure
// ---------------------------------------------------------------------------

describe("strata init", () => {
  beforeEach(() => {
    testDir = createTestDir();
    // Create a minimal package.json so init can add scripts
    writeFileSync(
      join(testDir, "package.json"),
      JSON.stringify({ name: "test-app", scripts: {} }, null, 2),
      "utf-8",
    );
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("creates expected file structure in a clean directory", () => {
    runInit(testDir);

    // Component contracts
    expect(existsSync(join(testDir, "components/atoms/_contract.yml"))).toBe(
      true,
    );
    expect(
      existsSync(join(testDir, "components/molecules/_contract.yml")),
    ).toBe(true);
    expect(
      existsSync(join(testDir, "components/organisms/_contract.yml")),
    ).toBe(true);

    // Route contract
    expect(existsSync(join(testDir, "routes/_contract.yml"))).toBe(true);

    // Skill file
    expect(existsSync(join(testDir, ".claude/skills/STRATA-SKILL.md"))).toBe(
      true,
    );

    // Verify contract content
    const atomContract = readFile(
      join(testDir, "components/atoms/_contract.yml"),
    );
    expect(atomContract).toContain("name: atom");
    expect(atomContract).toContain("rank: 0");

    const moleculeContract = readFile(
      join(testDir, "components/molecules/_contract.yml"),
    );
    expect(moleculeContract).toContain("name: molecule");
    expect(moleculeContract).toContain("rank: 1");

    const organismContract = readFile(
      join(testDir, "components/organisms/_contract.yml"),
    );
    expect(organismContract).toContain("name: organism");
    expect(organismContract).toContain("rank: 2");

    const routeContract = readFile(join(testDir, "routes/_contract.yml"));
    expect(routeContract).toContain("name: route");
    expect(routeContract).toContain("rank: 3");

    // Skill file has real content
    const skill = readFile(join(testDir, ".claude/skills/STRATA-SKILL.md"));
    expect(skill).toContain("Strata Skill");
    expect(skill).toContain("FillSlot");

    // Package.json has scripts
    const pkg = JSON.parse(readFile(join(testDir, "package.json")));
    expect(pkg.scripts["strata:check"]).toBe("strata check");
    expect(pkg.scripts["strata:build"]).toBe("strata build");
  });

  // ---------------------------------------------------------------------------
  // 2. strata init idempotency — running twice doesn't overwrite
  // ---------------------------------------------------------------------------

  it("is idempotent — running twice does not overwrite files", () => {
    runInit(testDir);

    // Modify a contract to verify it's not overwritten
    const contractPath = join(testDir, "routes/_contract.yml");
    const original = readFile(contractPath);
    writeFileSync(contractPath, original + "# user edit\n", "utf-8");

    runInit(testDir);

    // The modified file should still have the user edit
    const afterSecondInit = readFile(contractPath);
    expect(afterSecondInit).toContain("# user edit");

    // Package.json scripts should not be duplicated
    const pkg = JSON.parse(readFile(join(testDir, "package.json")));
    expect(pkg.scripts["strata:check"]).toBe("strata check");
  });
});

// ---------------------------------------------------------------------------
// 3. strata check — valid tree passes, invalid tree fails
// ---------------------------------------------------------------------------

describe("strata check", () => {
  beforeEach(() => {
    testDir = createTestDir();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("passes on a valid contract tree", () => {
    writeContract(
      join(testDir, "routes"),
      `
level:
  name: route
  rank: 3
layout:
  slots:
    menu: required
  redirect: funds
`,
    );

    writeContract(
      join(testDir, "routes", "funds"),
      `
level:
  name: route
  rank: 3
fills: [menu]
layout:
  default: index
`,
    );

    writeContract(
      join(testDir, "routes", "funds", "index"),
      `
level:
  name: route
  rank: 3
`,
    );

    writeContract(
      join(testDir, "components", "atoms"),
      `
level:
  name: atom
  rank: 0
`,
    );

    const result = runCheck(testDir);
    expect(result.errors).toBe(0);
  });

  it("fails with correct errors on an invalid tree", () => {
    writeContract(
      join(testDir, "routes"),
      `
level:
  name: route
  rank: 3
layout:
  slots:
    menu: required
`,
    );

    writeContract(
      join(testDir, "routes", "child"),
      `
level:
  name: route
  rank: 3
fills: [nonexistent]
`,
    );

    const result = runCheck(testDir);

    // Should have errors for: fills-reference-real-slots and required-slots-satisfied
    expect(result.errors).toBeGreaterThan(0);

    const fillErrors = result.diagnostics.filter(
      (d) => d.rule === "fills-reference-real-slots",
    );
    expect(fillErrors.length).toBeGreaterThan(0);
    expect(fillErrors[0].message).toContain("nonexistent");

    const reqErrors = result.diagnostics.filter(
      (d) => d.rule === "required-slots-satisfied",
    );
    expect(reqErrors.length).toBeGreaterThan(0);
    expect(reqErrors[0].message).toContain("menu");
  });
});

// ---------------------------------------------------------------------------
// 4. strata build — generates correct type files from a fixture tree
// ---------------------------------------------------------------------------

describe("strata build", () => {
  beforeEach(() => {
    testDir = createTestDir();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("generates correct .strata.types.ts files", () => {
    writeContract(
      join(testDir, "routes"),
      `
level:
  name: route
  rank: 3
layout:
  slots:
    menu: required
    breadcrumb:
  redirect: funds
`,
    );

    writeContract(
      join(testDir, "routes", "funds"),
      `
level:
  name: route
  rank: 3
fills: [menu]
layout:
  slots:
    actions:
  default: index
`,
    );

    writeContract(
      join(testDir, "routes", "funds", "index"),
      `
level:
  name: route
  rank: 3
`,
    );

    writeContract(
      join(testDir, "routes", "funds", "[fundId]"),
      `
param: fundId
level:
  name: route
  rank: 3
fills: [breadcrumb, actions]
layout:
  slots:
    tabs: required
    contextPanel:
  default: overview
`,
    );

    writeContract(
      join(testDir, "routes", "funds", "[fundId]", "overview"),
      `
level:
  name: route
  rank: 3
fills: [tabs]
`,
    );

    const count = runBuild(testDir);

    // Should generate types for: routes (root), funds, [fundId]
    // (overview and index have no layout.slots)
    expect(count).toBe(3);

    // Verify root type file
    const rootTypes = readFile(
      join(testDir, "routes", ".strata.types.ts"),
    );
    expect(rootTypes).toContain("AUTO-GENERATED by strata build");
    expect(rootTypes).toContain("RootSlots");
    expect(rootTypes).toContain("'menu'");
    expect(rootTypes).toContain("'breadcrumb'");
    expect(rootTypes).toContain("RootRequiredSlots");
    expect(rootTypes).toContain("RootInheritedSlots = never");

    // Verify funds type file
    const fundsTypes = readFile(
      join(testDir, "routes", "funds", ".strata.types.ts"),
    );
    expect(fundsTypes).toContain("FundsSlots");
    expect(fundsTypes).toContain("'actions'");
    expect(fundsTypes).toContain("FundsInheritedSlots");
    expect(fundsTypes).toContain("'menu'");
    expect(fundsTypes).toContain("'breadcrumb'");

    // Verify [fundId] type file
    const fundIdTypes = readFile(
      join(testDir, "routes", "funds", "[fundId]", ".strata.types.ts"),
    );
    expect(fundIdTypes).toContain("FundsFundIdSlots");
    expect(fundIdTypes).toContain("'tabs'");
    expect(fundIdTypes).toContain("'contextPanel'");
    expect(fundIdTypes).toContain("FundsFundIdRequiredSlots");
    expect(fundIdTypes).toContain("'tabs'");
    expect(fundIdTypes).toContain("FundsFundIdInheritedSlots");
    expect(fundIdTypes).toContain("'menu'");
    expect(fundIdTypes).toContain("'breadcrumb'");
    expect(fundIdTypes).toContain("'actions'");
  });
});

// ---------------------------------------------------------------------------
// 5. strata add route — creates correct contract and stubs
// ---------------------------------------------------------------------------

describe("strata add route", () => {
  beforeEach(() => {
    testDir = createTestDir();
    // Set up a minimal route tree so build works
    writeContract(
      join(testDir, "routes"),
      `
level:
  name: route
  rank: 3
layout:
  slots:
    menu:
    breadcrumb:
`,
    );
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("creates correct contract and page stub", () => {
    runAddRoute(testDir, "funds/[fundId]/compliance", {
      fills: "tabs,actions",
    });

    const contractPath = join(
      testDir,
      "routes/funds/[fundId]/compliance/_contract.yml",
    );
    expect(existsSync(contractPath)).toBe(true);

    const contract = readFile(contractPath);
    expect(contract).toContain("name: route");
    expect(contract).toContain("rank: 3");
    expect(contract).toContain("fills: [tabs, actions]");
    // compliance is not a param route, so no param field
    expect(contract).not.toContain("param:");

    const indexPath = join(
      testDir,
      "routes/funds/[fundId]/compliance/index.tsx",
    );
    expect(existsSync(indexPath)).toBe(true);

    const index = readFile(indexPath);
    expect(index).toContain("FillSlot");
    expect(index).toContain('name="tabs"');
    expect(index).toContain('name="actions"');
    expect(index).toContain("CompliancePage");
  });

  // ---------------------------------------------------------------------------
  // 6. strata add route with slots — creates _layout.tsx
  // ---------------------------------------------------------------------------

  it("creates _layout.tsx when --slots provided", () => {
    runAddRoute(testDir, "funds", {
      fills: "menu",
      slots: "actions,filters",
      default: "index",
    });

    const contractPath = join(testDir, "routes/funds/_contract.yml");
    const contract = readFile(contractPath);
    expect(contract).toContain("fills: [menu]");
    expect(contract).toContain("slots:");
    expect(contract).toContain("actions:");
    expect(contract).toContain("filters:");
    expect(contract).toContain("default: index");

    const layoutPath = join(testDir, "routes/funds/_layout.tsx");
    expect(existsSync(layoutPath)).toBe(true);

    const layout = readFile(layoutPath);
    expect(layout).toContain("SlotProvider");
    expect(layout).toContain("SlotTarget");
    expect(layout).toContain('name="actions"');
    expect(layout).toContain('name="filters"');
    expect(layout).toContain("Outlet");
    expect(layout).toContain("FundsLayout");
  });

  it("auto-detects param from bracket segment", () => {
    runAddRoute(testDir, "users/[userId]", {});

    const contractPath = join(
      testDir,
      "routes/users/[userId]/_contract.yml",
    );
    const contract = readFile(contractPath);
    expect(contract).toContain("param: userId");
  });

  it("doesn't overwrite existing files", () => {
    // Create the route first
    runAddRoute(testDir, "funds", { fills: "menu" });

    // Modify the index.tsx
    const indexPath = join(testDir, "routes/funds/index.tsx");
    writeFileSync(indexPath, "// user code\n", "utf-8");

    // Run add again
    runAddRoute(testDir, "funds", { fills: "menu" });

    // Should not overwrite
    expect(readFile(indexPath)).toBe("// user code\n");
  });
});

// ---------------------------------------------------------------------------
// strata add component
// ---------------------------------------------------------------------------

describe("strata add component", () => {
  beforeEach(() => {
    testDir = createTestDir();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("creates atom component in correct directory", () => {
    runAddComponent(testDir, "atom", "Button");

    const indexPath = join(testDir, "components/atoms/Button/index.tsx");
    expect(existsSync(indexPath)).toBe(true);

    const content = readFile(indexPath);
    expect(content).toContain("strata level: atom");
    expect(content).toContain("function Button");
  });

  it("creates molecule component in correct directory", () => {
    runAddComponent(testDir, "molecule", "SearchBar");

    const indexPath = join(testDir, "components/molecules/SearchBar/index.tsx");
    expect(existsSync(indexPath)).toBe(true);

    const content = readFile(indexPath);
    expect(content).toContain("strata level: molecule");
    expect(content).toContain("function SearchBar");
  });

  it("creates organism component in correct directory", () => {
    runAddComponent(testDir, "organism", "FundTable");

    const indexPath = join(
      testDir,
      "components/organisms/FundTable/index.tsx",
    );
    expect(existsSync(indexPath)).toBe(true);

    const content = readFile(indexPath);
    expect(content).toContain("strata level: organism");
    expect(content).toContain("function FundTable");
  });

  it("creates level contract if missing", () => {
    runAddComponent(testDir, "atom", "Input");

    const contractPath = join(testDir, "components/atoms/_contract.yml");
    expect(existsSync(contractPath)).toBe(true);

    const contract = readFile(contractPath);
    expect(contract).toContain("name: atom");
    expect(contract).toContain("rank: 0");
  });
});

// ---------------------------------------------------------------------------
// 7. Type name generation — PascalCase edge cases
// ---------------------------------------------------------------------------

describe("pathToTypeName", () => {
  const routesDir = "/project/routes";

  it("returns Root for the routes directory itself", () => {
    expect(pathToTypeName("/project/routes", routesDir)).toBe("Root");
  });

  it("converts simple segment", () => {
    expect(pathToTypeName("/project/routes/funds", routesDir)).toBe("Funds");
  });

  it("converts nested path", () => {
    expect(
      pathToTypeName("/project/routes/funds/[fundId]", routesDir),
    ).toBe("FundsFundId");
  });

  it("converts deep nested path", () => {
    expect(
      pathToTypeName(
        "/project/routes/funds/[fundId]/overview",
        routesDir,
      ),
    ).toBe("FundsFundIdOverview");
  });

  it("handles kebab-case segments", () => {
    expect(
      pathToTypeName("/project/routes/fund-detail", routesDir),
    ).toBe("FundDetail");
  });

  it("handles multiple brackets", () => {
    expect(
      pathToTypeName(
        "/project/routes/funds/[fundId]/holdings/[holdingId]",
        routesDir,
      ),
    ).toBe("FundsFundIdHoldingsHoldingId");
  });

  it("handles Windows-style paths", () => {
    expect(
      pathToTypeName("C:\\project\\routes\\funds", "C:\\project\\routes"),
    ).toBe("Funds");
  });
});

// ---------------------------------------------------------------------------
// generateTypeFile — correct unions
// ---------------------------------------------------------------------------

describe("generateTypeFile", () => {
  beforeEach(() => {
    testDir = createTestDir();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("generates correct type unions with inherited slots", () => {
    writeContract(
      join(testDir, "routes"),
      `
level:
  name: route
  rank: 3
layout:
  slots:
    menu: required
    breadcrumb:
`,
    );

    writeContract(
      join(testDir, "routes", "funds"),
      `
level:
  name: route
  rank: 3
fills: [menu]
`,
    );

    writeContract(
      join(testDir, "routes", "funds", "[fundId]"),
      `
param: fundId
level:
  name: route
  rank: 3
fills: [breadcrumb]
layout:
  slots:
    tabs: required
    contextPanel:
`,
    );

    const tree = buildContractTree(testDir);
    const fundId = tree.routes!.children
      .get("funds")!
      .children.get("[fundId]")!;
    const routesDir = join(testDir, "routes");

    const content = generateTypeFile(fundId, routesDir);

    expect(content).toContain("FundsFundIdSlots = 'tabs' | 'contextPanel'");
    expect(content).toContain("FundsFundIdRequiredSlots = 'tabs'");
    expect(content).toContain("FundsFundIdInheritedSlots = 'menu' | 'breadcrumb'");
    expect(content).toContain(
      "FundsFundIdAllSlots = FundsFundIdSlots | FundsFundIdInheritedSlots",
    );
  });

  it("uses never for empty slot categories", () => {
    writeContract(
      join(testDir, "routes"),
      `
level:
  name: route
  rank: 3
layout:
  slots:
    menu:
`,
    );

    const tree = buildContractTree(testDir);
    const routesDir = join(testDir, "routes");
    const content = generateTypeFile(tree.routes!, routesDir);

    expect(content).toContain("RootSlots = 'menu'");
    expect(content).toContain("RootRequiredSlots = never");
    expect(content).toContain("RootInheritedSlots = never");
  });
});

// ---------------------------------------------------------------------------
// 8. Integration: init → add routes → check → build → verify types
// ---------------------------------------------------------------------------

describe("integration: init → add → check → build", () => {
  beforeEach(() => {
    testDir = createTestDir();
    writeFileSync(
      join(testDir, "package.json"),
      JSON.stringify({ name: "test-app", scripts: {} }, null, 2),
      "utf-8",
    );
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("full workflow produces correct types and passes check", () => {
    // 1. Init
    runInit(testDir);

    // Verify init created everything
    expect(existsSync(join(testDir, "routes/_contract.yml"))).toBe(true);
    expect(existsSync(join(testDir, "components/atoms/_contract.yml"))).toBe(
      true,
    );

    // 2. Add root layout slots (overwrite the basic contract)
    writeFileSync(
      join(testDir, "routes/_contract.yml"),
      `level:
  name: route
  rank: 3
layout:
  slots:
    menu: required
    breadcrumb:
  redirect: funds
`,
      "utf-8",
    );

    // 3. Add routes
    runAddRoute(testDir, "funds", {
      fills: "menu",
      slots: "actions",
      default: "index",
    });

    runAddRoute(testDir, "funds/index", {});

    runAddRoute(testDir, "funds/[fundId]", {
      fills: "breadcrumb,actions",
      slots: "tabs,contextPanel",
      default: "overview",
    });

    runAddRoute(testDir, "funds/[fundId]/overview", {
      fills: "tabs",
    });

    // 4. Check — should pass with no errors
    const checkResult = runCheck(testDir);
    expect(checkResult.errors).toBe(0);

    // 5. Build — should generate type files
    const buildCount = runBuild(testDir);
    expect(buildCount).toBeGreaterThan(0);

    // 6. Verify generated types for root
    const rootTypes = readFile(join(testDir, "routes/.strata.types.ts"));
    expect(rootTypes).toContain("RootSlots");
    expect(rootTypes).toContain("'menu'");

    // 7. Verify generated types for [fundId]
    const fundIdTypes = readFile(
      join(testDir, "routes/funds/[fundId]/.strata.types.ts"),
    );
    expect(fundIdTypes).toContain("FundsFundIdSlots");
    expect(fundIdTypes).toContain("'tabs'");
    expect(fundIdTypes).toContain("'contextPanel'");
    expect(fundIdTypes).toContain("FundsFundIdInheritedSlots");
    // Inherited from root and funds
    expect(fundIdTypes).toContain("'menu'");
    expect(fundIdTypes).toContain("'breadcrumb'");
    expect(fundIdTypes).toContain("'actions'");

    // 8. Verify stubs look right
    const overviewIndex = readFile(
      join(testDir, "routes/funds/[fundId]/overview/index.tsx"),
    );
    expect(overviewIndex).toContain("FillSlot");
    expect(overviewIndex).toContain('name="tabs"');

    const fundIdLayout = readFile(
      join(testDir, "routes/funds/[fundId]/_layout.tsx"),
    );
    expect(fundIdLayout).toContain("SlotProvider");
    expect(fundIdLayout).toContain('name="tabs"');
    expect(fundIdLayout).toContain('name="contextPanel"');
    expect(fundIdLayout).toContain("Outlet");
  });
});
