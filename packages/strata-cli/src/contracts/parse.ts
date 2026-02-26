import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import type { StrataContract, StrataLevel, StrataLayout } from "./types.js";

const VALID_LEVEL_NAMES = new Set(["atom", "molecule", "organism", "route"]);
const VALID_RANKS = new Set([0, 1, 2, 3]);

export class ContractParseError extends Error {
  constructor(
    message: string,
    public filePath: string,
  ) {
    super(`${filePath}: ${message}`);
    this.name = "ContractParseError";
  }
}

/**
 * Parse a YAML string into a validated StrataContract.
 */
export function parseContractYaml(
  yaml: string,
  filePath: string,
): StrataContract {
  let raw: unknown;
  try {
    raw = load(yaml);
  } catch (err) {
    throw new ContractParseError(
      `Invalid YAML: ${err instanceof Error ? err.message : String(err)}`,
      filePath,
    );
  }

  if (raw === null || raw === undefined || typeof raw !== "object") {
    throw new ContractParseError(
      "Contract must be a YAML object",
      filePath,
    );
  }

  const obj = raw as Record<string, unknown>;

  // -- level (required) --
  if (!obj.level || typeof obj.level !== "object") {
    throw new ContractParseError(
      "Missing required field: level (must be an object with name and rank)",
      filePath,
    );
  }

  const levelObj = obj.level as Record<string, unknown>;

  if (!levelObj.name || typeof levelObj.name !== "string") {
    throw new ContractParseError(
      "Missing required field: level.name",
      filePath,
    );
  }

  if (!VALID_LEVEL_NAMES.has(levelObj.name)) {
    throw new ContractParseError(
      `Invalid level.name: "${levelObj.name}". Must be one of: atom, molecule, organism, route`,
      filePath,
    );
  }

  if (levelObj.rank === undefined || levelObj.rank === null) {
    throw new ContractParseError(
      "Missing required field: level.rank",
      filePath,
    );
  }

  if (typeof levelObj.rank !== "number" || !VALID_RANKS.has(levelObj.rank)) {
    throw new ContractParseError(
      `Invalid level.rank: ${String(levelObj.rank)}. Must be 0, 1, 2, or 3`,
      filePath,
    );
  }

  const level: StrataLevel = {
    name: levelObj.name as StrataLevel["name"],
    rank: levelObj.rank as StrataLevel["rank"],
  };

  if (levelObj.canImport !== undefined) {
    if (
      !Array.isArray(levelObj.canImport) ||
      !levelObj.canImport.every((v: unknown) => typeof v === "string")
    ) {
      throw new ContractParseError(
        "level.canImport must be an array of strings",
        filePath,
      );
    }
    level.canImport = levelObj.canImport as string[];
  }

  const contract: StrataContract = { level };

  // -- param (optional) --
  if (obj.param !== undefined) {
    if (typeof obj.param !== "string") {
      throw new ContractParseError("param must be a string", filePath);
    }
    contract.param = obj.param;
  }

  // -- fills (optional) --
  if (obj.fills !== undefined) {
    if (
      !Array.isArray(obj.fills) ||
      !obj.fills.every((v: unknown) => typeof v === "string")
    ) {
      throw new ContractParseError(
        "fills must be an array of strings",
        filePath,
      );
    }
    contract.fills = obj.fills as string[];
  }

  // -- layout (optional) --
  if (obj.layout !== undefined) {
    if (typeof obj.layout !== "object" || obj.layout === null) {
      throw new ContractParseError("layout must be an object", filePath);
    }

    const layoutObj = obj.layout as Record<string, unknown>;
    const layout: StrataLayout = {};

    if (layoutObj.slots !== undefined) {
      if (typeof layoutObj.slots !== "object" || layoutObj.slots === null) {
        throw new ContractParseError(
          "layout.slots must be an object",
          filePath,
        );
      }
      const slotsRaw = layoutObj.slots as Record<string, unknown>;
      const slots: Record<string, "required" | null> = {};
      for (const [key, value] of Object.entries(slotsRaw)) {
        if (value === "required") {
          slots[key] = "required";
        } else if (
          value === null ||
          value === undefined ||
          value === ""
        ) {
          slots[key] = null;
        } else {
          throw new ContractParseError(
            `Invalid slot value for "${key}": must be "required" or empty`,
            filePath,
          );
        }
      }
      layout.slots = slots;
    }

    if (layoutObj.default !== undefined) {
      if (typeof layoutObj.default !== "string") {
        throw new ContractParseError(
          "layout.default must be a string",
          filePath,
        );
      }
      layout.default = layoutObj.default;
    }

    if (layoutObj.redirect !== undefined) {
      if (typeof layoutObj.redirect !== "string") {
        throw new ContractParseError(
          "layout.redirect must be a string",
          filePath,
        );
      }
      layout.redirect = layoutObj.redirect;
    }

    contract.layout = layout;
  }

  // -- variants (optional) --
  if (obj.variants !== undefined) {
    if (
      !Array.isArray(obj.variants) ||
      !obj.variants.every((v: unknown) => typeof v === "string")
    ) {
      throw new ContractParseError(
        "variants must be an array of strings",
        filePath,
      );
    }
    contract.variants = obj.variants as string[];
  }

  // -- default (top-level variant default, optional) --
  if (obj.default !== undefined) {
    if (typeof obj.default !== "string") {
      throw new ContractParseError("default must be a string", filePath);
    }
    contract.default = obj.default;
  }

  // -- resolve (optional) --
  if (obj.resolve !== undefined) {
    if (typeof obj.resolve !== "string") {
      throw new ContractParseError("resolve must be a string", filePath);
    }
    contract.resolve = obj.resolve;
  }

  return contract;
}

/**
 * Read a _contract.yml file from disk and parse it.
 */
export function parseContractFile(filePath: string): StrataContract {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch (err) {
    throw new ContractParseError(
      `Cannot read file: ${err instanceof Error ? err.message : String(err)}`,
      filePath,
    );
  }
  return parseContractYaml(content, filePath);
}
