import { parseContractFile } from "@shobman/strata-cli";
import type { StrataContract } from "@shobman/strata-cli";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";

export interface ContractInfo {
  contract: StrataContract;
  dir: string;
}

// ---------------------------------------------------------------------------
// Cache — persists for the duration of a lint run (same process).
// ---------------------------------------------------------------------------

const contractCache = new Map<string, StrataContract | null>();

/**
 * Clear the contract cache. Exposed for testing.
 */
export function clearContractCache(): void {
  contractCache.clear();
}

/**
 * Check for a _contract.yml at exactly this directory. Cached.
 */
function getContractAt(dir: string): StrataContract | null {
  if (contractCache.has(dir)) return contractCache.get(dir)!;

  const contractPath = join(dir, "_contract.yml");
  if (existsSync(contractPath)) {
    try {
      const contract = parseContractFile(contractPath);
      contractCache.set(dir, contract);
      return contract;
    } catch {
      contractCache.set(dir, null);
      return null;
    }
  }

  contractCache.set(dir, null);
  return null;
}

/**
 * Walk up from a path (file or directory) looking for the nearest _contract.yml.
 * If `startPath` has an extension, starts from its parent directory.
 */
export function findContractForPath(startPath: string): ContractInfo | null {
  let dir = startPath;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const contract = getContractAt(dir);
    if (contract) return { contract, dir };

    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Given a source file, find the nearest _contract.yml above it.
 */
export function findContractForFile(filePath: string): ContractInfo | null {
  return findContractForPath(dirname(filePath));
}

/**
 * Walk up from the parent of `startDir`, collecting all ancestor contracts.
 */
export function findAncestorContracts(startDir: string): ContractInfo[] {
  const ancestors: ContractInfo[] = [];
  let dir = dirname(startDir);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const contract = getContractAt(dir);
    if (contract) ancestors.push({ contract, dir });

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return ancestors;
}
