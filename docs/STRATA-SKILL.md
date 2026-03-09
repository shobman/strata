# Strata Skill — AI Agent Rules for Layout Architecture

## Purpose

Strata is a design system that forces consistent UX across every page of an application. It separates **layout chrome** (titles, actions, tabs, filters) from **page content** (tables, forms, cards) using contracts and slots. This prevents AI agents from drifting on UX — every page looks right because no page controls its own chrome.

## How It Works

```
_contract.yml  →  declares what a route fills and what slots it provides
_layout.tsx    →  owns chrome rendering (SlotProvider + SlotTarget + Outlet)
index.tsx      →  fills slots + renders content (FillSlot + page body)
```

The contract is the **source of truth**. Write it first. The linter enforces everything after.

---

## Contract-First Workflow

**Always write the contract before writing any TSX.**

1. Decide what this route IS — does it fill ancestor slots? does it declare its own slots for children?
2. Create `_contract.yml` with `fills` and optionally `layout.slots`
3. Run `strata check` — the contract rules validate it against ancestors
4. Write the TSX — the route rules will warn until every fill is implemented

This order matters. The contract forces you to think about the page's role in the layout hierarchy before writing a single line of UI code.

---

## Slot Escalation — When to Create Slots

A piece of UI should become a slot when:

- It appears in **the same visual position** across multiple routes (e.g. page title, action buttons)
- It needs to render **outside the content area** (sticky header, sidebar, footer bar)
- Changing it in one place should change the **rendering container** everywhere

A piece of UI should stay inline when:

- It's unique to this page
- It renders within the content flow
- It doesn't need consistent positioning across pages

**The test:** If an AI building a new page would need to copy CSS positioning from another page to place this element, it should be a slot instead.

---

## Before Writing Any Code

1. Find `_contract.yml` in your target folder
2. Walk UP the folder tree reading each ancestor `_contract.yml`
3. You now know: your level, your fills, all available ancestor slots

If there is no `_contract.yml`, create one first. Every route needs a contract.

---

## Route Components (index.tsx)

When building a route component:

- Read your `_contract.yml` `fills` array — these are the slots you MUST fill
- For each fill, render `<FillSlot name="slotName">` with content
- Everything else renders as direct page content
- **Never** position UI chrome (titles, actions, toolbars) with CSS — fill a slot

```tsx
export function DevicesPage() {
  return (
    <>
      <FillSlot name="route-title">
        <h1>Devices</h1>
      </FillSlot>
      <FillSlot name="route-actions">
        <Button onClick={handleNew}>+ New Device</Button>
      </FillSlot>
      <FillSlot name="filter-panel">
        <FilterBar filters={filters} onChange={updateSearch} />
      </FillSlot>

      <VirtualTable columns={deviceColumns} queryResult={result} />
    </>
  );
}
```

The `VirtualTable` renders in the content area. The title, actions, and filters project into the layout shell's sticky zones. The page never decides WHERE any of this renders.

---

## Layout Components (_layout.tsx)

When building a layout component:

- Read `_contract.yml` `layout.slots` — these are the slot targets you render
- Wrap in `<SlotProvider>`
- Use `<SlotTarget name="slotName" />` for each declared slot
- Render `<Outlet />` for child route content
- Position slot targets in the appropriate chrome zones (header, sidebar, sticky bar)

```tsx
export function PageLayout({ children }) {
  return (
    <SlotProvider>
      <header>
        <SlotTarget name="route-title" />
        <SlotTarget name="route-actions" />
      </header>
      <nav>
        <SlotTarget name="tabs" />
      </nav>
      <SlotTarget name="filter-panel" />
      <main>{children}</main>
    </SlotProvider>
  );
}
```

### Self-Filling Slots

A layout can fill its own slots as defaults. Children override by mounting their own `<FillSlot>` — the deepest fill wins.

---

## Rank Boundaries

Components are ranked by complexity. Lower ranks cannot import higher ranks.

| Level | Rank | Can import |
|-------|------|-----------|
| atom | 0 | nothing from hierarchy |
| molecule | 1 | atoms only |
| organism | 2 | atoms, molecules |
| route | 3 | atoms, molecules, organisms |

An organism importing from a route is always wrong. A molecule importing from an organism is always wrong.

---

## Folder Structure

Contracts and implementations are co-located:

```
src/
├── routes/
│   ├── _contract.yml          # root layout contract
│   ├── _layout.tsx            # root layout (SlotProvider + SlotTargets)
│   ├── _layout.module.css
│   ├── dashboard/
│   │   ├── _contract.yml
│   │   └── index.tsx
│   ├── devices/
│   │   ├── _contract.yml
│   │   ├── index.tsx          # list page
│   │   ├── new/
│   │   │   ├── _contract.yml
│   │   │   └── index.tsx
│   │   └── [id]/
│   │       ├── _contract.yml
│   │       └── index.tsx
│   └── reports/
│       ├── _contract.yml
│       ├── _layout.tsx        # intermediate layout (tabs)
│       ├── devices/
│       │   ├── _contract.yml
│       │   └── index.tsx
│       └── services/
│           ├── _contract.yml
│           └── index.tsx
├── components/
│   ├── atoms/
│   │   ├── _contract.yml
│   │   ├── Button.tsx
│   │   └── Input.tsx
│   ├── molecules/
│   │   ├── _contract.yml
│   │   └── StatusBadge.tsx
│   └── organisms/
│       ├── _contract.yml
│       ├── VirtualTable.tsx
│       └── FilterBar.tsx
├── infrastructure/            # hooks, API clients, utilities
└── types/                     # TypeScript type definitions
```

**Key conventions:**
- Route folders mirror URL structure exactly
- `_contract.yml` sits next to its `index.tsx` or `_layout.tsx`
- Components live under `components/` with their level's `_contract.yml`
- Non-component code (hooks, utils, API clients) goes in `infrastructure/`

---

## Adding Routes

Prefer `strata add route <path>` which scaffolds contract + stub:

```bash
strata add route devices/[id] --fills route-title,route-actions --param id
```

If building manually:
1. Create the folder under the correct parent in `src/routes/`
2. Create `_contract.yml` first — decide fills and slots
3. Create `index.tsx` (or `_layout.tsx` if it declares slots)
4. Run `strata check` and `strata build`

---

## Adding Components

Prefer `strata add <level> <Name>`:

```bash
strata add molecule SearchBar
```

If building manually:
1. Determine the level: primitive (atom), composition (molecule), feature block (organism)
2. Create it in `src/components/<level>s/`
3. Verify imports respect rank boundaries
4. Components don't know about slots — that's the route's job

---

## Lint Rules

Five rules enforce the system:

| Rule | Layer | What it catches |
|------|-------|----------------|
| `strata/contract-filled` | Contract | Required ancestor slot missing from fills chain |
| `strata/contract-overfill` | Contract | Fill references a slot that no ancestor declares |
| `strata/route-filled` | Implementation | Contract says fill X, but TSX has no `<FillSlot name="X">` |
| `strata/route-overfill` | Implementation | TSX has `<FillSlot name="X">` but contract doesn't list X in fills |
| `strata/rank-violation` | Architecture | Import from equal or higher rank level |

The contract rules validate YAML against YAML. The route rules validate TSX against its own YAML. Neither crosses the boundary.

---

## Adopting Strata in an Existing Project

If you're adding Strata to a project that already has pages and components:

1. Run `strata init` — creates contract stubs and skill file
2. Move contracts into `src/` alongside your source files
3. Move components into `src/components/atoms|molecules|organisms/` with their contracts
4. Move pages into `src/routes/<domain>/index.tsx` alongside their contracts
5. Update all imports to reflect the new paths
6. Create missing contracts for any routes that don't have one
7. Run `strata check` to validate, `strata build` to generate types
8. Run the linter — fix warnings until clean

The key refactor: contracts and implementations must be co-located. If your contracts are in a separate tree from your source files, the lint rules can't connect them.

---

## Default and Redirect Routes

- `layout.default: child` — child renders at parent's URL (index route)
- `layout.redirect: child` — parent URL redirects to child's URL
- Never set a parameterised route as default or redirect

These are **router-level concerns**. Implement them in the router configuration (e.g. `beforeLoad` redirect in TanStack Router, `redirect` in React Router loader), **not** in page components. The contract declares the intent; the router implements the behaviour.

```tsx
// TanStack Router example — contract says redirect: devices
createRoute({
  path: '/reports',
  beforeLoad: () => { throw redirect({ to: '/reports/devices' }); },
});
```

---

## Using the Linter as Feedback

After implementing a route, **always run the linter to validate your work**:

```bash
npx strata check        # contract-level validation (YAML ↔ YAML)
npx eslint src/routes/  # route-level validation (TSX ↔ own YAML)
```

The linter will tell you exactly what's wrong:
- Missing a `<FillSlot>` for a declared fill → `strata/route-filled`
- Extra `<FillSlot>` not in your contract → `strata/route-overfill`
- Required ancestor slot unfilled → `strata/contract-filled`
- Filling a slot no ancestor declares → `strata/contract-overfill`

Fix warnings until clean. If the linter is happy, the layout architecture is correct.

---

## Understanding the Architecture

Before modifying routes, understand the full tree:

```bash
npx strata tree          # pretty-print the route/slot hierarchy
npx strata tree --json   # machine-readable format
```

This shows every route, its slots, fills, and default/redirect declarations — giving you the complete picture of how layouts nest before you make changes.

---

## Key Principles

1. **Contract first.** Write `_contract.yml` before writing TSX.
2. **Pages fill slots. Layouts own chrome.** The page never decides WHERE content renders.
3. **The contract is the documentation.** Read `_contract.yml`, know everything about a route.
4. **Filesystem is architecture.** Folder structure = route nesting = layout hierarchy.
5. **Slots prevent drift.** If it needs consistent positioning, it's a slot, not inline CSS.
6. **The linter is the enforcer.** Contract rules catch design errors. Route rules catch implementation gaps.
