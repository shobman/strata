# @shobman/strata-lint

ESLint plugin for the [Strata](../../README.md) layout protocol. Enforces import boundaries, catches inline chrome, and warns on missing required slot fills.

## Installation

```bash
npm install @shobman/strata-lint
```

Peer dependency: `eslint >=9.0.0`

Also requires `@shobman/strata-cli` (installed as a dependency automatically).

## Setup

ESLint 9 flat config (`eslint.config.js`):

```js
import strataPlugin from "@shobman/strata-lint";

export default [
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    plugins: {
      strata: strataPlugin,
    },
    rules: {
      ...strataPlugin.configs.recommended.rules,
    },
  },
];
```

> **Important**: ESLint 9 flat config won't lint `.tsx` files unless explicitly included in the `files` array. Always include all relevant extensions as shown above.

## Rules

### `strata/import-boundary`

**Severity**: error | **Type**: problem

Prevents importing from higher-rank Strata levels. Atoms cannot import molecules, molecules cannot import organisms, etc.

```
Level       Rank    Can import from
──────────  ────    ───────────────
atom        0       (nothing)
molecule    1       atom
organism    2       atom, molecule
route       3       atom, molecule, organism
```

Same-level imports are always allowed (e.g. one molecule importing another).

```tsx
// components/molecules/FilterBar/index.tsx

import { Button } from "../../atoms/Button";      // rank 0 → OK
import { FundPanel } from "../../organisms/FundPanel"; // rank 2 → ERROR

// Error: Cannot import from 'organism' (rank 2) into 'molecule' (rank 1).
// Import boundary violation.
```

Bare specifiers (node_modules) are skipped — this rule only applies to relative imports between Strata-contracted modules.

### `strata/no-inline-chrome`

**Severity**: warn | **Type**: suggestion

Catches action buttons and toolbars rendered outside `<FillSlot>` in route components. Only applies to files inside a `route`-level contract directory.

**Chrome elements detected**: `Button`, `button`, `IconButton`, `Toolbar`, `toolbar`, `ActionBar`, `Actions`

```tsx
// routes/funds/[fundId]/performance/index.tsx

// WARNS — button outside FillSlot
function PerformancePage() {
  return (
    <div>
      <Button>Run Benchmark</Button>     {/* ⚠ should be in FillSlot */}
      <PerformanceCharts />
    </div>
  );
}

// OK — button inside FillSlot
function PerformancePage() {
  return (
    <>
      <FillSlot name="actions">
        <Button>Run Benchmark</Button>   {/* ✓ projected into slot */}
      </FillSlot>
      <PerformanceCharts />
    </>
  );
}
```

### `strata/required-slots`

**Severity**: warn | **Type**: suggestion

Warns when a route component doesn't fill required ancestor slots. Checks `fills` in the route's `_contract.yml` against `required` slots declared by ancestor layouts.

```yaml
# routes/_contract.yml (ancestor)
layout:
  slots:
    menu: required

# routes/funds/_contract.yml (this route)
fills: []   # ⚠ missing required fill for "menu"
```

```
warning  Required slot 'menu' from 'routes' is not filled by this route.
```

## Recommended Config

The plugin exports a `recommended` config with these defaults:

| Rule | Level |
|------|-------|
| `strata/import-boundary` | `error` |
| `strata/no-inline-chrome` | `warn` |
| `strata/required-slots` | `warn` |

## License

[MIT](../../LICENSE)
