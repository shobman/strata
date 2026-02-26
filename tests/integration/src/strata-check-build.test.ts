import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildContractTree,
  validate,
  collectAllNodes,
  resolveAncestorSlots,
  isSlotFilledInChain,
} from "@shobman/strata-cli";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixtureDir = join(__dirname, "..", "fixture");

describe("strata check — valid fixture", () => {
  // 1. Build tree from fixture → returns valid ContractTree with routes and components
  it("builds a valid contract tree with routes and component levels", () => {
    const tree = buildContractTree(fixtureDir);

    expect(tree.routes).not.toBeNull();
    expect(tree.routes!.name).toBe("routes");
    expect(tree.routes!.contract.level.name).toBe("route");

    // 3 component level entries: atoms, molecules, organisms
    expect(tree.components).toHaveLength(3);
    const componentNames = tree.components.map((c) => c.name).sort();
    expect(componentNames).toEqual(["atoms", "molecules", "organisms"]);
  });

  // 2. Validate fixture → 0 errors
  it("validates the fixture with zero errors", () => {
    const tree = buildContractTree(fixtureDir);
    const diagnostics = validate(tree);

    const errors = diagnostics.filter((d) => d.level === "error");
    expect(errors).toHaveLength(0);
  });

  // 3. Root contract has expected slots
  it("root contract declares menu (required), breadcrumb, and actions slots", () => {
    const tree = buildContractTree(fixtureDir);
    const root = tree.routes!;

    const slots = root.contract.layout?.slots;
    expect(slots).toBeDefined();
    expect(Object.keys(slots!).sort()).toEqual(
      ["actions", "breadcrumb", "menu"].sort(),
    );
    expect(slots!.menu).toBe("required");
    expect(slots!.breadcrumb).toBeNull();
    expect(slots!.actions).toBeNull();
  });

  // 4. Required slot "menu" is satisfied through redirect chain
  // root (redirect→funds) → funds (fills menu) ✓
  it("required slot 'menu' is satisfied through the redirect chain", () => {
    const tree = buildContractTree(fixtureDir);
    const root = tree.routes!;

    expect(root.contract.layout?.redirect).toBe("funds");
    expect(isSlotFilledInChain(root, "menu")).toBe(true);
  });

  // 5. [fundId] resolveAncestorSlots returns all available ancestor slots
  it("[fundId] inherits ancestor slots from root and funds", () => {
    const tree = buildContractTree(fixtureDir);
    const allNodes = collectAllNodes(tree.routes!);
    const fundIdNode = allNodes.find((n) => n.name === "[fundId]");
    expect(fundIdNode).toBeDefined();

    const ancestorSlots = resolveAncestorSlots(fundIdNode!);
    const slotNames = [...ancestorSlots.keys()].sort();

    // From funds: listActions
    // From root: menu, breadcrumb, actions
    expect(slotNames).toEqual(
      ["actions", "breadcrumb", "listActions", "menu"].sort(),
    );
  });

  // 6. Nodes with layout.slots identified correctly for type generation
  it("identifies correct nodes that would generate type files", () => {
    const tree = buildContractTree(fixtureDir);
    const allNodes = collectAllNodes(tree.routes!);
    const nodesWithSlots = allNodes.filter((n) => n.contract.layout?.slots);

    // root (menu, breadcrumb, actions), funds (listActions), [fundId] (tabs, contextPanel)
    expect(nodesWithSlots).toHaveLength(3);

    const names = nodesWithSlots.map((n) => n.name).sort();
    expect(names).toEqual(["[fundId]", "funds", "routes"].sort());

    // Verify slot counts
    const root = nodesWithSlots.find((n) => n.name === "routes")!;
    expect(Object.keys(root.contract.layout!.slots!)).toHaveLength(3);

    const funds = nodesWithSlots.find((n) => n.name === "funds")!;
    expect(Object.keys(funds.contract.layout!.slots!)).toHaveLength(1);

    const fundId = nodesWithSlots.find((n) => n.name === "[fundId]")!;
    expect(Object.keys(fundId.contract.layout!.slots!)).toHaveLength(2);
    expect(fundId.contract.layout!.slots!.tabs).toBe("required");
    expect(fundId.contract.layout!.slots!.contextPanel).toBeNull();
  });
});
