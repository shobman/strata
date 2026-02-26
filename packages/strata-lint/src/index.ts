import importBoundaryRule from "./rules/import-boundary.js";
import noInlineChromeRule from "./rules/no-inline-chrome.js";
import requiredSlotsRule from "./rules/required-slots.js";

const plugin = {
  rules: {
    "import-boundary": importBoundaryRule,
    "no-inline-chrome": noInlineChromeRule,
    "required-slots": requiredSlotsRule,
  },
  configs: {
    recommended: {
      rules: {
        "strata/import-boundary": "error" as const,
        "strata/no-inline-chrome": "warn" as const,
        "strata/required-slots": "warn" as const,
      },
    },
  },
};

export default plugin;
