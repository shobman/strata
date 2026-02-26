# Session 5 Reference — Integration Testing

## Status: ✅ Complete

## Full Monorepo Test Count

| Package | Tests | Status |
|---------|-------|--------|
| @shobman/strata-ui | 7 | ✅ |
| @shobman/strata-cli | 62 | ✅ |
| @shobman/strata-lint | 28 | ✅ |
| Integration | 16 | ✅ |
| **Total** | **113** | **✅** |

## Fixture Project

Realistic financial services app at `tests/integration/fixture/`:

```
fixture/
  routes/
    _contract.yml           ← menu (required), breadcrumb, actions; redirect→funds
    _layout.tsx
    funds/
      _contract.yml         ← fills: [menu], slots: {listActions}, default→index
      _layout.tsx
      index/                ← fills: [listActions]
      [fundId]/             ← param: fundId, fills: [breadcrumb, actions], slots: {tabs: required, contextPanel}, default→overview
        _layout.tsx
        overview/           ← fills: [tabs]
        performance/        ← fills: [tabs, contextPanel]
        compliance/         ← fills: [tabs]
  components/
    atoms/Button/
    molecules/FilterBar/
    organisms/FundPanel/
```

Three layout levels with nested SlotProviders. Redirect chain (root → funds), default chain (funds → index, [fundId] → overview). Required slots at root (`menu`) and [fundId] (`tabs`).

## Test Breakdown

### Structural (strata-check-build.test.ts) — 6 tests
1. Build tree → routes + 3 component levels
2. Validate fixture → 0 errors
3. Root has menu:required, breadcrumb, actions
4. Required "menu" satisfied through redirect chain
5. [fundId] inherits 4 ancestor slots
6. 3 nodes generate type files (root, funds, [fundId])

### Negative (strata-negative.test.ts) — 4 tests
7. Missing required slot → error
8. Fill referencing nonexistent slot → error
9. Both default + redirect → error
10. Param route as default → error

### ESLint (eslint-integration.test.ts) — 3 tests
11. Molecule importing atom → pass
12. Atom importing molecule → boundary error
13. Button outside FillSlot in route → chrome warn

### Runtime (runtime.test.tsx) — 3 tests
14. MemoryRouter: menu slot filled at /funds
15. MemoryRouter: breadcrumb + actions at /funds/1
16. Deepest fill wins, navigation reverts

## Issues Encountered

| Issue | Cause | Fix |
|-------|-------|-----|
| YAML parses `[fundId]` as array | Unquoted YAML flow sequence | Quote as `"[fundId]"` in YAML files |
| ESLint Linter returns 0 messages | Flat config needs explicit `files` pattern for .tsx | Added `files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]` |
| `defineRules` throws in ESLint 9 | Legacy API, ESLint 9 defaults to flat config | Used flat config plugin format |

**Note:** The YAML bracket quoting issue means all `_contract.yml` files with param folder names need quotes. The `strata add` command should already generate quoted YAML. Worth verifying in Session 7.

## Workspace Change

`pnpm-workspace.yaml` updated:
```yaml
packages:
  - "packages/*"
  - "tests/*"
```

## File Inventory

```
tests/integration/
  package.json
  tsconfig.json
  vitest.config.ts                    ← jsdom environment
  fixture/                            ← realistic Strata project
    routes/...                        ← 7 route nodes, 3 layout levels
    components/...                    ← atom, molecule, organism examples
  src/
    strata-check-build.test.ts        ← 6 tests
    strata-negative.test.ts           ← 4 tests
    eslint-integration.test.ts        ← 3 tests
    runtime.test.tsx                  ← 3 tests
```

## Notes for Later Sessions

- **Session 6** is independent (designer deployment) — no dependency on integration tests
- **Session 7** should verify that `strata add` generates quoted YAML for bracket params (the `[fundId]` → array parsing issue)
- The fixture project is a useful reference for README examples in Session 7
- Runtime tests confirm the portal stack works with React Router's `<Outlet />` — this is the proof that Strata's core design works end-to-end