import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  parseContractYaml,
  ContractParseError,
  buildContractTree,
  collectAllNodes,
  validate,
  resolveAvailableSlots,
  resolveAncestorSlots,
  isSlotFilledInChain,
} from "../contracts/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let testDir: string;
let testCounter = 0;

function createTestDir(): string {
  testCounter++;
  const dir = join(
    tmpdir(),
    `strata-cli-test-${Date.now()}-${testCounter}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeContract(dir: string, yaml: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "_contract.yml"), yaml, "utf-8");
}

// ---------------------------------------------------------------------------
// 1. Parse a valid route contract YAML string
// ---------------------------------------------------------------------------

describe("parseContractYaml", () => {
  it("parses a valid route contract", () => {
    const yaml = `
param: fundId
level:
  name: route
  rank: 3
fills: [breadcrumb, actions, tabs]
layout:
  slots:
    tabs: required
    contextPanel:
  default: overview
`;
    const result = parseContractYaml(yaml, "test.yml");

    expect(result.param).toBe("fundId");
    expect(result.level).toEqual({ name: "route", rank: 3 });
    expect(result.fills).toEqual(["breadcrumb", "actions", "tabs"]);
    expect(result.layout).toEqual({
      slots: { tabs: "required", contextPanel: null },
      default: "overview",
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Parse a valid component contract YAML string
  // ---------------------------------------------------------------------------

  it("parses a valid component contract", () => {
    const yaml = `
level:
  name: molecule
  rank: 1
`;
    const result = parseContractYaml(yaml, "test.yml");

    expect(result.level).toEqual({ name: "molecule", rank: 1 });
    expect(result.param).toBeUndefined();
    expect(result.fills).toBeUndefined();
    expect(result.layout).toBeUndefined();
  });

  it("parses an atom contract", () => {
    const yaml = `
level:
  name: atom
  rank: 0
`;
    const result = parseContractYaml(yaml, "test.yml");
    expect(result.level).toEqual({ name: "atom", rank: 0 });
  });

  it("parses a contract with canImport override", () => {
    const yaml = `
level:
  name: organism
  rank: 2
  canImport: [atom, molecule]
`;
    const result = parseContractYaml(yaml, "test.yml");
    expect(result.level.canImport).toEqual(["atom", "molecule"]);
  });

  it("parses a contract with variants", () => {
    const yaml = `
level:
  name: route
  rank: 3
variants: [flagship, standard]
default: standard
resolve: fund.isFlagship
`;
    const result = parseContractYaml(yaml, "test.yml");
    expect(result.variants).toEqual(["flagship", "standard"]);
    expect(result.default).toBe("standard");
    expect(result.resolve).toBe("fund.isFlagship");
  });

  it("parses a contract with layout.redirect", () => {
    const yaml = `
level:
  name: route
  rank: 3
layout:
  redirect: index
`;
    const result = parseContractYaml(yaml, "test.yml");
    expect(result.layout?.redirect).toBe("index");
    expect(result.layout?.default).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // 3. Parse invalid YAML → meaningful error
  // ---------------------------------------------------------------------------

  it("throws on invalid YAML syntax", () => {
    const yaml = `
level:
  name: route
  rank: [[[invalid
`;
    expect(() => parseContractYaml(yaml, "bad.yml")).toThrow(
      ContractParseError,
    );
    expect(() => parseContractYaml(yaml, "bad.yml")).toThrow("Invalid YAML");
  });

  it("throws when level is missing", () => {
    const yaml = `
fills: [menu]
`;
    expect(() => parseContractYaml(yaml, "bad.yml")).toThrow(
      "Missing required field: level",
    );
  });

  it("throws when level.name is invalid", () => {
    const yaml = `
level:
  name: template
  rank: 3
`;
    expect(() => parseContractYaml(yaml, "bad.yml")).toThrow(
      'Invalid level.name: "template"',
    );
  });

  it("throws when level.rank is invalid", () => {
    const yaml = `
level:
  name: route
  rank: 5
`;
    expect(() => parseContractYaml(yaml, "bad.yml")).toThrow(
      "Invalid level.rank: 5",
    );
  });

  it("throws when fills is not an array of strings", () => {
    const yaml = `
level:
  name: route
  rank: 3
fills: not-an-array
`;
    expect(() => parseContractYaml(yaml, "bad.yml")).toThrow(
      "fills must be an array",
    );
  });

  it("throws when slot value is invalid", () => {
    const yaml = `
level:
  name: route
  rank: 3
layout:
  slots:
    menu: optional
`;
    expect(() => parseContractYaml(yaml, "bad.yml")).toThrow(
      'Invalid slot value for "menu"',
    );
  });

  it("throws on empty / null YAML", () => {
    expect(() => parseContractYaml("", "empty.yml")).toThrow(
      "Contract must be a YAML object",
    );
    expect(() => parseContractYaml("null", "null.yml")).toThrow(
      "Contract must be a YAML object",
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Walk a mock filesystem tree → correct parent-child relationships
// ---------------------------------------------------------------------------

describe("buildContractTree", () => {
  beforeEach(() => {
    testDir = createTestDir();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("builds correct parent-child relationships from filesystem", () => {
    // Build a small route tree:
    // routes/
    //   _contract.yml        (root layout)
    //   funds/
    //     _contract.yml
    //     index/
    //       _contract.yml
    //     [fundId]/
    //       _contract.yml
    //       overview/
    //         _contract.yml

    writeContract(join(testDir, "routes"), `
level:
  name: route
  rank: 3
layout:
  slots:
    menu: required
    breadcrumb:
  redirect: funds
`);

    writeContract(join(testDir, "routes", "funds"), `
level:
  name: route
  rank: 3
fills: [menu]
layout:
  slots:
    actions:
  default: index
`);

    writeContract(join(testDir, "routes", "funds", "index"), `
level:
  name: route
  rank: 3
`);

    writeContract(join(testDir, "routes", "funds", "[fundId]"), `
param: fundId
level:
  name: route
  rank: 3
fills: [breadcrumb, actions]
layout:
  slots:
    tabs: required
  default: overview
`);

    writeContract(join(testDir, "routes", "funds", "[fundId]", "overview"), `
level:
  name: route
  rank: 3
fills: [tabs]
`);

    const tree = buildContractTree(testDir);

    // Root exists
    expect(tree.routes).not.toBeNull();
    expect(tree.routes!.name).toBe("routes");
    expect(tree.routes!.parent).toBeNull();

    // Root has funds child
    expect(tree.routes!.children.size).toBe(1);
    const funds = tree.routes!.children.get("funds");
    expect(funds).toBeDefined();
    expect(funds!.parent).toBe(tree.routes);

    // Funds has index and [fundId] children
    expect(funds!.children.size).toBe(2);
    expect(funds!.children.has("index")).toBe(true);
    expect(funds!.children.has("[fundId]")).toBe(true);

    const fundId = funds!.children.get("[fundId]")!;
    expect(fundId.contract.param).toBe("fundId");
    expect(fundId.parent).toBe(funds);

    // [fundId] has overview child
    expect(fundId.children.size).toBe(1);
    const overview = fundId.children.get("overview")!;
    expect(overview.parent).toBe(fundId);
  });

  it("handles component contracts as flat nodes", () => {
    writeContract(join(testDir, "components", "atoms"), `
level:
  name: atom
  rank: 0
`);

    writeContract(join(testDir, "components", "molecules"), `
level:
  name: molecule
  rank: 1
`);

    writeContract(join(testDir, "components", "organisms"), `
level:
  name: organism
  rank: 2
`);

    const tree = buildContractTree(testDir);

    expect(tree.components).toHaveLength(3);
    expect(tree.components.map((c) => c.name).sort()).toEqual([
      "atoms",
      "molecules",
      "organisms",
    ]);

    // Component nodes have no parent
    for (const comp of tree.components) {
      expect(comp.parent).toBeNull();
      expect(comp.children.size).toBe(0);
    }
  });

  it("returns null routes when routes/ dir doesn't exist", () => {
    const tree = buildContractTree(testDir);
    expect(tree.routes).toBeNull();
    expect(tree.components).toEqual([]);
  });

  it("skips directories without _contract.yml", () => {
    writeContract(join(testDir, "routes"), `
level:
  name: route
  rank: 3
`);

    // Create a subfolder without a contract
    mkdirSync(join(testDir, "routes", "nocontract"), { recursive: true });
    writeFileSync(
      join(testDir, "routes", "nocontract", "index.tsx"),
      "export default () => null;",
    );

    const tree = buildContractTree(testDir);
    expect(tree.routes!.children.size).toBe(0);
  });

  it("collectAllNodes returns all nodes depth-first", () => {
    writeContract(join(testDir, "routes"), `
level:
  name: route
  rank: 3
`);
    writeContract(join(testDir, "routes", "a"), `
level:
  name: route
  rank: 3
`);
    writeContract(join(testDir, "routes", "a", "b"), `
level:
  name: route
  rank: 3
`);
    writeContract(join(testDir, "routes", "c"), `
level:
  name: route
  rank: 3
`);

    const tree = buildContractTree(testDir);
    const allNodes = collectAllNodes(tree.routes);
    const names = allNodes.map((n) => n.name);

    expect(names).toContain("routes");
    expect(names).toContain("a");
    expect(names).toContain("b");
    expect(names).toContain("c");
    expect(allNodes).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// 5. Validate fills against real ancestor slots — pass and fail cases
// ---------------------------------------------------------------------------

describe("validate: fills reference real slots", () => {
  beforeEach(() => {
    testDir = createTestDir();
  });
  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("passes when fills reference ancestor slots", () => {
    writeContract(join(testDir, "routes"), `
level:
  name: route
  rank: 3
layout:
  slots:
    menu: required
    breadcrumb:
`);

    writeContract(join(testDir, "routes", "funds"), `
level:
  name: route
  rank: 3
fills: [menu, breadcrumb]
`);

    const tree = buildContractTree(testDir);
    const diagnostics = validate(tree);
    const errors = diagnostics.filter(
      (d) => d.rule === "fills-reference-real-slots",
    );
    expect(errors).toHaveLength(0);
  });

  it("passes when fills reference own slots (self-fill)", () => {
    writeContract(join(testDir, "routes"), `
level:
  name: route
  rank: 3
layout:
  slots:
    menu: required
fills: [menu]
`);

    const tree = buildContractTree(testDir);
    const diagnostics = validate(tree);
    const errors = diagnostics.filter(
      (d) => d.rule === "fills-reference-real-slots",
    );
    expect(errors).toHaveLength(0);
  });

  it("errors when fill references non-existent slot", () => {
    writeContract(join(testDir, "routes"), `
level:
  name: route
  rank: 3
`);

    writeContract(join(testDir, "routes", "funds"), `
level:
  name: route
  rank: 3
fills: [menu, nonexistent]
`);

    const tree = buildContractTree(testDir);
    const diagnostics = validate(tree);
    const errors = diagnostics.filter(
      (d) => d.rule === "fills-reference-real-slots",
    );
    expect(errors).toHaveLength(2);
    expect(errors[0].level).toBe("error");
    expect(errors[0].message).toContain("menu");
  });

  it("errors on root fills with no ancestors", () => {
    writeContract(join(testDir, "routes"), `
level:
  name: route
  rank: 3
fills: [orphan]
`);

    const tree = buildContractTree(testDir);
    const diagnostics = validate(tree);
    const errors = diagnostics.filter(
      (d) => d.rule === "fills-reference-real-slots",
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("orphan");
  });
});

// ---------------------------------------------------------------------------
// 6. Validate required slot satisfaction through default chain — pass and fail
// ---------------------------------------------------------------------------

describe("validate: required slots satisfied", () => {
  beforeEach(() => {
    testDir = createTestDir();
  });
  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("passes when required slot is filled through default chain", () => {
    // Root requires menu, redirects to funds, funds defaults to index, index fills menu
    writeContract(join(testDir, "routes"), `
level:
  name: route
  rank: 3
layout:
  slots:
    menu: required
  redirect: funds
`);

    writeContract(join(testDir, "routes", "funds"), `
level:
  name: route
  rank: 3
layout:
  default: index
`);

    writeContract(join(testDir, "routes", "funds", "index"), `
level:
  name: route
  rank: 3
fills: [menu]
`);

    const tree = buildContractTree(testDir);
    const diagnostics = validate(tree);
    const errors = diagnostics.filter(
      (d) => d.rule === "required-slots-satisfied",
    );
    expect(errors).toHaveLength(0);
  });

  it("passes when node self-fills its own required slot", () => {
    writeContract(join(testDir, "routes"), `
level:
  name: route
  rank: 3
layout:
  slots:
    menu: required
fills: [menu]
`);

    const tree = buildContractTree(testDir);
    const diagnostics = validate(tree);
    const errors = diagnostics.filter(
      (d) => d.rule === "required-slots-satisfied",
    );
    expect(errors).toHaveLength(0);
  });

  it("errors when required slot is never filled in chain", () => {
    writeContract(join(testDir, "routes"), `
level:
  name: route
  rank: 3
layout:
  slots:
    menu: required
  redirect: funds
`);

    writeContract(join(testDir, "routes", "funds"), `
level:
  name: route
  rank: 3
layout:
  default: index
`);

    writeContract(join(testDir, "routes", "funds", "index"), `
level:
  name: route
  rank: 3
`);

    const tree = buildContractTree(testDir);
    const diagnostics = validate(tree);
    const errors = diagnostics.filter(
      (d) => d.rule === "required-slots-satisfied",
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("menu");
  });

  it("errors when chain ends without filling (no default/redirect)", () => {
    writeContract(join(testDir, "routes"), `
level:
  name: route
  rank: 3
layout:
  slots:
    sidebar: required
`);

    const tree = buildContractTree(testDir);
    const diagnostics = validate(tree);
    const errors = diagnostics.filter(
      (d) => d.rule === "required-slots-satisfied",
    );
    expect(errors).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 7. Validate mutual exclusivity of default/redirect
// ---------------------------------------------------------------------------

describe("validate: default/redirect mutual exclusivity", () => {
  beforeEach(() => {
    testDir = createTestDir();
  });
  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("errors when both default and redirect are present", () => {
    writeContract(join(testDir, "routes"), `
level:
  name: route
  rank: 3
layout:
  default: a
  redirect: b
`);

    writeContract(join(testDir, "routes", "a"), `
level:
  name: route
  rank: 3
`);

    writeContract(join(testDir, "routes", "b"), `
level:
  name: route
  rank: 3
`);

    const tree = buildContractTree(testDir);
    const diagnostics = validate(tree);
    const errors = diagnostics.filter(
      (d) => d.rule === "default-redirect-mutual-exclusivity",
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].level).toBe("error");
  });

  it("passes when only default is present", () => {
    writeContract(join(testDir, "routes"), `
level:
  name: route
  rank: 3
layout:
  default: a
`);

    writeContract(join(testDir, "routes", "a"), `
level:
  name: route
  rank: 3
`);

    const tree = buildContractTree(testDir);
    const diagnostics = validate(tree);
    const errors = diagnostics.filter(
      (d) => d.rule === "default-redirect-mutual-exclusivity",
    );
    expect(errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 8. Validate param route excluded from default
// ---------------------------------------------------------------------------

describe("validate: param route excluded from default/redirect", () => {
  beforeEach(() => {
    testDir = createTestDir();
  });
  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("errors when default targets a parameterised route", () => {
    writeContract(join(testDir, "routes"), `
level:
  name: route
  rank: 3
layout:
  default: "[fundId]"
`);

    writeContract(join(testDir, "routes", "[fundId]"), `
param: fundId
level:
  name: route
  rank: 3
`);

    const tree = buildContractTree(testDir);
    const diagnostics = validate(tree);
    const errors = diagnostics.filter(
      (d) => d.rule === "param-route-excluded-from-default-redirect",
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("[fundId]");
  });

  it("errors when redirect targets a parameterised route", () => {
    writeContract(join(testDir, "routes"), `
level:
  name: route
  rank: 3
layout:
  redirect: "[holdingId]"
`);

    writeContract(join(testDir, "routes", "[holdingId]"), `
param: holdingId
level:
  name: route
  rank: 3
`);

    const tree = buildContractTree(testDir);
    const diagnostics = validate(tree);
    const errors = diagnostics.filter(
      (d) => d.rule === "param-route-excluded-from-default-redirect",
    );
    expect(errors).toHaveLength(1);
  });

  it("passes when default targets a static route", () => {
    writeContract(join(testDir, "routes"), `
level:
  name: route
  rank: 3
layout:
  default: overview
`);

    writeContract(join(testDir, "routes", "overview"), `
level:
  name: route
  rank: 3
`);

    const tree = buildContractTree(testDir);
    const diagnostics = validate(tree);
    const errors = diagnostics.filter(
      (d) => d.rule === "param-route-excluded-from-default-redirect",
    );
    expect(errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Additional validation rules
// ---------------------------------------------------------------------------

describe("validate: default/redirect target exists", () => {
  beforeEach(() => {
    testDir = createTestDir();
  });
  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("errors when default target child doesn't exist", () => {
    writeContract(join(testDir, "routes"), `
level:
  name: route
  rank: 3
layout:
  default: ghost
`);

    const tree = buildContractTree(testDir);
    const diagnostics = validate(tree);
    const errors = diagnostics.filter(
      (d) => d.rule === "default-redirect-target-exists",
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("ghost");
  });
});

describe("validate: level consistency", () => {
  beforeEach(() => {
    testDir = createTestDir();
  });
  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("warns when route declares non-route level", () => {
    writeContract(join(testDir, "routes"), `
level:
  name: molecule
  rank: 1
`);

    const tree = buildContractTree(testDir);
    const diagnostics = validate(tree);
    const warns = diagnostics.filter(
      (d) => d.rule === "route-level-consistency",
    );
    expect(warns).toHaveLength(1);
    expect(warns[0].level).toBe("warn");
  });

  it("warns when component folder has wrong level", () => {
    writeContract(join(testDir, "components", "atoms"), `
level:
  name: molecule
  rank: 1
`);

    const tree = buildContractTree(testDir);
    const diagnostics = validate(tree);
    const warns = diagnostics.filter(
      (d) => d.rule === "component-level-consistency",
    );
    expect(warns).toHaveLength(1);
    expect(warns[0].message).toContain("atoms");
    expect(warns[0].message).toContain("molecule");
  });
});

// ---------------------------------------------------------------------------
// 9. Resolve available slots for a deep route — collects from all ancestors
// ---------------------------------------------------------------------------

describe("resolveAvailableSlots", () => {
  beforeEach(() => {
    testDir = createTestDir();
  });
  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("collects slots from all ancestors for a deep route", () => {
    writeContract(join(testDir, "routes"), `
level:
  name: route
  rank: 3
layout:
  slots:
    menu: required
    breadcrumb:
`);

    writeContract(join(testDir, "routes", "funds"), `
level:
  name: route
  rank: 3
fills: [menu]
layout:
  slots:
    actions:
    filters:
`);

    writeContract(join(testDir, "routes", "funds", "[fundId]"), `
param: fundId
level:
  name: route
  rank: 3
fills: [breadcrumb, actions]
layout:
  slots:
    tabs: required
    contextPanel:
`);

    writeContract(
      join(testDir, "routes", "funds", "[fundId]", "overview"),
      `
level:
  name: route
  rank: 3
fills: [tabs]
`,
    );

    const tree = buildContractTree(testDir);

    // Navigate to the overview node
    const funds = tree.routes!.children.get("funds")!;
    const fundId = funds.children.get("[fundId]")!;
    const overview = fundId.children.get("overview")!;

    // resolveAvailableSlots should collect ALL slots from self + ancestors
    const availableSlots = resolveAvailableSlots(overview);
    const slotNames = [...availableSlots.keys()].sort();

    // overview has no own slots, but ancestors declare:
    // root: menu, breadcrumb
    // funds: actions, filters
    // [fundId]: tabs, contextPanel
    expect(slotNames).toEqual([
      "actions",
      "breadcrumb",
      "contextPanel",
      "filters",
      "menu",
      "tabs",
    ]);
  });

  it("resolveAncestorSlots excludes own slots", () => {
    writeContract(join(testDir, "routes"), `
level:
  name: route
  rank: 3
layout:
  slots:
    menu:
`);

    writeContract(join(testDir, "routes", "child"), `
level:
  name: route
  rank: 3
layout:
  slots:
    ownSlot:
`);

    const tree = buildContractTree(testDir);
    const child = tree.routes!.children.get("child")!;

    const ancestorSlots = resolveAncestorSlots(child);
    expect(ancestorSlots.has("menu")).toBe(true);
    expect(ancestorSlots.has("ownSlot")).toBe(false);
  });

  it("isSlotFilledInChain follows default chain correctly", () => {
    writeContract(join(testDir, "routes"), `
level:
  name: route
  rank: 3
layout:
  slots:
    menu: required
  default: a
`);

    writeContract(join(testDir, "routes", "a"), `
level:
  name: route
  rank: 3
layout:
  default: b
`);

    writeContract(join(testDir, "routes", "a", "b"), `
level:
  name: route
  rank: 3
fills: [menu]
`);

    const tree = buildContractTree(testDir);

    // menu is filled at depth 2 (routes/a/b), should still resolve from root
    expect(isSlotFilledInChain(tree.routes!, "menu")).toBe(true);
  });

  it("isSlotFilledInChain returns false when chain doesn't fill", () => {
    writeContract(join(testDir, "routes"), `
level:
  name: route
  rank: 3
layout:
  slots:
    menu: required
  default: a
`);

    writeContract(join(testDir, "routes", "a"), `
level:
  name: route
  rank: 3
`);

    const tree = buildContractTree(testDir);
    expect(isSlotFilledInChain(tree.routes!, "menu")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integration: full tree validation end-to-end
// ---------------------------------------------------------------------------

describe("validate: full integration", () => {
  beforeEach(() => {
    testDir = createTestDir();
  });
  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("validates a correct full tree with no errors", () => {
    writeContract(join(testDir, "routes"), `
level:
  name: route
  rank: 3
layout:
  slots:
    menu: required
    breadcrumb:
  redirect: funds
`);

    writeContract(join(testDir, "routes", "funds"), `
level:
  name: route
  rank: 3
fills: [menu]
layout:
  slots:
    actions:
  default: index
`);

    writeContract(join(testDir, "routes", "funds", "index"), `
level:
  name: route
  rank: 3
`);

    writeContract(join(testDir, "routes", "funds", "[fundId]"), `
param: fundId
level:
  name: route
  rank: 3
fills: [breadcrumb, actions]
layout:
  slots:
    tabs: required
  default: overview
`);

    writeContract(
      join(testDir, "routes", "funds", "[fundId]", "overview"),
      `
level:
  name: route
  rank: 3
fills: [tabs]
`,
    );

    writeContract(join(testDir, "components", "atoms"), `
level:
  name: atom
  rank: 0
`);

    writeContract(join(testDir, "components", "molecules"), `
level:
  name: molecule
  rank: 1
`);

    const tree = buildContractTree(testDir);
    const diagnostics = validate(tree);

    const errors = diagnostics.filter((d) => d.level === "error");
    expect(errors).toHaveLength(0);
  });
});
