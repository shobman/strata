import { RuleTester } from "eslint";
import { describe, beforeEach } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import requiredSlotsRule from "../rules/required-slots.js";
import { clearContractCache } from "../utils/contract-lookup.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixtures = join(__dirname, "fixtures");

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

describe("strata/required-slots", () => {
  beforeEach(() => {
    clearContractCache();
  });

  ruleTester.run("required-slots", requiredSlotsRule, {
    valid: [
      // 11. route filling all required ancestor slots → pass
      // routes/funds fills [menu], ancestor routes/ requires menu → pass
      {
        code: "export default function FundsPage() { return null; }",
        filename: join(fixtures, "routes/funds/index.tsx"),
      },
      // non-route file → rule doesn't apply
      {
        code: "export function Button() { return null; }",
        filename: join(fixtures, "components/atoms/Button/index.tsx"),
      },
      // file outside contract → pass
      {
        code: "export default function X() { return null; }",
        filename: "/tmp/no-contract/index.tsx",
      },
      // root route has no ancestors → no required ancestor slots → pass
      {
        code: "export default function RootLayout() { return null; }",
        filename: join(fixtures, "routes/index.tsx"),
      },
    ],

    invalid: [
      // 10. route missing required ancestor slot → warn
      // routes/funds/[fundId] fills [breadcrumb, actions] but routes/ requires menu
      // — the static hint correctly warns that this route doesn't fill menu itself
      // (even though the funds sibling does — strata check handles chain resolution)
      {
        code: "export default function FundDetailPage() { return null; }",
        filename: join(fixtures, "routes/funds/[fundId]/index.tsx"),
        errors: [{ messageId: "missingRequiredSlot" }],
      },
    ],
  });
});
