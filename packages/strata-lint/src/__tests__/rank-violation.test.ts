import { RuleTester } from "eslint";
import { describe, beforeEach } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import rankViolationRule from "../rules/rank-violation.js";
import { clearContractCache } from "../utils/contract-lookup.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixtures = join(__dirname, "fixtures");

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

describe("strata/rank-violation", () => {
  beforeEach(() => {
    clearContractCache();
  });

  ruleTester.run("rank-violation", rankViolationRule, {
    valid: [
      // molecule importing atom → pass (lower rank)
      {
        code: "import { Button } from '../../atoms/Button';",
        filename: join(fixtures, "components/molecules/FilterBar/index.tsx"),
      },
      // route importing organism → pass (lower rank)
      {
        code: "import { FundPanel } from '../../components/organisms/FundPanel';",
        filename: join(fixtures, "routes/funds/index.tsx"),
      },
      // same-level import → pass
      {
        code: "import { SearchBar } from '../SearchBar';",
        filename: join(fixtures, "components/molecules/FilterBar/index.tsx"),
      },
      // node_modules import → pass
      {
        code: "import React from 'react';",
        filename: join(fixtures, "components/atoms/Button/index.tsx"),
      },
      // file outside any contract → no restriction
      {
        code: "import { anything } from './something';",
        filename: "/tmp/no-contract/index.ts",
      },
    ],

    invalid: [
      // atom importing molecule → error
      {
        code: "import { FilterBar } from '../../molecules/FilterBar';",
        filename: join(fixtures, "components/atoms/Button/index.tsx"),
        errors: [{ messageId: "rankViolation" }],
      },
      // organism importing route → error
      {
        code: "import { FundsPage } from '../../../routes/funds';",
        filename: join(fixtures, "components/organisms/FundPanel/index.tsx"),
        errors: [{ messageId: "rankViolation" }],
      },
      // molecule importing organism → error
      {
        code: "import { FundPanel } from '../../organisms/FundPanel';",
        filename: join(fixtures, "components/molecules/FilterBar/index.tsx"),
        errors: [{ messageId: "rankViolation" }],
      },
      // require() call also caught
      {
        code: "const { FilterBar } = require('../../molecules/FilterBar');",
        filename: join(fixtures, "components/atoms/Button/index.tsx"),
        errors: [{ messageId: "rankViolation" }],
      },
    ],
  });
});
