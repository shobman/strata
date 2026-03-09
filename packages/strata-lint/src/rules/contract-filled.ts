import type { Rule } from "eslint";
import { relative } from "node:path";
import {
  findContractForFile,
  findAncestorContracts,
} from "../utils/contract-lookup.js";

/**
 * Contract layer rule: warns when a route's _contract.yml is missing a required
 * ancestor slot from its `fills` list.
 *
 * Validates YAML against YAML — never looks at TSX.
 *
 * If an intermediate ancestor already fills the slot, children don't need to.
 */
const contractFilledRule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Warn when a route contract doesn't fill a required ancestor slot",
    },
    messages: {
      contractMissingFill:
        "Contract is missing fill for required slot '{{slotName}}' declared by '{{ancestorPath}}'.",
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

        const fills = new Set(contractInfo.contract.fills ?? []);
        const ancestors = findAncestorContracts(contractInfo.dir);

        // Track slots filled by intermediate ancestors so children
        // don't get warned for slots an intermediate layout already fills.
        const ancestorFills = new Set<string>();

        for (const ancestor of ancestors) {
          const slots = ancestor.contract.layout?.slots;
          if (slots) {
            for (const [slotName, value] of Object.entries(slots)) {
              if (value !== "required") continue;
              if (fills.has(slotName)) continue;
              if (ancestorFills.has(slotName)) continue;

              const ancestorRel =
                relative(contractInfo.dir, ancestor.dir) || ancestor.dir;

              context.report({
                node,
                messageId: "contractMissingFill",
                data: {
                  slotName,
                  ancestorPath: ancestorRel,
                },
              });
            }
          }

          // Accumulate fills from this ancestor for deeper slot checks
          for (const f of ancestor.contract.fills ?? []) {
            ancestorFills.add(f);
          }
        }
      },
    };
  },
};

export default contractFilledRule;
