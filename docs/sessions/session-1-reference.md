# Session 1 Reference — Core Runtime (@shobman/strata-ui)

## Status: ✅ Complete

## Architecture (Actual)

The implementation diverged from the design doc's suggestion of a `Map<string, HTMLElement | null>` in context. The actual approach is superior:

### SlotRegistry (mutable external store)

A plain class, not React state. Holds:

| Field | Type | Purpose |
|-------|------|---------|
| `targets` | `Map<string, HTMLElement>` | SlotTarget DOM refs |
| `fillStacks` | `Map<string, string[]>` | Ordered stack of fill IDs per slot |
| `listeners` | `Map<string, Set<() => void>>` | Per-slot subscriptions |

### Subscription model: `useSyncExternalStore`

Components subscribe to individual slots, not the whole registry. When a fill mounts/unmounts, only components watching that specific slot re-render. The context value is a stable ref — zero context re-renders ever.

### Stack behaviour

- Fill IDs: monotonic counter (`fill-0`, `fill-1`, ...)
- Last registered wins (deepest in tree mounts last → top of stack)
- `removeFill` splices by ID, new top-of-stack reasserts
- Compatible with React 18 and 19 (no `useId()` dependency)

### Container visibility

SlotTarget returns `null` when no fill is active — confirmed working. Layout containers wrapping a SlotTarget can conditionally render based on this.

## File Inventory

```
packages/strata-ui/
  src/
    types.ts                    53 lines
    SlotContext.ts              87 lines   ← SlotRegistry class + React context
    SlotProvider.tsx            20 lines
    SlotTarget.tsx              42 lines
    FillSlot.tsx                55 lines
    index.ts                    12 lines
    __tests__/strata.test.tsx  225 lines   (7 tests, all passing)
  package.json
  tsconfig.json
  tsup.config.ts                           ESM + CJS + .d.ts
  vitest.config.ts                         jsdom environment
```

Total runtime: ~269 lines.

## Decisions Made

| Decision | Rationale | Watch? |
|----------|-----------|--------|
| `data-strata-slot` attribute on target div | Debug/test selector. No styling. | ✅ Good — useful for integration tests |
| No dev warnings (process.env checks removed) | Broke DTS generation without @types/node | ⚠️ Revisit later — could add with typeof guard |
| Silent null outside SlotProvider | No error boundary, no console.warn | ⚠️ Fine for now, may want dev-mode warning later |
| Monotonic counter for fill IDs | Simpler than useId(), cross-version compatible | ✅ Good choice |

## Test Coverage

1. ✅ Basic slot fill — content renders in SlotTarget position
2. ✅ Multiple fills — deepest wins, unmount reveals previous
3. ✅ Empty slot returns null
4. ✅ Nested providers — independent namespaces
5. ✅ Self-fill pattern — layout baseline, child overrides
6. ✅ Dynamic fill — reactive content updates
7. ✅ Unmount revert

## Notes for Later Sessions

- **Session 2** imports nothing from this package (contract parser is independent)
- **Session 4** (ESLint) may reference `FillSlot` component name for `no-inline-chrome` rule detection
- **Session 5** (integration) will render these components with react-router's MemoryRouter — the `data-strata-slot` attribute will be useful for test selectors
- Dev warnings are a polish item for Session 7