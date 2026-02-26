import { describe, it, expect } from "vitest";
import { Linter } from "eslint";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import strataPlugin from "@shobman/strata-lint";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixtureDir = join(__dirname, "..", "fixture");

function lint(code: string, filename: string): Linter.LintMessage[] {
  const linter = new Linter();
  return linter.verify(
    code,
    [
      {
        files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
        plugins: { strata: strataPlugin as Record<string, unknown> },
        rules: {
          "strata/import-boundary": "error",
          "strata/no-inline-chrome": "warn",
          "strata/required-slots": "warn",
        },
        languageOptions: {
          ecmaVersion: 2022,
          sourceType: "module",
          parserOptions: {
            ecmaFeatures: { jsx: true },
          },
        },
      },
    ],
    { filename },
  );
}

describe("ESLint integration — strata-lint plugin against fixture", () => {
  // 11. molecule importing atom → pass (valid boundary)
  it("allows molecule to import from atom (lower rank)", () => {
    const code = `import { Button } from '../../atoms/Button';`;
    const filename = join(
      fixtureDir,
      "components/molecules/FilterBar/index.tsx",
    );

    const messages = lint(code, filename);
    const boundaryErrors = messages.filter(
      (m) => m.ruleId === "strata/import-boundary",
    );
    expect(boundaryErrors).toHaveLength(0);
  });

  // 12. atom importing molecule → error (violates boundary)
  it("flags atom importing from molecule as boundary violation", () => {
    const code = `import { FilterBar } from '../../molecules/FilterBar';`;
    const filename = join(
      fixtureDir,
      "components/atoms/Button/index.tsx",
    );

    const messages = lint(code, filename);
    const boundaryErrors = messages.filter(
      (m) => m.ruleId === "strata/import-boundary",
    );
    expect(boundaryErrors).toHaveLength(1);
    expect(boundaryErrors[0].severity).toBe(2); // error
  });

  // 13. Button outside FillSlot in route file → warn (inline chrome)
  it("warns about chrome elements outside FillSlot in route files", () => {
    const code = `
      const Page = () => (
        <div>
          <Button>Click me</Button>
        </div>
      );
    `;
    const filename = join(
      fixtureDir,
      "routes/funds/index/index.tsx",
    );

    const messages = lint(code, filename);
    const chromeWarnings = messages.filter(
      (m) => m.ruleId === "strata/no-inline-chrome",
    );
    expect(chromeWarnings).toHaveLength(1);
    expect(chromeWarnings[0].severity).toBe(1); // warn
  });
});
