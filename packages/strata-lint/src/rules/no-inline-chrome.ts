import type { Rule } from "eslint";
import { findContractForFile } from "../utils/contract-lookup.js";

/**
 * Elements that typically represent action chrome.
 * These should be projected into layout slots via <FillSlot>, not rendered inline.
 */
const CHROME_ELEMENTS = new Set([
  "Button",
  "button",
  "IconButton",
  "Toolbar",
  "toolbar",
  "ActionBar",
  "Actions",
]);

/**
 * Walk up the AST parent chain to check if a node is inside a <FillSlot> element.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isInsideFillSlot(node: any): boolean {
  let current = node.parent;
  while (current) {
    if (
      current.type === "JSXElement" &&
      current.openingElement?.name?.type === "JSXIdentifier" &&
      current.openingElement.name.name === "FillSlot"
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

const noInlineChromeRule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prevent action buttons and toolbars rendered outside FillSlot in route components",
    },
    messages: {
      inlineChrome:
        "Action element <{{element}}> should be projected into a layout slot via <FillSlot>. See STRATA-SKILL.md.",
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename ?? context.getFilename();
    if (!filename || filename.startsWith("<")) return {};

    const contractInfo = findContractForFile(filename);

    // Only applies to route files
    if (!contractInfo || contractInfo.contract.level.name !== "route") {
      return {};
    }

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      JSXOpeningElement(node: any) {
        const nameNode = node.name;
        if (nameNode.type !== "JSXIdentifier") return;

        const elementName: string = nameNode.name;
        if (!CHROME_ELEMENTS.has(elementName)) return;

        if (!isInsideFillSlot(node)) {
          context.report({
            node,
            messageId: "inlineChrome",
            data: { element: elementName },
          });
        }
      },
    };
  },
};

export default noInlineChromeRule;
