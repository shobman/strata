import { RuleTester } from "eslint";
import { describe, beforeEach } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import routeFilledRule from "../rules/route-filled.js";
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

describe("strata/route-filled", () => {
  beforeEach(() => {
    clearContractCache();
  });

  ruleTester.run("route-filled", routeFilledRule, {
    valid: [
      // routes/funds contract fills: [menu], TSX has <FillSlot name="menu"> → pass
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
      // routes/funds/[fundId] fills: [breadcrumb, actions], TSX has both → pass
      {
        code: `
          const FundDetailPage = () => (
            <>
              <FillSlot name="breadcrumb"><span>Fund</span></FillSlot>
              <FillSlot name="actions"><button>Edit</button></FillSlot>
              <div>Detail</div>
            </>
          );
        `,
        filename: join(fixtures, "routes/funds/[fundId]/index.tsx"),
      },
      // non-route file → rule doesn't apply
      {
        code: "export function Button() { return null; }",
        filename: join(fixtures, "components/atoms/Button/index.tsx"),
      },
      // root route has no fills → pass
      {
        code: "export default function RootLayout() { return null; }",
        filename: join(fixtures, "routes/index.tsx"),
      },
    ],

    invalid: [
      // routes/funds contract fills: [menu], TSX has no FillSlot → warn
      {
        code: `
          const FundsPage = () => (
            <div>Content only, no FillSlot</div>
          );
        `,
        filename: join(fixtures, "routes/funds/index.tsx"),
        errors: [{ messageId: "routeMissingFill" }],
      },
      // routes/funds/[fundId] fills: [breadcrumb, actions], TSX only fills breadcrumb
      {
        code: `
          const FundDetailPage = () => (
            <>
              <FillSlot name="breadcrumb"><span>Fund</span></FillSlot>
              <div>Missing actions FillSlot</div>
            </>
          );
        `,
        filename: join(fixtures, "routes/funds/[fundId]/index.tsx"),
        errors: [{ messageId: "routeMissingFill" }],
      },
    ],
  });
});
