import type { Rule } from "eslint";
import { relative } from "node:path";
import {
  findContractForFile,
  findAncestorContracts,
} from "../utils/contract-lookup.js";

const requiredSlotsRule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Warn when a route component doesn't fill required ancestor slots",
    },
    messages: {
      missingRequiredSlot:
        "Required slot '{{slotName}}' from '{{ancestorPath}}' is not filled by this route.",
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

        for (const ancestor of ancestors) {
          const slots = ancestor.contract.layout?.slots;
          if (!slots) continue;

          for (const [slotName, value] of Object.entries(slots)) {
            if (value !== "required") continue;
            if (fills.has(slotName)) continue;

            const ancestorRel =
              relative(contractInfo.dir, ancestor.dir) || ancestor.dir;

            context.report({
              node,
              messageId: "missingRequiredSlot",
              data: {
                slotName,
                ancestorPath: ancestorRel,
              },
            });
          }
        }
      },
    };
  },
};

export default requiredSlotsRule;
