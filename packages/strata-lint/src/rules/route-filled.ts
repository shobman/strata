import type { Rule } from "eslint";
import { findContractForFile } from "../utils/contract-lookup.js";

/**
 * Implementation layer rule: warns when a route's TSX is missing a
 * <FillSlot name="X"> for a slot listed in the contract's `fills` array.
 *
 * Validates TSX against its own YAML — never crosses contracts.
 */
const routeFilledRule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Warn when a route component doesn't implement a FillSlot for each contract fill",
    },
    messages: {
      routeMissingFill:
        "Contract declares fill '{{slotName}}' but no <FillSlot name=\"{{slotName}}\"> found in this file.",
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

    const requiredFills = contractInfo.contract.fills ?? [];
    if (requiredFills.length === 0) return {};

    const foundFills = new Set<string>();

    return {
      // Collect all <FillSlot name="..."> in the file
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      JSXOpeningElement(node: any) {
        const nameNode = node.name;
        if (nameNode.type !== "JSXIdentifier" || nameNode.name !== "FillSlot") {
          return;
        }

        // Find the name attribute
        for (const attr of node.attributes ?? []) {
          if (
            attr.type === "JSXAttribute" &&
            attr.name?.type === "JSXIdentifier" &&
            attr.name.name === "name" &&
            attr.value?.type === "Literal" &&
            typeof attr.value.value === "string"
          ) {
            foundFills.add(attr.value.value);
          }
        }
      },

      // At end of file, check that every contract fill was implemented
      "Program:exit"(node: Rule.Node) {
        for (const slotName of requiredFills) {
          if (!foundFills.has(slotName)) {
            context.report({
              node,
              messageId: "routeMissingFill",
              data: { slotName },
            });
          }
        }
      },
    };
  },
};

export default routeFilledRule;
