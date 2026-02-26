# Strata — Claude Code Session Plan

## How This Works

This document contains 7 sessions. Each session has:

- **Goal** — what you're building
- **Pre-flight** — anything you do manually before launching Claude Code
- **Prompt** — paste this directly into Claude Code CLI
- **Success criteria** — how you know the session worked
- **Report back** — what to share with me so I can build the reference doc and course-correct

Work through sessions in order. After each session, come back to me with the output summary. I'll build up a running reference and adjust subsequent prompts if needed.

---

## Session 0: Manual Setup

No Claude Code. Just you.

### Steps

```bash
# Create the monorepo
mkdir strata && cd strata
git init
pnpm init

# Create the workspace config
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - "packages/*"
EOF

# Create package directories
mkdir -p packages/strata-ui
mkdir -p packages/strata-cli
mkdir -p packages/strata-lint
mkdir -p docs

# Place the design docs (copy from our session outputs)
cp STRATA-DESIGN.md docs/
cp STRATA-SKILL.md docs/
cp strata-architect.jsx docs/

# Create the root .gitignore
cat > .gitignore << 'EOF'
node_modules/
dist/
*.strata.types.ts
.turbo
EOF

# Initial commit
git add -A
git commit -m "chore: monorepo scaffold with design docs"
```

### Verify

- `docs/STRATA-DESIGN.md` exists with full design doc
- `docs/STRATA-SKILL.md` exists with AI skill rules
- `docs/strata-architect.jsx` exists with visual designer
- `pnpm-workspace.yaml` references `packages/*`
- Three empty package dirs exist

---

## Session 1: Core Runtime (`@shobman/strata-ui`)

### Goal

Build the three runtime components (SlotProvider, SlotTarget, FillSlot) with tests. This is the heart of Strata — ~200 lines of portal-based slot projection.

### Pre-flight

Make sure you're in the repo root. Session 0 is done.

### Prompt

```
Read docs/STRATA-DESIGN.md — specifically the "Runtime: Three Components" and "Portal Stack Behaviour" sections. Then read the "Core Concepts" section for context on slots, fills, and the container visibility rule.

Build the core runtime package at packages/strata-ui:

Package setup:
- Name: @shobman/strata-ui
- TypeScript, strict mode
- peerDependencies: react ^18 || ^19, react-dom ^18 || ^19
- Build with tsup (ESM + CJS, .d.ts generation)
- Test with vitest + @testing-library/react + jsdom

Source structure:
  src/
    types.ts              — contract and component prop types (see design doc "Contract Format" section for the StrataContract shape, and "Runtime" section for component props)
    SlotContext.ts         — React context holding Map<string, HTMLElement | null> for portal targets
    SlotProvider.tsx       — wraps a layout, creates the context with an empty map
    SlotTarget.tsx         — registers a div ref into the context map by slot name. Returns null when no fill is mounted (container visibility rule)
    FillSlot.tsx           — looks up target DOM node from context by name, uses ReactDOM.createPortal. Implements stack behaviour: mount pushes onto stack, unmount pops, topmost fill renders
    index.ts              — public exports: SlotProvider, SlotTarget, FillSlot, and all types

Implementation rules:
- SlotProvider creates a NEW Map on each mount (not shared between providers). This allows nested SlotProviders at different layout levels.
- SlotTarget renders a <div ref={...} /> and registers itself into the context map. When no FillSlot targets it, it returns null (not an empty div). The layout can wrap SlotTarget in conditional containers that disappear when empty.
- FillSlot uses ReactDOM.createPortal to project children into the SlotTarget's DOM node. Multiple FillSlots targeting the same slot name form a stack — deepest mounted component wins. On unmount, the previous fill reasserts. Use a ref-counted approach, not context re-renders.
- Zero styling opinions. No CSS. No class names on internal elements.
- Compatible with React Router v6 (works alongside <Outlet />) but does NOT import or depend on react-router.

Tests (in src/__tests__/):
1. Basic slot fill — FillSlot content renders inside SlotTarget's DOM position, not inline
2. Multiple fills — deepest fill wins, unmounting reveals previous
3. Empty slot returns null — SlotTarget with no FillSlot renders nothing
4. Nested providers — inner SlotProvider creates independent slot namespace
5. Self-fill pattern — a component that is both SlotProvider and FillSlot for its own slot (layout baseline, child overrides)
6. Dynamic fill — FillSlot content updates reactively when children change
7. Unmount revert — removing a route reverts slot to previous fill (or empty)

Do NOT build:
- Contract parsing (that's the CLI package)
- Anything filesystem-related
- Any CLI commands
- ESLint rules
- Presentation modes or variant resolution
```

### Success Criteria

- `pnpm --filter @shobman/strata-ui test` — all 7+ tests pass
- `pnpm --filter @shobman/strata-ui build` — produces dist/ with ESM, CJS, and .d.ts
- The three components exist and export correctly from index.ts
- types.ts contains StrataContract, SlotTargetProps, FillSlotProps, SlotProviderProps

### Report Back

Share the Claude Code session summary. I need to know:
- Did all tests pass? Any that needed adjustment?
- What approach did it use for the portal stack? (ref-counted vs context re-renders)
- Any decisions it made that weren't in the prompt (e.g., error boundaries, dev warnings)
- The final file list and line counts

---

## Session 2: Contract Parser & Validator

### Goal

Build the contract parsing and validation engine. This reads `_contract.yml` files, walks the filesystem tree, and validates structural rules. It lives in the CLI package but will be used by the ESLint plugin too.

### Pre-flight

Session 1 complete. Core runtime tested and building.

### Prompt

```
Read docs/STRATA-DESIGN.md — specifically "Contract Format: _contract.yml", "Filesystem Convention", "Enforcement Layers > strata check", and "Design Decisions Log".

Build the contract engine at packages/strata-cli:

Package setup:
- Name: @shobman/strata-cli
- TypeScript, strict mode
- Dependencies: js-yaml (for YAML parsing), glob or fast-glob (for filesystem walking)
- Build with tsup
- Test with vitest

Source structure:
  src/
    contracts/
      types.ts            — parsed contract types (import the StrataContract shape from design doc, or define locally — this package doesn't depend on strata-ui at runtime)
      parse.ts            — read a single _contract.yml file, parse YAML, validate shape, return typed StrataContract
      walk.ts             — given a root directory, find all _contract.yml files, parse them, build a tree structure with parent-child relationships based on filesystem nesting
      validate.ts         — structural validation rules (the "strata check" logic)
      resolve.ts          — given a route node, walk up ancestors collecting all available slots. Given a slot, walk down through default/redirect chain checking if it's filled
      index.ts            — export everything for use by CLI commands and ESLint plugin
    index.ts              — package entry point, re-exports contracts/

Contract tree structure:
- Each node has: path (filesystem), contract (parsed YAML), parent (ref), children (refs)
- Tree is built by filesystem nesting: routes/funds/[fundId]/ is child of routes/funds/ is child of routes/
- Component contracts (atoms/, molecules/, organisms/) are flat — no parent-child, just level validation

Validation rules (validate.ts):
1. Fills reference real slots — for each fill in a route's contract, walk up ancestors and confirm at least one ancestor declares that slot name
2. Required slots satisfied — for each required slot in a layout, walk the default/redirect chain from that layout. At least one route in the chain must fill it. Error if chain ends without a fill.
3. Default/redirect mutual exclusivity — a contract cannot have both layout.default AND layout.redirect
4. Default/redirect target exists — the named child must actually exist as a subfolder
5. Parameterised routes excluded — if a child folder is [paramName], it cannot be a default or redirect target
6. Level rank consistency — warn if a route's _contract.yml declares a non-route level (it should always be route rank 3 if it's under routes/)
7. Component level consistency — atoms/ folder should only contain atom contracts, etc.

Validation output:
- Array of { level: 'error' | 'warn', message: string, file: string, rule: string }
- Clear, actionable messages. Include the file path and what's wrong.

Tests:
1. Parse a valid route contract YAML string → correct StrataContract object
2. Parse a valid component contract YAML string → correct shape
3. Parse invalid YAML → meaningful error
4. Walk a mock filesystem tree → correct parent-child relationships
5. Validate fills against real ancestor slots → pass and fail cases
6. Validate required slot satisfaction through default chain → pass and fail
7. Validate mutual exclusivity of default/redirect → error on both present
8. Validate param route excluded from default → error case
9. Resolve available slots for a deep route → collects from all ancestors

For filesystem tests, create a temp directory structure with real _contract.yml files rather than mocking. This tests the actual YAML parsing end-to-end.

Do NOT build:
- CLI commands (that's Session 3)
- Type generation (strata build — Session 3)
- ESLint rules
- Any React code
```

### Success Criteria

- `pnpm --filter @shobman/strata-cli test` — all tests pass
- Parser correctly handles the YAML format from the design doc examples
- Validator catches all 7 rule violations with clear error messages
- Tree walker builds correct parent-child relationships from filesystem
- `resolve.ts` correctly collects inherited slots walking up ancestors

### Report Back

Share the Claude Code session summary. I need:
- Test results — any unexpected failures?
- How it structured the tree (in-memory representation)
- How it handles the walk — recursive readdir? glob pattern?
- Any edge cases it found or handled that weren't in the prompt
- Whether it created the contract types fresh or tried to import from strata-ui

---

## Session 3: CLI Commands (`strata init`, `check`, `build`, `add`)

### Goal

Wire the contract engine from Session 2 into CLI commands. This is the developer-facing tool.

### Pre-flight

Session 2 complete. Contract parser and validator tested.

### Prompt

```
Read docs/STRATA-DESIGN.md — specifically "CLI: strata" section (init, check, build, add, dev) and the "Enforcement Layers > TypeScript Types" section for what strata build generates.

Also read docs/STRATA-SKILL.md — this is the file that strata init copies into projects. Understand its structure because init bundles and deploys it.

Build the CLI commands at packages/strata-cli, extending the contract engine from src/contracts/:

CLI framework: use commander.js

Source additions:
  src/
    cli.ts                — commander program definition, registers all commands
    commands/
      init.ts             — strata init
      check.ts            — strata check
      build.ts            — strata build
      add.ts              — strata add route|atom|molecule|organism
    templates/
      STRATA-SKILL.md     — copy of docs/STRATA-SKILL.md, bundled with the package
      contract-stubs/     — YAML template strings for each level
    generate/
      types.ts            — generates .strata.types.ts files from contracts

  bin/
    strata.js             — #!/usr/bin/env node entry point, imports cli.ts

Package.json:
- Add "bin": { "strata": "./bin/strata.js" }
- Add commander to dependencies

Commands:

1. strata init
   - Creates directories if missing: components/atoms, components/molecules, components/organisms, routes
   - Creates _contract.yml in each with correct level/rank
   - Creates routes/_contract.yml with level route/rank 3
   - Copies STRATA-SKILL.md to .claude/skills/STRATA-SKILL.md (create .claude/skills/ if needed)
   - Adds scripts to package.json: "strata:check": "strata check", "strata:build": "strata build"
   - Prints a summary of what was created
   - Idempotent — doesn't overwrite existing files, prints "already exists" for each

2. strata check
   - Finds root (walks up looking for pnpm-workspace.yaml or package.json with strata dependency)
   - Calls the contract walker and validator from src/contracts/
   - Prints errors and warnings with file paths
   - Exit code 1 if any errors, 0 if clean (warnings don't fail)
   - Coloured output: red errors, yellow warnings, green pass

3. strata build
   - Walks the contract tree
   - For each route contract that has layout.slots, generates a .strata.types.ts file next to the _contract.yml:
     ```ts
     // AUTO-GENERATED by strata build — do not edit
     export type FundDetailSlots = 'tabs' | 'contextPanel';
     export type FundDetailRequiredSlots = 'tabs';
     export type FundDetailInheritedSlots = 'breadcrumb' | 'actions';
     export type FundDetailAllSlots = FundDetailSlots | FundDetailInheritedSlots;
     ```
   - Type name derived from folder path: routes/funds/[fundId] → FundDetail (strip routes/, strip brackets, PascalCase)
   - Inherited slots resolved by walking up ancestors
   - Prints count of files generated

4. strata add route <path> [--fills slot1,slot2] [--slots slot1,slot2] [--default childName] [--redirect childName] [--param paramName]
   - Creates the folder under routes/
   - Creates _contract.yml with provided options
   - Creates index.tsx stub with FillSlot boilerplate for each fill
   - If --slots provided, creates _layout.tsx stub with SlotProvider/SlotTarget boilerplate
   - Runs strata build after scaffolding
   
5. strata add atom|molecule|organism <Name>
   - Creates component file in correct directory
   - Simple stub with correct level comment

Tests:
1. strata init — creates expected file structure in temp dir
2. strata init idempotency — running twice doesn't overwrite
3. strata check — valid tree passes, invalid tree fails with correct errors
4. strata build — generates correct type files from a fixture tree
5. strata add route — creates correct contract and stubs
6. strata add route with slots — creates _layout.tsx
7. Type name generation — path-to-PascalCase conversion edge cases

Integration test: init → add a few routes → check → build → verify all types generated correctly.

Do NOT build:
- strata dev (future — Tier 2 designer)
- Anything React/browser
- ESLint rules
```

### Success Criteria

- `pnpm --filter @shobman/strata-cli test` — all tests pass
- `npx strata init` works in a clean directory
- `npx strata check` reports real validation errors
- `npx strata build` generates `.strata.types.ts` files with correct type unions
- `npx strata add route funds/[fundId]/compliance --fills tabs,actions` creates the right files
- CLI has coloured output and clear error messages
- `bin/strata.js` is executable

### Report Back

Share the Claude Code session summary. I need:
- Test results
- How it handled root detection (for strata check/build)
- The type name generation logic (PascalCase conversion)
- Whether the generated stubs look right (layout and page)
- Any edge cases in the CLI arg parsing
- The full `strata init` output (what it prints)

---

## Session 4: ESLint Plugin (`@shobman/strata-lint`)

### Goal

Build three ESLint rules that enforce Strata's architecture at code-authoring time.

### Pre-flight

Session 3 complete. CLI working. You can run `strata check` and `strata build`.

### Prompt

```
Read docs/STRATA-DESIGN.md — specifically "Enforcement Layers > ESLint Plugin" and "Import Boundary Rules" and "Four Levels".

Also look at how the contract parser works in packages/strata-cli/src/contracts/ — the ESLint plugin needs to import the parser to read _contract.yml files.

Build the ESLint plugin at packages/strata-lint:

Package setup:
- Name: @shobman/strata-lint
- TypeScript
- ESLint flat config compatible (ESLint v9+)
- Dependencies: @shobman/strata-cli (for contract parsing — import from its contracts/ exports)
- Build with tsup
- Test with vitest + @typescript-eslint/rule-tester or eslint RuleTester

Source structure:
  src/
    index.ts              — plugin entry, exports rules and recommended config
    rules/
      import-boundary.ts  — prevents importing from higher-rank levels
      no-inline-chrome.ts — prevents action buttons/toolbars rendered outside FillSlot
      required-slots.ts   — warns when a route component doesn't fill required ancestor slots
    utils/
      contract-lookup.ts  — given a file path, find and parse the nearest _contract.yml (walking up). Cache results per run.

Rules:

1. strata/import-boundary (error)
   - On ImportDeclaration and require() calls
   - Resolve the imported file's path
   - Find _contract.yml for BOTH the importing file and the imported file
   - Compare ranks. If imported rank >= importing rank, error.
   - Message: "Cannot import from '{importedLevel}' (rank {n}) into '{currentLevel}' (rank {n}). Import boundary violation."
   - Exception: node_modules imports are always allowed (no contract = no restriction)
   - Exception: same-level imports within the same level folder are allowed (molecule importing another molecule)

2. strata/no-inline-chrome (warning)
   - In files under routes/ (identified by nearest _contract.yml having level.name === 'route')
   - Detect JSX elements that look like action chrome rendered directly (not inside FillSlot):
     - <Button> or <button> as direct children of the component return (not inside FillSlot)
     - <Toolbar>, <ActionBar>, <Actions> custom components rendered directly
     - This is heuristic — flag common patterns, not exhaustive
   - Message: "Action elements should be projected into layout slots via <FillSlot>. See STRATA-SKILL.md."
   - Skip if the element IS inside a <FillSlot> ancestor — that's correct usage

3. strata/required-slots (warning)
   - In files under routes/
   - Read the route's _contract.yml fills array
   - Walk up ancestors to find all required slots available to this route
   - If a required slot exists in an ancestor and this route doesn't list it in fills, warn
   - Message: "Required slot '{slotName}' from '{ancestorPath}' is not filled by this route."
   - Note: this is a static hint only — the route might be part of a default chain where a sibling fills it. strata check does the definitive validation.

Recommended config export:
```js
// Usage: import strataPlugin from '@shobman/strata-lint'
// eslint.config.js: { plugins: { strata: strataPlugin }, rules: strataPlugin.configs.recommended.rules }
export default {
  rules: { 'import-boundary': importBoundaryRule, ... },
  configs: {
    recommended: {
      rules: {
        'strata/import-boundary': 'error',
        'strata/no-inline-chrome': 'warn',
        'strata/required-slots': 'warn'
      }
    }
  }
}
```

Tests:
1. import-boundary: atom importing molecule → error
2. import-boundary: molecule importing atom → pass
3. import-boundary: route importing organism → pass
4. import-boundary: organism importing route → error
5. import-boundary: same-level import → pass
6. import-boundary: node_modules import → pass
7. no-inline-chrome: <Button> outside FillSlot in route → warn
8. no-inline-chrome: <Button> inside FillSlot → pass
9. no-inline-chrome: <Button> in molecule (not route) → pass (rule only applies to routes)
10. required-slots: route missing required ancestor slot → warn
11. required-slots: route filling required slot → pass

For tests, create minimal fixture _contract.yml files that the rule tester can reference.

Do NOT build:
- Auto-fix capabilities (manual fix only for now)
- VS Code extension
- Any runtime React code
```

### Success Criteria

- `pnpm --filter @shobman/strata-lint test` — all tests pass
- Plugin exports correctly for ESLint flat config
- import-boundary catches rank violations with clear messages
- no-inline-chrome flags common patterns without false positives on FillSlot children
- Contract caching works (doesn't re-parse same file per rule invocation)

### Report Back

Share the Claude Code session summary. I need:
- Test results
- How it resolved the contract lookup caching (per-lint-run vs global)
- Whether it used ESLint's flat config format or legacy
- How the no-inline-chrome heuristic works — what JSX patterns it flags
- Any issues importing from @shobman/strata-cli in the monorepo

---

## Session 5: Integration Testing

### Goal

End-to-end test across all three packages. Create a realistic fixture project, run the full Strata toolchain, and verify everything works together.

### Pre-flight

Sessions 1–4 complete. All packages building and passing unit tests.

### Prompt

```
Read docs/STRATA-DESIGN.md — specifically "Filesystem Convention" for the example project structure, and "Getting Started" for the expected workflow.

Create an integration test suite at the monorepo root:

Location: tests/integration/

Fixture project: tests/integration/fixture/
This is a minimal but realistic Strata project simulating a financial services app. Create it with this structure:

  fixture/
    package.json          — references workspace packages
    components/
      atoms/_contract.yml
      molecules/_contract.yml
      organisms/_contract.yml
    routes/
      _contract.yml
      _layout.tsx
      funds/
        _contract.yml       — fills: [menu]. layout.slots: { listActions }. default: index
        _layout.tsx
        index/
          _contract.yml     — fills: [listActions]
          index.tsx
        [fundId]/
          _contract.yml     — param: fundId. fills: [breadcrumb, actions]. layout.slots: { tabs: required, contextPanel }. default: overview
          _layout.tsx
          overview/
            _contract.yml   — fills: [tabs]
            index.tsx
          performance/
            _contract.yml   — fills: [tabs, contextPanel]
            index.tsx
          compliance/
            _contract.yml   — fills: [tabs]
            index.tsx

The .tsx files should use real SlotProvider, SlotTarget, FillSlot imports from @shobman/strata-ui and have realistic content (not just "hello world").

Tests:

1. strata check on valid fixture → exit 0, no errors
2. strata build on fixture → generates .strata.types.ts files with correct type unions
3. Verify generated types: FundDetailSlots = 'tabs' | 'contextPanel', FundDetailRequiredSlots = 'tabs', inherited slots include 'breadcrumb', 'actions', 'menu' from ancestors
4. strata add route funds/[fundId]/risk-metrics --fills tabs,contextPanel → creates correct files
5. strata check after add → still passes
6. strata build after add → new types generated

Negative tests (create invalid fixture variations):
7. Route fills a slot that no ancestor declares → strata check reports error
8. Required slot 'tabs' not filled in default chain → strata check reports error
9. Contract with both default AND redirect → strata check reports error
10. Parameterised route as default target → strata check reports error

ESLint integration tests:
11. Run ESLint with strata-lint on fixture → no warnings (it's correctly structured)
12. Create a bad-fixture with a route that imports from another route → import-boundary error
13. Create a bad-fixture with inline <Button> outside FillSlot → no-inline-chrome warning

Runtime tests (if feasible with the test setup):
14. Render the fixture's fund detail layout + overview page → slot content appears in correct DOM positions
15. Switch from overview to performance → tabs slot content updates, contextPanel appears
16. Switch back to overview → contextPanel disappears (empty slot returns null)

Use vitest for all tests. For runtime tests, use @testing-library/react with a mock router setup (MemoryRouter from react-router-dom).

After tests pass, run the full CI pipeline:
  pnpm -r build && pnpm -r test && strata check (on fixture)

Do NOT fix issues in the individual packages — report them. I'll relay to you for course correction.
```

### Success Criteria

- All integration tests pass
- The fixture project represents a realistic Strata app
- `strata check` → `strata build` → ESLint pipeline works end-to-end
- Generated types are correct for the fixture tree
- Negative tests catch all expected violations
- Runtime tests confirm slot projection works with React Router

### Report Back

This is the most important report. Share:
- Full test results — which passed, which failed
- Any package bugs discovered (I'll help you fix these before proceeding)
- The generated `.strata.types.ts` content — are the type unions correct?
- Runtime test setup — did it successfully render with MemoryRouter?
- Any cross-package dependency issues in the monorepo
- The fixture project's file list — does it look like a real app?

---

## Session 6: Designer GitHub Pages Deployment

### Goal

Wrap the Strata Architect visual designer in a deployable Vite app for GitHub Pages.

### Pre-flight

Session 5 complete. Integration tests passing.

### Prompt

```
Read docs/strata-architect.jsx — this is a standalone React component (JSX, uses React hooks). It's the Strata Architect visual designer built during the protocol design session.

Wrap it in a deployable Vite app:

Location: apps/designer/

Setup:
- Vite with React plugin
- Single page app
- Tailwind CSS (the designer uses Tailwind classes)
- Import the architect component and render it full-screen

Structure:
  apps/designer/
    index.html
    vite.config.ts        — base: '/strata/' for GitHub Pages
    src/
      main.tsx            — renders the architect component
      App.tsx             — minimal wrapper, maybe a header with "Strata Architect" title and link to repo
    public/
      favicon.svg         — simple geometric icon (layers/strata concept)

Adjustments to the architect component:
- It's currently a single JSX file with inline styles and Tailwind classes. Import it as-is, or split into a proper component if needed.
- Make sure all React imports are correct (useState, useCallback, useEffect, useMemo from 'react')
- The component manages its own state — it should just work when rendered

Deployment config:
- Add GitHub Actions workflow at .github/workflows/deploy-designer.yml
- Triggers on push to main (changes in apps/designer/ or docs/strata-architect.jsx)
- Builds with Vite, deploys to GitHub Pages
- Target URL: shobman.github.io/strata/

Add to pnpm-workspace.yaml: include apps/* in workspace packages.

Add convenience scripts to root package.json:
- "designer:dev": "pnpm --filter designer dev"
- "designer:build": "pnpm --filter designer build"

Verify:
- pnpm designer:dev launches and the designer renders correctly
- pnpm designer:build produces a static site in apps/designer/dist/
- The designer is interactive — can add routes, slots, fills, see YAML output

Do NOT:
- Modify the architect's functionality
- Add backend/API integration
- Build the strata dev filesystem bridge (that's future Tier 2)
```

### Success Criteria

- `pnpm designer:dev` opens the designer in browser
- Designer is fully interactive (add routes, configure slots, view YAML)
- `pnpm designer:build` produces static files
- GitHub Actions workflow file exists and looks correct
- Tailwind styles render properly

### Report Back

Share:
- Did the designer render correctly? Any missing styles or broken interactions?
- Were there any React import issues in the JSX file?
- The GitHub Actions workflow content
- Any Vite config decisions (chunk splitting, etc.)

---

## Session 7: README, Polish, Publish Prep

### Goal

Documentation, package.json polish, and prepare for npm publish and GitHub release.

### Pre-flight

Sessions 1–6 complete. Everything building, tested, and the designer deploys.

### Prompt

```
Read docs/STRATA-DESIGN.md for the full protocol description. Read docs/STRATA-SKILL.md for the AI agent angle.

Create documentation and polish the monorepo for public release:

1. Root README.md
   Write a compelling README for the GitHub repo. Structure:
   - One-line description: "Composable layout protocol for React — named slots, enforceable contracts, AI-agent-ready architecture"
   - The Problem (2-3 sentences: React Router single outlet, AI agents ignoring layout architecture)
   - The Solution (brief: named slots via portals, YAML contracts at every boundary, CLI toolchain, ESLint enforcement)
   - Quick visual: show a before/after code comparison. Before: ad-hoc buttons inline. After: FillSlot projection.
   - "See it in action" link to the designer on GitHub Pages
   - Installation (3 lines: install, init, build)
   - Packages table: strata-ui, strata-cli, strata-lint with one-line descriptions
   - Links to per-package READMEs
   - "Works with Journey Stack" note with link
   - License: MIT

2. Per-package READMEs
   - packages/strata-ui/README.md — API docs for SlotProvider, SlotTarget, FillSlot. Usage examples. Props tables.
   - packages/strata-cli/README.md — CLI command reference. Each command with flags, examples, output.
   - packages/strata-lint/README.md — Rule descriptions, ESLint config setup, examples of what each rule catches.

3. Package.json polish (all three packages + root)
   - Consistent metadata: author, license (MIT), repository, homepage
   - Keywords for discoverability: react, layout, slots, architecture, AI, atomic-design
   - Correct exports fields for ESM/CJS
   - engines: node >= 18
   - files array: only publish dist/ and necessary files

4. CHANGELOG.md at root
   - Initial entry for v0.1.0
   - List features by package

5. LICENSE file at root — MIT

6. Contributing guide (CONTRIBUTING.md)
   - Brief: clone, pnpm install, pnpm -r build, pnpm -r test
   - How to run the designer locally
   - Link to STRATA-DESIGN.md for understanding the protocol

7. .npmrc at root
   - Workspace protocol settings for pnpm

Verify:
- All READMEs render correctly (no broken links, correct code blocks)
- pnpm -r build succeeds
- pnpm -r test succeeds
- Each package could be published independently

Do NOT:
- Actually publish to npm (I'll do that manually)
- Set up CI/CD beyond what exists (GitHub Actions for designer is enough)
- Add badges yet (will do after first publish)
```

### Success Criteria

- Root README clearly communicates what Strata is and why it matters
- Per-package READMEs are complete API references
- All package.json files have correct metadata and exports
- LICENSE, CHANGELOG, CONTRIBUTING exist
- `pnpm -r build && pnpm -r test` still passes after all changes

### Report Back

Share:
- The root README content (or at least the opening section)
- Any package.json export issues it found
- Whether it linked the packages correctly in the monorepo
- The CHANGELOG entry

---

## Session Flow Diagram

```
Session 0 (manual)     → Monorepo scaffold, place design docs
    ↓
Session 1 (Claude Code) → Core runtime: SlotProvider, SlotTarget, FillSlot
    ↓
Session 2 (Claude Code) → Contract parser, validator, tree walker
    ↓
Session 3 (Claude Code) → CLI: init, check, build, add commands
    ↓
Session 4 (Claude Code) → ESLint plugin: 3 rules
    ↓
Session 5 (Claude Code) → Integration testing across all packages
    ↓
Session 6 (Claude Code) → Designer GitHub Pages deployment
    ↓
Session 7 (Claude Code) → README, polish, publish prep
```

Each session depends on the previous. If a session fails, we fix before moving on.

---

## After All Sessions

Once Session 7 is done and you report back:
- I'll review the final state and suggest any adjustments
- We'll create the GitHub repo and push
- First npm publish: `pnpm -r publish --access public`
- Deploy designer to GitHub Pages via the workflow
- You'll have a complete, tested, documented layout protocol library

Then we can talk about Journey Stack integration and Tier 2 designer (`strata dev`).