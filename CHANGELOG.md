# Changelog

## 0.1.0

Initial release of the Strata layout protocol.

### @shobman/strata-ui

- `SlotProvider` — creates an independent slot registry per layout
- `SlotTarget` — declares named slots, returns null when empty
- `FillSlot` — projects content into ancestor slots via React portals
- Portal stack behaviour: deepest fill wins, previous fills reassert on unmount
- `useSyncExternalStore` architecture for zero-context re-renders
- `data-strata-slot` attribute on rendered slot containers

### @shobman/strata-cli

- `strata init` — scaffold contracts and AI skill file
- `strata check` — validate YAML contracts (7 validation rules)
- `strata build` — generate `.strata.types.ts` from contracts
- `strata add route <path>` — scaffold routes with contract, page, and layout stubs
- `strata add <level> <name>` — scaffold components at atom/molecule/organism level
- Contract engine: parse, walk, resolve, and validate contract trees

### @shobman/strata-lint

- `strata/import-boundary` — prevent imports from higher-rank levels
- `strata/no-inline-chrome` — catch action elements outside `<FillSlot>`
- `strata/required-slots` — warn on missing required ancestor slot fills
- `recommended` config preset

### Strata Architect

- Interactive visual designer for route trees, slots, and contracts
- Deployable as Vite app to GitHub Pages
