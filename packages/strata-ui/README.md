# @shobman/strata-ui

[![npm version](https://img.shields.io/npm/v/@shobman/strata-ui)](https://www.npmjs.com/package/@shobman/strata-ui)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@shobman/strata-ui)](https://bundlephobia.com/package/@shobman/strata-ui)
[![license](https://img.shields.io/npm/l/@shobman/strata-ui)](../../LICENSE)

Runtime components for the [Strata](../../README.md) layout protocol. Named slot projection via React portals with zero-context-rerender architecture.

## Installation

```bash
npm install @shobman/strata-ui
```

Peer dependencies: `react ^18 || ^19`, `react-dom ^18 || ^19`

## API

### `<SlotProvider>`

Creates an independent slot registry. Wrap each layout that declares slots.

```tsx
import { SlotProvider } from "@shobman/strata-ui";

function MyLayout() {
  return (
    <SlotProvider>
      <SlotTarget name="header" />
      <main>
        <Outlet />
      </main>
    </SlotProvider>
  );
}
```

| Prop | Type | Description |
|------|------|-------------|
| `children` | `ReactNode` | Layout content containing `SlotTarget` and child routes |

Each `SlotProvider` instance gets its own registry. Nested providers do not share state with ancestors — this is by design, so each layout level manages its own slots independently.

### `<SlotTarget>`

Declares a named slot in a layout. Renders a `<div>` when filled, returns `null` when empty.

```tsx
import { SlotTarget } from "@shobman/strata-ui";

<SlotTarget name="actions" />
// Renders: <div data-strata-slot="actions">...projected content...</div>
// Or: null (when no FillSlot targets this name)
```

| Prop | Type | Description |
|------|------|-------------|
| `name` | `string` | Slot name matching `_contract.yml` slot declarations |

**Container visibility**: When no `FillSlot` targets a slot, `SlotTarget` returns `null` — the container doesn't render at all. This means layouts can conditionally show/hide regions based on whether child pages fill them.

**`data-strata-slot` attribute**: Every rendered `SlotTarget` includes a `data-strata-slot` attribute with the slot name. Use this for testing (`screen.getByTestId` patterns with wrapper elements) and debugging (inspect the DOM to see which slots are active).

### `<FillSlot>`

Projects content into a named `SlotTarget` via a React portal.

```tsx
import { FillSlot } from "@shobman/strata-ui";

function PerformancePage() {
  return (
    <>
      <FillSlot name="tabs">
        <TabStrip items={["Returns", "Benchmark", "Risk"]} />
      </FillSlot>
      <FillSlot name="actions">
        <Button>Run Benchmark</Button>
      </FillSlot>
      <PerformanceCharts />
    </>
  );
}
```

| Prop | Type | Description |
|------|------|-------------|
| `name` | `string` | Slot name to project into |
| `children` | `ReactNode` | Content to render inside the slot |

**Portal stack behaviour**: Multiple `FillSlot` components targeting the same slot form a stack. The most recently mounted (deepest in the route tree) fill renders. When it unmounts, the previous fill reasserts.

```
/funds/3/performance
  actions slot stack:
    performance fills:  [Run Benchmark] [Compare]  ← top, rendered
    [fundId] fills:     [Edit Fund] [Export]        ← underneath

Navigate to /funds/3/overview (doesn't fill actions):
    [fundId] fills:     [Edit Fund] [Export]        ← now on top, rendered
```

**Self-filling slots**: A layout can fill its own slots to provide defaults that child routes can override:

```tsx
function FundsLayout() {
  return (
    <>
      <FillSlot name="listActions">
        <Button>Default Action</Button>
      </FillSlot>
      <SlotProvider>
        <SlotTarget name="listActions" />
        <Outlet />
      </SlotProvider>
    </>
  );
}
```

## Design Highlights

**`useSyncExternalStore` architecture**: Both `SlotTarget` and `FillSlot` subscribe to the slot registry using React's `useSyncExternalStore`. This means:

- Per-slot subscriptions — only components interested in a specific slot re-render when it changes
- Zero context-driven re-renders — the registry is a ref-stable object, not context state
- Concurrent mode compatible — `useSyncExternalStore` handles tearing prevention

## Exported Types

```typescript
import type {
  SlotProviderProps,
  SlotTargetProps,
  FillSlotProps,
  StrataContract,
  StrataLevel,
  StrataLayout,
} from "@shobman/strata-ui";
```

| Type | Description |
|------|-------------|
| `SlotProviderProps` | `{ children: ReactNode }` |
| `SlotTargetProps` | `{ name: string }` |
| `FillSlotProps` | `{ name: string; children: ReactNode }` |
| `StrataContract` | Full contract shape matching `_contract.yml` |
| `StrataLevel` | `{ name: "atom" \| "molecule" \| "organism" \| "route"; rank: 0 \| 1 \| 2 \| 3 }` |
| `StrataLayout` | `{ slots?: Record<string, "required" \| null>; default?: string; redirect?: string }` |

## License

[MIT](../../LICENSE)
