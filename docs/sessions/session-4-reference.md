# Session 4 Reference — ESLint Plugin (@shobman/strata-lint)

## Status: ✅ Complete

## Rules

### `strata/import-boundary` (error)

Fires on `ImportDeclaration` and `require()` calls. Resolves both the importing and imported file paths, finds nearest `_contract.yml` for each, compares ranks. Higher-rank imports from lower-rank → pass. Equal or reverse → error.

Exceptions:
- `node_modules` imports always allowed
- Same-level imports within same folder allowed

### `strata/no-inline-chrome` (warn)

Heuristic detection of action elements rendered outside `<FillSlot>` in route files.

**Flagged element names:**
- `Button`, `button`
- `IconButton`
- `Toolbar`, `toolbar`
- `ActionBar`
- `Actions`

**Detection algorithm:**
1. Visit every `JSXOpeningElement`
2. Check if element name is in chrome set
3. Walk up `node.parent` chain looking for a `JSXElement` with name `FillSlot`
4. Inside FillSlot → pass. Not inside → warn.

**Scope:** Only files where nearest `_contract.yml` has `level.name === "route"`. Molecule/organism/atom files skipped entirely.

### `strata/required-slots` (warn)

Reads route's `_contract.yml` fills array, walks up ancestors collecting all required slots. If a required slot exists in an ancestor and this route doesn't list it in fills → warn. Static hint only — `strata check` does definitive chain validation.

## Contract Lookup Caching

Module-level `Map<string, StrataContract | null>` keyed by directory path. Persists for entire ESLint process (one lint run).

- Each directory looked up at most once
- `null` cached for directories without `_contract.yml` (prevents repeated `existsSync` calls)
- `clearContractCache()` exported for tests

## Plugin Export (ESLint v9 Flat Config)

```js
export default {
  rules: {
    "import-boundary": importBoundaryRule,
    "no-inline-chrome": noInlineChromeRule,
    "required-slots": requiredSlotsRule,
  },
  configs: {
    recommended: {
      rules: {
        "strata/import-boundary": "error",
        "strata/no-inline-chrome": "warn",
        "strata/required-slots": "warn",
      },
    },
  },
};
```

Usage:
```js
import strataPlugin from '@shobman/strata-lint';
export default [{
  plugins: { strata: strataPlugin },
  rules: strataPlugin.configs.recommended.rules,
}];
```

## Cross-Package Dependency

`@shobman/strata-cli` imported via `"workspace:*"` protocol. Resolves through `dist/index.js` (strata-cli must be built first). Imports `parseContractFile` and `StrataContract` type from the CLI package. No issues.

## File Inventory

```
packages/strata-lint/
  src/
    index.ts                      ← plugin entry, rules + recommended config
    rules/
      import-boundary.ts          ← rank comparison on import/require
      no-inline-chrome.ts         ← JSX chrome element detection
      required-slots.ts           ← ancestor slot fill checking
    utils/
      contract-lookup.ts          ← cached contract resolution
    __tests__/
      import-boundary.test.ts     ← 12 tests
      no-inline-chrome.test.ts    ← 11 tests
      required-slots.test.ts      ← 5 tests
      fixtures/                   ← contract tree for tests
  package.json
  tsconfig.json
  tsup.config.ts
  vitest.config.ts
```

Total: 28 tests passing.

## Key Decisions

| Decision | Rationale | Watch? |
|----------|-----------|--------|
| Module-level cache, not per-rule | Single lookup per directory across all rules in one lint run | ✅ Correct |
| `null` caching for missing contracts | Avoids repeated filesystem checks on parent dirs | ✅ Good perf |
| Chrome element list is hardcoded | Heuristic, not exhaustive — covers common patterns | ⚠️ May need expansion over time |
| Parent chain walk for FillSlot detection | Simple AST walk, no scope analysis needed | ✅ Sufficient |
| ESLint v9 flat config only | Modern format, RuleTester integrates with vitest globals | ✅ Forward-looking |
| `required-slots` is a warn, not error | Static hint — `strata check` is the definitive validator | ✅ Correct layering |

## Notes for Later Sessions

- **Session 5** will run ESLint with this plugin against the fixture project. The `fixtures/` directory in tests is small — the integration fixture will be more realistic.
- **Session 7** could expand the chrome element list or make it configurable via rule options.
- Build order matters: `strata-cli` must build before `strata-lint` (import dependency). Ensure monorepo build script respects this (`pnpm -r build` with topological sort should handle it).