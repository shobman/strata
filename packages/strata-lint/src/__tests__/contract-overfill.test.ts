import { RuleTester } from "eslint";
import { describe, beforeEach } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import contractOverfillRule from "../rules/contract-overfill.js";
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

describe("strata/contract-overfill", () => {
  beforeEach(() => {
    clearContractCache();
  });

  ruleTester.run("contract-overfill", contractOverfillRule, {
    valid: [
      // routes/funds fills [menu] — routes/ declares menu → pass
      {
        code: "export default function FundsPage() { return null; }",
        filename: join(fixtures, "routes/funds/index.tsx"),
      },
      // routes/funds/[fundId] fills [breadcrumb, actions]
      // routes/ declares breadcrumb, routes/funds declares actions → pass
      {
        code: "export default function FundDetailPage() { return null; }",
        filename: join(fixtures, "routes/funds/[fundId]/index.tsx"),
      },
      // non-route → rule doesn't apply
      {
        code: "export function Button() { return null; }",
        filename: join(fixtures, "components/atoms/Button/index.tsx"),
      },
      // no fills → pass
      {
        code: "export default function RootLayout() { return null; }",
        filename: join(fixtures, "routes/index.tsx"),
      },
    ],

    invalid: [
      // routes/orphan fills [menu, nonexistent-slot]
      // routes/ declares menu (valid) but no ancestor declares nonexistent-slot
      {
        code: "export default function OrphanPage() { return null; }",
        filename: join(fixtures, "routes/orphan/index.tsx"),
        errors: [{ messageId: "contractOrphanFill" }],
      },
    ],
  });
});
