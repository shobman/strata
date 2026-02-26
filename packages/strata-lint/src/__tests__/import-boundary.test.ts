import { RuleTester } from "eslint";
import { describe, beforeEach } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import importBoundaryRule from "../rules/import-boundary.js";
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

describe("strata/import-boundary", () => {
  beforeEach(() => {
    clearContractCache();
  });

  ruleTester.run("import-boundary", importBoundaryRule, {
    valid: [
      // 2. molecule importing atom → pass (lower rank)
      {
        code: "import { Button } from '../../atoms/Button';",
        filename: join(fixtures, "components/molecules/FilterBar/index.tsx"),
      },
      // 3. route importing organism → pass (lower rank)
      {
        code: "import { FundPanel } from '../../components/organisms/FundPanel';",
        filename: join(fixtures, "routes/funds/index.tsx"),
      },
      // 5. same-level import → pass (molecule importing molecule)
      {
        code: "import { SearchBar } from '../SearchBar';",
        filename: join(fixtures, "components/molecules/FilterBar/index.tsx"),
      },
      // 6. node_modules import → pass (bare specifier, always allowed)
      {
        code: "import React from 'react';",
        filename: join(fixtures, "components/atoms/Button/index.tsx"),
      },
      // route importing atom → pass (lower rank)
      {
        code: "import { Button } from '../../components/atoms/Button';",
        filename: join(fixtures, "routes/funds/index.tsx"),
      },
      // route importing molecule → pass (lower rank)
      {
        code: "import { FilterBar } from '../../components/molecules/FilterBar';",
        filename: join(fixtures, "routes/funds/index.tsx"),
      },
      // file outside any contract → no restriction
      {
        code: "import { anything } from './something';",
        filename: "/tmp/no-contract/index.ts",
      },
    ],

    invalid: [
      // 1. atom importing molecule → error (higher rank)
      {
        code: "import { FilterBar } from '../../molecules/FilterBar';",
        filename: join(fixtures, "components/atoms/Button/index.tsx"),
        errors: [{ messageId: "importBoundaryViolation" }],
      },
      // 4. organism importing route → error (higher rank)
      {
        code: "import { FundsPage } from '../../../routes/funds';",
        filename: join(
          fixtures,
          "components/organisms/FundPanel/index.tsx",
        ),
        errors: [{ messageId: "importBoundaryViolation" }],
      },
      // molecule importing organism → error (higher rank)
      {
        code: "import { FundPanel } from '../../organisms/FundPanel';",
        filename: join(
          fixtures,
          "components/molecules/FilterBar/index.tsx",
        ),
        errors: [{ messageId: "importBoundaryViolation" }],
      },
      // atom importing organism → error (higher rank)
      {
        code: "import { FundPanel } from '../../organisms/FundPanel';",
        filename: join(fixtures, "components/atoms/Button/index.tsx"),
        errors: [{ messageId: "importBoundaryViolation" }],
      },
      // require() call also caught
      {
        code: "const { FilterBar } = require('../../molecules/FilterBar');",
        filename: join(fixtures, "components/atoms/Button/index.tsx"),
        errors: [{ messageId: "importBoundaryViolation" }],
      },
    ],
  });
});
