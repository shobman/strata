import { RuleTester } from "eslint";
import { describe, beforeEach } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import noInlineChromeRule from "../rules/no-inline-chrome.js";
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

describe("strata/no-inline-chrome", () => {
  beforeEach(() => {
    clearContractCache();
  });

  ruleTester.run("no-inline-chrome", noInlineChromeRule, {
    valid: [
      // 8. <Button> inside FillSlot → pass
      {
        code: `
          const Page = () => (
            <FillSlot name="actions">
              <Button>Click</Button>
            </FillSlot>
          );
        `,
        filename: join(fixtures, "routes/funds/index.tsx"),
      },
      // 9. <Button> in molecule (not route) → pass (rule only applies to routes)
      {
        code: `
          const FilterBar = () => (
            <div>
              <Button>Click</Button>
            </div>
          );
        `,
        filename: join(fixtures, "components/molecules/FilterBar/index.tsx"),
      },
      // Nested inside FillSlot with wrapper divs → pass
      {
        code: `
          const Page = () => (
            <FillSlot name="actions">
              <div className="wrapper">
                <Button>Click</Button>
              </div>
            </FillSlot>
          );
        `,
        filename: join(fixtures, "routes/funds/index.tsx"),
      },
      // Non-chrome elements are fine outside FillSlot
      {
        code: `
          const Page = () => (
            <div>
              <span>Hello</span>
              <CustomComponent />
            </div>
          );
        `,
        filename: join(fixtures, "routes/funds/index.tsx"),
      },
      // File outside any contract → no restriction
      {
        code: `const X = () => <Button>Hi</Button>;`,
        filename: "/tmp/no-contract/index.tsx",
      },
    ],

    invalid: [
      // 7. <Button> outside FillSlot in route → warn
      {
        code: `
          const Page = () => (
            <div>
              <Button>Click</Button>
            </div>
          );
        `,
        filename: join(fixtures, "routes/funds/index.tsx"),
        errors: [{ messageId: "inlineChrome" }],
      },
      // <button> (lowercase) outside FillSlot → warn
      {
        code: `
          const Page = () => (
            <div>
              <button>Click</button>
            </div>
          );
        `,
        filename: join(fixtures, "routes/funds/index.tsx"),
        errors: [{ messageId: "inlineChrome" }],
      },
      // <Toolbar> outside FillSlot → warn
      {
        code: `
          const Page = () => (
            <div>
              <Toolbar />
            </div>
          );
        `,
        filename: join(fixtures, "routes/funds/index.tsx"),
        errors: [{ messageId: "inlineChrome" }],
      },
      // <ActionBar> outside FillSlot → warn
      {
        code: `
          const Page = () => (
            <div>
              <ActionBar>
                <Button>Click</Button>
              </ActionBar>
            </div>
          );
        `,
        filename: join(fixtures, "routes/funds/index.tsx"),
        // Both ActionBar and Button are outside FillSlot
        errors: [
          { messageId: "inlineChrome" },
          { messageId: "inlineChrome" },
        ],
      },
      // <IconButton> outside FillSlot → warn
      {
        code: `
          const Page = () => (
            <div>
              <IconButton icon="save" />
            </div>
          );
        `,
        filename: join(fixtures, "routes/funds/index.tsx"),
        errors: [{ messageId: "inlineChrome" }],
      },
      // Multiple buttons → multiple warnings
      {
        code: `
          const Page = () => (
            <div>
              <Button>Save</Button>
              <Button>Cancel</Button>
            </div>
          );
        `,
        filename: join(fixtures, "routes/funds/index.tsx"),
        errors: [
          { messageId: "inlineChrome" },
          { messageId: "inlineChrome" },
        ],
      },
    ],
  });
});
