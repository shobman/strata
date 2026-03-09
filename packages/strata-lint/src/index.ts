import rankViolationRule from "./rules/rank-violation.js";
import contractFilledRule from "./rules/contract-filled.js";
import contractOverfillRule from "./rules/contract-overfill.js";
import routeFilledRule from "./rules/route-filled.js";
import routeOverfillRule from "./rules/route-overfill.js";

const plugin = {
  rules: {
    "rank-violation": rankViolationRule,
    "contract-filled": contractFilledRule,
    "contract-overfill": contractOverfillRule,
    "route-filled": routeFilledRule,
    "route-overfill": routeOverfillRule,
  },
  configs: {
    recommended: {
      rules: {
        "strata/rank-violation": "error" as const,
        "strata/contract-filled": "warn" as const,
        "strata/contract-overfill": "warn" as const,
        "strata/route-filled": "warn" as const,
        "strata/route-overfill": "warn" as const,
      },
    },
  },
};

export default plugin;
