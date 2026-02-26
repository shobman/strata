# Strata — Design Protocol for React Layout Architecture

## What Strata Is

Strata is a composable layout protocol for React applications that solves two problems no existing tool addresses:

1. **React Router only has one outlet.** Pages can't project content into multiple named regions of a parent layout (action bars, sidebars, breadcrumbs, tabs). Strata adds named slot projection via portals.
2. **AI agents ignore layout architecture.** They build every page as a standalone component with ad-hoc chrome. Strata provides enforceable contracts that agents read and follow.

Strata is 90% protocol, 10% runtime. The runtime is a thin portal layer (~200 lines). The value is the contract format, filesystem conventions, linting, and AI skill.

## Package: `@shobman/strata-ui`

Companion to `journey-stack` (which handles navigation state). Strata handles layout structure.

Future packages:
- `@shobman/strata-lint` — ESLint plugin
- `@shobman/strata-cli` — scaffolding and validation

---

## Core Concepts

### The Dual-Hat Route

Every route node in a Strata app is potentially both:
- A **page** looking UP — filling slots declared by ancestor layouts
- A **layout** looking DOWN — declaring slots for its children and rendering `<Outlet />`

The root layout is the only node that never fills. The deepest leaf is the only node that never declares slots. Everything in between is both.

### Four Levels (Simplified Atomic Design)

Strata collapses Atomic Design's five levels to four:

| Level | Rank | Description |
|-------|------|-------------|
| atom | 0 | Primitive component, no component children (Button, Input, Label) |
| molecule | 1 | Small composition of atoms (FilterBar, FormField, BreadcrumbTrail) |
| organism | 2 | Group of molecules, highest "building block" level (FundSearchPanel, HoldingsGrid) |
| route | 3 | Route node. Fills parent slots, may declare child slots. Contains `<Outlet />` |

The original "template" and "page" levels collapse into "route" — because a route IS both a template (looking down) and a page (looking up).

Import boundary rule: **you can only import from levels with a lower rank.**

### Slots and Fills

**Slots** are named holes a layout declares. They are purely structural — no type constraints on what fills them. A slot is just a name and optionally `required`.

**Fills** are content a route projects into ancestor slots (or its own slots). A route can fill:
- Ancestor slots (projecting upward via portals)
- Its own slots (self-fill as a baseline, overridden by children)

**Overrides**: When a child fills a slot that an ancestor already fills, the child's content wins while mounted. On unmount, the ancestor's fill reasserts. This is the natural portal stack — deepest mounted route wins.

### Slot Container Visibility

Universal rule: **if a slot isn't filled, its container doesn't render.** `SlotTarget` returns null when empty. The layout wraps each slot target in whatever chrome it wants (borders, panels, sidebars) — the wrapper never mounts when the slot is empty. No YAML flag needed.

### Default and Redirect

Each route with children can specify one of:
- **`default: childName`** — the child renders at the parent's URL as an index route. No URL segment added. (Like React Router's index route.)
- **`redirect: childName`** — the parent URL redirects to the child's URL. The child gets its own URL segment. (Like React Router's `<Navigate replace />`.)

These are mutually exclusive. Only static (non-parameterised) children can be defaults or redirects — dynamic routes require a value.

The parent declares this, not the child. Single source of truth, no cross-file coordination.

### Validation Through the Chain

When `strata check` validates required slots, it follows the default/redirect chain:

```
Root (requires: menu)
  → redirects to funds
    → funds fills menu? No.
      → defaults to index
        → index fills menu? Yes. ✓ Valid.
```

If nothing in the chain fills a required slot, that's an error.

---

## Contract Format: `_contract.yml`

A YAML file at every boundary in the tree. One per route folder, one per component level folder.

### Route Contract

```yaml
# routes/funds/[fundId]/_contract.yml
param: fundId
level:
  name: route
  rank: 3
fills: [breadcrumb, actions, tabs]
layout:
  slots:
    tabs: required
    contextPanel:
  default: overview
```

### Component Contract

```yaml
# components/molecules/_contract.yml
level:
  name: molecule
  rank: 1
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `param` | No | Route parameter name for dynamic segments |
| `level.name` | Yes | atom, molecule, organism, or route |
| `level.rank` | Yes | 0, 1, 2, or 3 |
| `level.canImport` | No | Override: which levels can be imported. Inferred from rank if absent. |
| `fills` | No | Array of slot names this route fills (self or ancestor) |
| `layout.slots` | No | Map of slot declarations. Value is `required` or empty. |
| `layout.default` | No | Child name that renders at parent URL (index route) |
| `layout.redirect` | No | Child name that parent redirects to |

### Variants (for conditional layouts)

```yaml
variants: [flagship, standard]
default: standard
resolve: fund.isFlagship
```

Variant slot definitions live in `_slots.flagship.yml` and `_slots.standard.yml` alongside the contract. The resolver logic lives in `_resolve.ts`.

---

## Filesystem Convention

The filesystem mirrors the route tree. `_contract.yml` lives at every boundary.

```
routes/
  _contract.yml              ← root layout contract
  _layout.tsx                ← root layout component

  funds/
    _contract.yml            ← funds area contract
    _layout.tsx

    index/
      _contract.yml          ← fund list (default of funds)
      index.tsx

    [fundId]/
      _contract.yml          ← fund detail contract (param: fundId)
      _layout.tsx

      overview/
        _contract.yml        ← default of [fundId]
        index.tsx

      performance/
        _contract.yml
        index.tsx

      holdings/
        _contract.yml
        _layout.tsx

        index/
          _contract.yml      ← redirect target of holdings
          index.tsx

        [holdingId]/
          _contract.yml
          index.tsx

components/
  atoms/
    _contract.yml
    Button/index.tsx
    Input/index.tsx

  molecules/
    _contract.yml
    FilterBar/index.tsx
    FormField/index.tsx

  organisms/
    _contract.yml
    FundSearchPanel/index.tsx
    FundTable/index.tsx
```

Rules:
- Has `_layout.tsx` → it's a layout with an `<Outlet />`
- No `_layout.tsx` → it's a leaf, renders content only
- `_contract.yml` is always generated/managed by Strata tooling, never hand-edited
- Implementation files (`.tsx`) are created as stubs if missing, never overwritten

---

## Runtime: Three Components

### `SlotProvider`

Wraps a layout. Creates a context with named DOM targets for slots.

### `SlotTarget`

Renders in the layout where a slot should appear. Returns null when no fill is active (so the wrapping container doesn't mount).

```tsx
const FundDetailLayout = () => (
  <SlotProvider>
    <header><SlotTarget name="breadcrumb" /></header>
    <nav><SlotTarget name="tabs" /></nav>
    <main><Outlet /></main>
    <aside><SlotTarget name="contextPanel" /></aside>
    <footer><SlotTarget name="actions" /></footer>
  </SlotProvider>
);
```

### `FillSlot`

Used by pages/routes to project content into a named slot. Uses React portals to render into the `SlotTarget` DOM node.

```tsx
const OverviewPage = () => (
  <>
    <FillSlot name="tabs">
      <TabStrip items={['Summary', 'Key Facts', 'Documents']} />
    </FillSlot>
    <FillSlot name="contextPanel">
      <FundMetadataSidebar fundId={fundId} />
    </FillSlot>
    {/* Main content renders naturally via Outlet */}
    <FundOverviewContent fundId={fundId} />
  </>
);
```

### Portal Stack Behaviour

Multiple fills for the same slot form a stack. Deepest mounted route wins. On unmount, the previous fill reasserts.

```
/funds/3/performance

actions slot stack:
  performance:  [Run Benchmark] [Compare]  ← top, rendered
  [fundId]:     [Edit Fund] [Export]        ← underneath, waiting

Navigate to /funds/3/overview (doesn't fill actions):
  [fundId]:     [Edit Fund] [Export]        ← now on top, rendered
```

---

## Enforcement Layers

### 1. `strata check` (structural validation)

Reads YAML only, no source code. Fast. Runs in CI.
- Every `fills` reference resolves to a real slot in an ancestor `_contract.yml`
- Required slots are satisfied through the default/redirect chain
- Variant names are consistent
- Rank hierarchy is valid
- No circular dependencies

### 2. ESLint Plugin (`@shobman/strata-lint`)

Source code enforcement. Reads nearest `_contract.yml` and walks up.

Key rules:
- `strata/import-boundary` — rank violations (molecule importing from organism)
- `strata/no-inline-chrome` — buttons/actions outside `FillSlot`
- `strata/required-slots` — required slot not filled in component
- `strata/composition-level` — atoms composing other components

### 3. TypeScript Types (generated by `strata build`)

Generated from YAML contracts:

```ts
// generated from routes/funds/[fundId]/_contract.yml
export type FundDetailSlots = 'tabs' | 'contextPanel';
export type FundDetailRequiredSlots = 'tabs';
export type FundDetailInheritedSlots = 'breadcrumb' | 'actions';
export type FundDetailAllSlots = FundDetailSlots | FundDetailInheritedSlots;
```

---

## CLI: `strata`

### `strata init`

First-run setup. Scaffolds the project structure and copies configuration files from the installed package into the project:

```bash
npx strata init
```

Produces:

```
✓ Created .claude/skills/STRATA-SKILL.md
✓ Created .eslintrc.strata.js
✓ Created components/atoms/_contract.yml
✓ Created components/molecules/_contract.yml
✓ Created components/organisms/_contract.yml
✓ Created routes/_contract.yml
✓ Added strata scripts to package.json
```

The skill file is copied into the project so it's version-controlled and customisable. Future updates can be merged via `strata update-skill`.

### `strata check`

Validate all contracts. Reads YAML only, no source code. Fast. Runs in CI.

### `strata build`

Generate TypeScript types from YAML contracts. Produces `.strata.types.ts` files next to each `_contract.yml`. These are gitignored and always regenerated.

### `strata add`

Scaffold new routes and components with contracts and stubs.

```bash
strata check
strata build
strata add route funds/[fundId]/compliance
strata add molecule SearchBar
```

### `strata dev` (future)

Launches the Strata Architect designer locally, hydrated from real `_contract.yml` files on disk. Provides a visual round-trip:

1. Designer reads contracts from filesystem
2. Edit architecture visually — add routes, slots, fills
3. Designer writes `_contract.yml` files back to disk
4. `strata build` regenerates types
5. Filesystem watcher keeps designer and YAML in sync

Can also export the architecture as CLI commands for sharing or replay:

```bash
strata add route funds --fills menu --default index
strata add route funds/[fundId] --fills breadcrumb,actions --slots tabs,contextPanel --default overview
```

`strata build` rules:
- `_contract.yml` → always source of truth
- Generated `.ts` type files → always overwritten
- Implementation `.tsx` files → created as stubs if missing, never overwritten
- Deletions → warn but don't delete

---

## Relationship to Journey Stack

Journey Stack manages **navigation state** — parallel workspaces, history stacks, significance resolution, back traversal.

Strata manages **layout structure** — where content renders, what slots exist, how pages compose into layouts.

They're complementary:
- Journey Stack decides WHICH route is active and HOW you got there
- Strata decides WHERE the route's content renders and WHAT structure it fills

Presentation modes (page, master-detail, modal, slide-over) bridge the two: Journey Stack tracks the navigation context, Strata's layout reads the mode and rearranges slot targets accordingly.

---

## Design Decisions Log

1. **Four levels, not five.** Template and page collapsed into "route" because every route is both.
2. **Slots have no type constraints.** No `accepts: molecule`. A slot is just a hole. Removed because hints were wrong more than right.
3. **Self-fills.** A layout fills its own slots as a baseline. Children override on mount, revert on unmount.
4. **Contracts are YAML, not TypeScript.** Parseable by AI agents without compilation. CLI generates TS types from YAML.
5. **Distributed, not centralised.** One `_contract.yml` per boundary, not one manifest file. The filesystem IS the architecture.
6. **Default/redirect on parent, not child.** Single source of truth. No `index: true` flag on children.
7. **Parameterised routes excluded from default/redirect.** They require runtime data. Structural contracts don't hold data.
8. **Slot container visibility is a runtime rule, not a contract field.** Universal: empty slot → container doesn't render.
9. **URL-driven visual state.** The Strata Architect designer derives all highlighting from the URL, not from click events. Bottom-up resolution algorithm.
10. **Skill file lives in the project, not the package.** `strata init` copies it to `.claude/skills/` so it's version-controlled and customisable per project.

---

## Strata Architect (Visual Designer)

An interactive React tool for visually designing the layout/slot architecture. Included in the `docs/` folder of the repository.

### What It Does

- Displays the full route tree with vertical nesting and horizontal sibling tabs
- Shows slots (holes going down) and fills (plugs going up) per route node
- Detects and highlights override fills (child replacing parent's fill)
- Self-fills shown with distinct ◆ badge
- Default (⌂) and redirect (→) indicators on tabs
- URL bar computing the resolved URL from the active path
- URL-driven selection: bottom-up resolution determines solid (URL segment) vs ghost (default/redirect) highlighting
- Generates `_contract.yml` YAML for every route node
- Properties panel for editing slots, fills, params, defaults/redirects

### Deployment Options

| Option | When | How |
|--------|------|-----|
| GitHub Pages | Now | Wrap in Vite, deploy to `shobman.github.io/strata-ui`. Best marketing asset — people understand the protocol in 30 seconds. |
| `strata dev` | Future | CLI launches designer locally, reads real `_contract.yml` files from disk. Visual round-trip: edit → save YAML → rebuild types. |
| CLI export | Future | Designer exports architecture as `strata add` commands for replay/sharing. |

### Bottom-Up Selection Algorithm

The designer resolves visual state from the active path using a bottom-up walk:

1. Walk to the deepest active leaf, collecting the path
2. From the deepest node, walk UP:
   - Is this node its parent's default? → parent = solid, self = ghost-default, continue up
   - Is this node its parent's redirect target? → self = solid, parent = ghost-redirect, stop
   - Neither? → self = solid, stop

This correctly handles: redirect chains clearing when you navigate away, defaults showing as ghosts at every level, and nested default/redirect combinations.

---

## Getting Started

```bash
# Install the stack
npm install journey-stack @shobman/strata-ui react-router
npm install -D @shobman/strata-cli @shobman/strata-lint

# Initialise project structure and AI skill
npx strata init

# Design architecture (visual or YAML)
# Then scaffold and build
strata add route funds --fills menu --default index
strata build
strata check

# CI pipeline
strata check && strata build && eslint . && vitest
```