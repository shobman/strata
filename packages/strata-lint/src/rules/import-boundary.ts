import type { Rule } from "eslint";
import { resolve, dirname } from "node:path";
import { findContractForFile, findContractForPath } from "../utils/contract-lookup.js";

const importBoundaryRule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "Prevent importing from higher-rank Strata levels",
    },
    messages: {
      importBoundaryViolation:
        "Cannot import from '{{importedLevel}}' (rank {{importedRank}}) into '{{currentLevel}}' (rank {{currentRank}}). Import boundary violation.",
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename ?? context.getFilename();
    if (!filename || filename.startsWith("<")) return {};

    const currentInfo = findContractForFile(filename);
    if (!currentInfo) return {};

    function checkImport(
      node: Rule.Node,
      source: string,
    ): void {
      // Skip bare specifiers (node_modules)
      if (!source.startsWith(".") && !source.startsWith("/")) return;

      const importerDir = dirname(filename);
      const resolvedPath = resolve(importerDir, source);

      const importedInfo = findContractForPath(resolvedPath);
      if (!importedInfo) return; // no contract = no restriction

      const currentRank = currentInfo.contract.level.rank;
      const importedRank = importedInfo.contract.level.rank;
      const currentLevel = currentInfo.contract.level.name;
      const importedLevel = importedInfo.contract.level.name;

      // Same-level imports are always allowed (molecule importing molecule)
      if (currentLevel === importedLevel) return;

      if (importedRank >= currentRank) {
        context.report({
          node,
          messageId: "importBoundaryViolation",
          data: {
            importedLevel,
            importedRank: String(importedRank),
            currentLevel,
            currentRank: String(currentRank),
          },
        });
      }
    }

    return {
      ImportDeclaration(node) {
        if (typeof node.source.value === "string") {
          checkImport(node as unknown as Rule.Node, node.source.value);
        }
      },

      CallExpression(node) {
        const callee = node.callee as Record<string, unknown>;
        if (
          callee.type === "Identifier" &&
          callee.name === "require" &&
          node.arguments.length > 0
        ) {
          const arg = node.arguments[0] as Record<string, unknown>;
          if (arg.type === "Literal" && typeof arg.value === "string") {
            checkImport(node as unknown as Rule.Node, arg.value);
          }
        }
      },
    };
  },
};

export default importBoundaryRule;
