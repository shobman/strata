import type { Rule } from "eslint";
import { findContractForFile } from "../utils/contract-lookup.js";

/**
 * Implementation layer rule: warns when a route's TSX has a
 * <FillSlot name="X"> that is NOT listed in the contract's `fills` array.
 *
 * Validates TSX against its own YAML — never crosses contracts.
 */
const routeOverfillRule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Warn when a route component fills a slot not declared in its contract",
    },
    messages: {
      routeOrphanFill:
        "<FillSlot name=\"{{slotName}}\"> found but '{{slotName}}' is not in the contract's fills array.",
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename ?? context.getFilename();
    if (!filename || filename.startsWith("<")) return {};

    const contractInfo = findContractForFile(filename);
    if (!contractInfo || contractInfo.contract.level.name !== "route") {
      return {};
    }

    const contractFills = new Set(contractInfo.contract.fills ?? []);

    return {
      // Check each <FillSlot name="..."> against the contract
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      JSXOpeningElement(node: any) {
        const nameNode = node.name;
        if (nameNode.type !== "JSXIdentifier" || nameNode.name !== "FillSlot") {
          return;
        }

        for (const attr of node.attributes ?? []) {
          if (
            attr.type === "JSXAttribute" &&
            attr.name?.type === "JSXIdentifier" &&
            attr.name.name === "name" &&
            attr.value?.type === "Literal" &&
            typeof attr.value.value === "string"
          ) {
            const slotName: string = attr.value.value;
            if (!contractFills.has(slotName)) {
              context.report({
                node,
                messageId: "routeOrphanFill",
                data: { slotName },
              });
            }
          }
        }
      },
    };
  },
};

export default routeOverfillRule;
