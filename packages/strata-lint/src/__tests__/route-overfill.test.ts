import { RuleTester } from "eslint";
import { describe, beforeEach } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import routeOverfillRule from "../rules/route-overfill.js";
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

describe("strata/route-overfill", () => {
  beforeEach(() => {
    clearContractCache();
  });

  ruleTester.run("route-overfill", routeOverfillRule, {
    valid: [
      // routes/funds fills: [menu], TSX has <FillSlot name="menu"> → pass
      {
        code: `
          const FundsPage = () => (
            <>
              <FillSlot name="menu"><nav>Funds</nav></FillSlot>
              <div>Content</div>
            </>
          );
        `,
        filename: join(fixtures, "routes/funds/index.tsx"),
      },
      // no FillSlot at all → pass (no overfill)
      {
        code: `
          const FundsPage = () => (
            <div>Content</div>
          );
        `,
        filename: join(fixtures, "routes/funds/index.tsx"),
      },
      // non-route → rule doesn't apply
      {
        code: `
          const Button = () => (
            <FillSlot name="anything"><span>X</span></FillSlot>
          );
        `,
        filename: join(fixtures, "components/atoms/Button/index.tsx"),
      },
    ],

    invalid: [
      // routes/funds fills: [menu], TSX has <FillSlot name="sidebar"> not in contract
      {
        code: `
          const FundsPage = () => (
            <>
              <FillSlot name="menu"><nav>Funds</nav></FillSlot>
              <FillSlot name="sidebar"><aside>Extra</aside></FillSlot>
              <div>Content</div>
            </>
          );
        `,
        filename: join(fixtures, "routes/funds/index.tsx"),
        errors: [{ messageId: "routeOrphanFill" }],
      },
      // root route has no fills, TSX has <FillSlot> → overfill
      {
        code: `
          const RootLayout = () => (
            <FillSlot name="anything"><span>X</span></FillSlot>
          );
        `,
        filename: join(fixtures, "routes/index.tsx"),
        errors: [{ messageId: "routeOrphanFill" }],
      },
    ],
  });
});
