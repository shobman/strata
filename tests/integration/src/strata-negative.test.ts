import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  cpSync,
  rmSync,
  mkdtempSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { buildContractTree, validate } from "@shobman/strata-cli";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixtureDir = join(__dirname, "..", "fixture");

describe("strata check — negative / invalid fixtures", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "strata-neg-"));
    cpSync(fixtureDir, tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  // 7. Missing required slot in chain → error
  // Remove `fills: [menu]` from funds so root's required "menu" is unsatisfied
  it("errors when required slot is not filled in the default/redirect chain", () => {
    const fundsContract = join(tempDir, "routes/funds/_contract.yml");
    const content = readFileSync(fundsContract, "utf-8");
    const modified = content.replace("fills: [menu]\n", "");
    writeFileSync(fundsContract, modified, "utf-8");

    const tree = buildContractTree(tempDir);
    const diagnostics = validate(tree);

    const errors = diagnostics.filter((d) => d.level === "error");
    expect(errors.length).toBeGreaterThanOrEqual(1);

    const requiredSlotError = errors.find(
      (d) => d.rule === "required-slots-satisfied" && d.message.includes("menu"),
    );
    expect(requiredSlotError).toBeDefined();
  });

  // 8. Fill referencing nonexistent ancestor slot → error
  // Add `fills: [nonexistent]` to overview
  it("errors when a fill references a nonexistent ancestor slot", () => {
    const overviewContract = join(
      tempDir,
      "routes/funds/[fundId]/overview/_contract.yml",
    );
    const content = readFileSync(overviewContract, "utf-8");
    const modified = content.replace(
      "fills: [tabs]",
      "fills: [tabs, nonexistent]",
    );
    writeFileSync(overviewContract, modified, "utf-8");

    const tree = buildContractTree(tempDir);
    const diagnostics = validate(tree);

    const errors = diagnostics.filter((d) => d.level === "error");
    expect(errors.length).toBeGreaterThanOrEqual(1);

    const fillError = errors.find(
      (d) =>
        d.rule === "fills-reference-real-slots" &&
        d.message.includes("nonexistent"),
    );
    expect(fillError).toBeDefined();
  });

  // 9. Both default and redirect → mutual exclusivity error
  it("errors when a contract has both default and redirect", () => {
    const rootContract = join(tempDir, "routes/_contract.yml");
    const content = readFileSync(rootContract, "utf-8");
    // Root already has redirect: funds, add default: funds too
    const modified = content.replace(
      "  redirect: funds",
      "  redirect: funds\n  default: funds",
    );
    writeFileSync(rootContract, modified, "utf-8");

    const tree = buildContractTree(tempDir);
    const diagnostics = validate(tree);

    const errors = diagnostics.filter((d) => d.level === "error");
    const mutualError = errors.find(
      (d) => d.rule === "default-redirect-mutual-exclusivity",
    );
    expect(mutualError).toBeDefined();
  });

  // 10. Parameterised route as default target → error
  it("errors when a parameterised route is set as default target", () => {
    const fundsContract = join(tempDir, "routes/funds/_contract.yml");
    const content = readFileSync(fundsContract, "utf-8");
    const modified = content.replace("default: index", 'default: "[fundId]"');
    writeFileSync(fundsContract, modified, "utf-8");

    const tree = buildContractTree(tempDir);
    const diagnostics = validate(tree);

    const errors = diagnostics.filter((d) => d.level === "error");
    const paramError = errors.find(
      (d) => d.rule === "param-route-excluded-from-default-redirect",
    );
    expect(paramError).toBeDefined();
  });
});
