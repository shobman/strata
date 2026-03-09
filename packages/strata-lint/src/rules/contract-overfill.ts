import type { Rule } from "eslint";
import {
  findContractForFile,
  findAncestorContracts,
} from "../utils/contract-lookup.js";

/**
 * Contract layer rule: warns when a route's _contract.yml lists a fill
 * that no ancestor declares as a slot.
 *
 * Validates YAML against YAML — never looks at TSX.
 */
const contractOverfillRule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Warn when a route contract fills a slot that no ancestor declares",
    },
    messages: {
      contractOrphanFill:
        "Contract fills slot '{{slotName}}' but no ancestor declares it.",
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename ?? context.getFilename();
    if (!filename || filename.startsWith("<")) return {};

    return {
      Program(node) {
        const contractInfo = findContractForFile(filename);
        if (!contractInfo || contractInfo.contract.level.name !== "route") {
          return;
        }

        const fills = contractInfo.contract.fills ?? [];
        if (fills.length === 0) return;

        // Collect all ancestor slot names (required and optional)
        const ancestors = findAncestorContracts(contractInfo.dir);
        const allAncestorSlots = new Set<string>();

        for (const ancestor of ancestors) {
          const slots = ancestor.contract.layout?.slots;
          if (slots) {
            for (const slotName of Object.keys(slots)) {
              allAncestorSlots.add(slotName);
            }
          }
        }

        for (const fillName of fills) {
          if (!allAncestorSlots.has(fillName)) {
            context.report({
              node,
              messageId: "contractOrphanFill",
              data: { slotName: fillName },
            });
          }
        }
      },
    };
  },
};

export default contractOverfillRule;
