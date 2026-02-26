# Session 2 Reference — Contract Parser & Validator (@shobman/strata-cli)

## Status: ✅ Complete

## Architecture (Actual)

### Tree Representation

```
ContractTree {
  routes: ContractNode | null     ← hierarchical tree
  components: ContractNode[]      ← flat array (no nesting)
}

ContractNode {
  path: string                    ← filesystem directory path
  name: string                    ← folder basename (e.g. "funds", "[fundId]")
  contract: StrataContract        ← parsed YAML data
  parent: ContractNode | null     ← back-reference
  children: Map<string, ContractNode>  ← keyed by folder name
}
```

Routes form a tree with parent-child refs. Components (atoms/molecules/organisms) are flat — one level, no hierarchy.

### Walk Strategy: Recursive readdirSync

Not glob. The walker builds parent-child refs during traversal, which requires a single recursive pass. Glob would find files but need a second pass to reconstruct nesting.

Walk rules:
1. Starts at `routes/` and `components/`
2. Each directory: check for `_contract.yml` — if absent, skip entire subtree
3. Parse YAML, create ContractNode, recurse into subdirectories
4. Skip `.hidden`, `node_modules`, `dist`
5. Component dirs walked flat — one level only

`fast-glob` is in dependencies for future CLI commands but unused by the walker.

### Validation Rules (7)

| # | Rule | Level | Description |
|---|------|-------|-------------|
| 1 | fills-reference-real-slots | error | Every fill name must exist as a slot in an ancestor OR own layout |
| 2 | required-slots-satisfied | error | Required slots must be filled through default/redirect chain |
| 3 | default-redirect-exclusive | error | Cannot have both layout.default AND layout.redirect |
| 4 | default-redirect-exists | error | Named child must exist as a subfolder |
| 5 | param-not-default-redirect | error | `[paramName]` routes can't be default or redirect targets |
| 6 | route-level-consistency | warn | Routes/ folder should contain route-level contracts only |
| 7 | component-level-consistency | warn | atoms/ should only contain atom contracts, etc. |

### Slot Resolution (resolve.ts)

- `getAvailableSlots(node)` — walks up ancestors collecting all declared slots
- `isSlotFilledInChain(layout, slotName)` — follows default/redirect chain checking fills at each hop
- Self-fills valid: a route filling its own slot counts (root filling its own `menu`)
- Multi-hop chains work: root → default → default → fill resolves correctly

### Diagnostic Output

```ts
interface Diagnostic {
  level: 'error' | 'warn';
  message: string;
  file: string;
  rule: string;
}
```

## File Inventory

```
packages/strata-cli/
  src/
    index.ts
    contracts/
      types.ts              ← StrataContract, ContractNode, ContractTree, Diagnostic
      parse.ts              ← YAML parsing with shape validation
      walk.ts               ← recursive directory walker, tree builder
      validate.ts           ← 7 validation rules
      resolve.ts            ← slot inheritance, chain fill resolution
      index.ts              ← barrel exports
    __tests__/
      contracts.test.ts     ← 39 tests, real temp directories
  package.json
  tsconfig.json
  tsup.config.ts
  vitest.config.ts
```

## Key Decisions

| Decision | Rationale | Watch? |
|----------|-----------|--------|
| Contract types defined locally, not imported from strata-ui | CLI is standalone — no React dependency needed | ✅ Correct. Types mirror same shape. |
| Recursive readdirSync, not glob | Parent-child refs built during walk, single pass | ✅ Good fit |
| Directories without contracts silently skipped | No phantom nodes — only real contracts appear in tree | ✅ Clean |
| Param detection via `[` `]` bracket check on name string | Simple, no filesystem existence check needed | ✅ Sufficient |
| Self-fills are valid | Validator checks ancestor slots AND own layout slots | ✅ Matches design doc |
| fast-glob in deps but unused | Available for future CLI commands (e.g. `strata add`) | ⚠️ Remove if still unused after Session 3 |

## Edge Cases Handled

- Empty/null YAML → clear parse error
- Missing `_contract.yml` → subtree skipped entirely
- Self-fill (route fills own slot) → valid
- Multi-hop default chains → resolved correctly
- Parameterised route as default target → caught by rule 5

## Test Coverage

39 tests covering:
- YAML parsing (valid, invalid, empty)
- Tree walking (real temp directories with real YAML files)
- All 7 validation rules (pass and fail cases)
- Slot inheritance resolution
- Chain fill resolution (multi-hop)

## Notes for Later Sessions

- **Session 3** builds CLI commands on top of this. The walker, validator, and resolver are the engine — Session 3 wires them into `commander.js` commands.
- **Session 4** (ESLint) imports the contract parser from this package. The barrel export at `contracts/index.ts` is the integration surface.
- **Session 5** will exercise the validator end-to-end with a realistic fixture project.
- `fast-glob` dep: if Session 3 doesn't use it, remove in Session 7 polish.