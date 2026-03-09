import { RuleTester } from "eslint";
import { describe, beforeEach } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import contractFilledRule from "../rules/contract-filled.js";
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

describe("strata/contract-filled", () => {
  beforeEach(() => {
    clearContractCache();
  });

  ruleTester.run("contract-filled", contractFilledRule, {
    valid: [
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
      // root route has no ancestors → pass
      {
        code: "export default function RootLayout() { return null; }",
        filename: join(fixtures, "routes/index.tsx"),
      },
      // routes/funds/[fundId] fills [breadcrumb, actions]
      // - routes/ requires menu → covered by intermediate ancestor funds (fills: [menu])
      // - routes/funds requires actions → covered by [fundId] directly
      {
        code: "export default function FundDetailPage() { return null; }",
        filename: join(fixtures, "routes/funds/[fundId]/index.tsx"),
      },
    ],

    invalid: [
      // routes/funds/[fundId]/details fills [breadcrumb] but:
      // - [fundId] requires tabs → NOT filled by details, NOT filled by any intermediate
      {
        code: "export default function FundDetailsPage() { return null; }",
        filename: join(
          fixtures,
          "routes/funds/[fundId]/details/index.tsx",
        ),
        errors: [{ messageId: "contractMissingFill" }],
      },
    ],
  });
});
