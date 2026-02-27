# Strata

[![npm version](https://img.shields.io/npm/v/@shobman/strata-ui)](https://www.npmjs.com/package/@shobman/strata-ui)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@shobman/strata-ui)](https://bundlephobia.com/package/@shobman/strata-ui)
[![license](https://img.shields.io/npm/l/@shobman/strata-ui)](./LICENSE)

Composable layout protocol for React — named slots, enforceable contracts, AI-agent-ready architecture.

## The Problem

React Router gives you one `<Outlet />`. Real applications need action bars, breadcrumbs, tab strips, and context panels — all owned by different layouts but filled by different pages. Teams solve this with prop drilling, context spaghetti, or inline chrome that breaks when the layout changes. AI coding agents make it worse: they can't see the layout contract, so they render buttons inline instead of projecting them into the right slot.

## The Solution

Strata adds **named slot projection** to React via portals. Each route declares a YAML contract (`_contract.yml`) that specifies which slots it provides and which ancestor slots it fills. Three enforcement layers keep the architecture honest:

- **`strata check`** — validates YAML contracts in CI (no source code needed)
- **`@shobman/strata-lint`** — ESLint rules catch inline chrome and import boundary violations
- **`strata build`** — generates TypeScript types from contracts for compile-time safety

```
Layout declares slots          Page fills them
─────────────────────         ─────────────────
<SlotTarget name="actions"/>  <FillSlot name="actions">
                                <Button>Export</Button>
                              </FillSlot>
```

### Before & After

```tsx
// Before: action bar inlined in page — breaks when layout changes
function PerformancePage() {
  return (
    <div>
      <div className="action-bar">
        <Button>Run Benchmark</Button>
        <Button>Compare Peers</Button>
      </div>
      <PerformanceCharts />
    </div>
  );
}
```

```tsx
// After: actions projected into layout slot — survives layout redesign
function PerformancePage() {
  return (
    <>
      <FillSlot name="actions">
        <Button>Run Benchmark</Button>
        <Button>Compare Peers</Button>
      </FillSlot>
      <PerformanceCharts />
    </>
  );
}
```

### See It in Action

**[Strata Architect](https://shobman.github.io/strata/)** — interactive visual designer for route trees, slots, and contracts.

## What Strata Is NOT

Strata does not constrain what a layout renders. Layouts are regular React components. Slots are projection targets inside that layout, not the layout itself. A layout with zero slots is valid. A page with zero fills is valid. Strata is a protocol for the boundaries between them.

## Installation

```bash
npm install @shobman/strata-ui @shobman/strata-cli
npx strata init
npx strata build
```

## Packages

| Package | Description |
|---------|-------------|
| [`@shobman/strata-ui`](./packages/strata-ui) | Runtime components — `SlotProvider`, `SlotTarget`, `FillSlot` |
| [`@shobman/strata-cli`](./packages/strata-cli) | CLI toolchain — `init`, `check`, `build`, `add` commands |
| [`@shobman/strata-lint`](./packages/strata-lint) | ESLint plugin — import boundaries, inline chrome detection, required slot checks |

## Quick Start

### 1. Define a layout with slots

```tsx
// routes/_layout.tsx
import { SlotProvider, SlotTarget } from "@shobman/strata-ui";

export default function RootLayout() {
  return (
    <SlotProvider>
      <nav>
        <SlotTarget name="menu" />
      </nav>
      <header>
        <SlotTarget name="breadcrumb" />
      </header>
      <main>
        <Outlet />
      </main>
      <footer>
        <SlotTarget name="actions" />
      </footer>
    </SlotProvider>
  );
}
```

### 2. Declare the contract

```yaml
# routes/_contract.yml
level:
  name: route
  rank: 3
layout:
  slots:
    menu: required
    breadcrumb:
    actions:
  redirect: funds
```

### 3. Fill slots from a page

```tsx
// routes/funds/[fundId]/performance/index.tsx
import { FillSlot } from "@shobman/strata-ui";

export default function PerformancePage() {
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

### 4. Validate and generate types

```bash
npx strata check   # validate all contracts
npx strata build   # generate .strata.types.ts files
```

## Works with Journey Stack

Strata is designed to complement the [Journey Stack](https://github.com/shobman/journey-stack) — a full-stack React architecture with file-based routing. Strata adds the layout protocol layer that Journey Stack's routing system needs for multi-slot layouts.

## License

[MIT](./LICENSE)
