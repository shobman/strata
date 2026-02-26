/**
 * The STRATA-SKILL.md content, bundled with the CLI package.
 * Copied into projects by `strata init`.
 *
 * Source: docs/STRATA-SKILL.md
 */
export const SKILL_CONTENT = `# Strata Skill \u2014 AI Agent Rules for Layout Architecture

## Project Setup

This skill file was placed here by \`strata init\`. It lives in your project so it's version-controlled and customisable. The Strata CLI (\`@shobman/strata-cli\`) provides structural tooling:

- \`strata check\` \u2014 validate all contracts (runs in CI)
- \`strata build\` \u2014 generate TypeScript types from YAML contracts
- \`strata add route <path>\` \u2014 scaffold a new route with contract and stub
- \`strata add <level> <Name>\` \u2014 scaffold a new component at the correct level

The Strata Architect visual designer (\`docs/strata-architect.jsx\`) provides an interactive view of the full route/slot architecture. Refer to it for understanding the layout tree, but always treat \`_contract.yml\` files as the source of truth.

---

## Before Writing Any Code

1. Find \`_contract.yml\` in your target folder
2. Walk UP the folder tree reading each ancestor \`_contract.yml\`
3. You now know: your level, your slots, your fills, all available ancestor slots

If there is no \`_contract.yml\`, this is an unconstrained location. Build simply. If you need slots or structure, create a contract first.

---

## Route Component Rules

### Filling Slots

When generating a route component:

- Read your \`_contract.yml\` \`fills\` array \u2014 these are the slots you MUST provide content for
- For each fill, use \`<FillSlot name="slotName">\` to project content
- Main content renders as direct JSX children (flows into \`<Outlet />\`)
- **NEVER** render buttons, action bars, sidebars, toolbars, or navigation chrome directly \u2014 declare them in slot fills

\`\`\`tsx
// \u2705 CORRECT \u2014 actions declared in slot
const PerformancePage = () => (
  <>
    <FillSlot name="tabs">
      <TabStrip items={['Returns', 'Benchmark', 'Risk']} />
    </FillSlot>
    <FillSlot name="actions">
      <Button variant="primary">Run Benchmark</Button>
      <Button variant="ghost">Compare Peers</Button>
    </FillSlot>
    <PerformanceCharts fundId={fundId} />
  </>
);

// \u274c WRONG \u2014 inline action bar breaks layout contract
const PerformancePage = () => (
  <div>
    <div className="action-bar">
      <Button>Run Benchmark</Button>
    </div>
    <PerformanceCharts fundId={fundId} />
  </div>
);
\`\`\`

### Layout Components

When generating a layout component (\`_layout.tsx\`):

- Read \`_contract.yml\` \`layout.slots\` \u2014 these are the slot targets you render
- Wrap everything in \`<SlotProvider>\`
- Use \`<SlotTarget name="slotName" />\` for each declared slot
- Wrap slot targets in appropriate chrome (panels, headers, sidebars)
- Render \`<Outlet />\` for child content
- If a slot has \`required\` status, the slot target can render without a fallback \u2014 validation ensures it's always filled
- If a slot is not required, wrap its container conditionally \u2014 \`SlotTarget\` returns null when empty

\`\`\`tsx
const FundDetailLayout = () => (
  <SlotProvider>
    <header>
      <SlotTarget name="breadcrumb" />
    </header>
    <nav>
      <SlotTarget name="tabs" />
    </nav>
    <div className="content-area">
      <main>
        <Outlet />
      </main>
      <aside>
        <SlotTarget name="contextPanel" />
      </aside>
    </div>
    <footer className="action-bar">
      <SlotTarget name="actions" />
    </footer>
  </SlotProvider>
);
\`\`\`

### Self-Filling Slots

A layout can fill its own slots as a baseline. Check the \`fills\` array \u2014 if it includes a slot name that's also in \`layout.slots\`, the layout provides its own default content for that slot.

\`\`\`tsx
// _contract.yml says: fills: [listActions], layout.slots: [listActions]
const FundsLayout = () => (
  <SlotProvider>
    <FillSlot name="listActions">
      <Button>Default Actions</Button>
    </FillSlot>
    <SlotTarget name="listActions" />
    <Outlet />
  </SlotProvider>
);
\`\`\`

Children override this when they mount their own \`<FillSlot name="listActions">\`.

---

## Import Boundary Rules

Check \`_contract.yml\` at both the importing and imported locations.

| Your level | Can import from |
|-----------|----------------|
| atom (0) | Nothing from component hierarchy |
| molecule (1) | atoms only |
| organism (2) | atoms and molecules |
| route (3) | atoms, molecules, and organisms |

**NEVER** import from a higher rank. An organism importing from a route component is always wrong.

---

## Slot Accountability

For every ancestor slot available to you (walk up the \`_contract.yml\` chain):

- **Fill it** \u2014 add to your \`fills\` array, provide \`<FillSlot>\` content
- **Skip it** \u2014 deliberately not filling. Ancestor's fill (or empty) persists

Do not silently ignore slots. Every available slot should be a conscious decision.

---

## Default and Redirect Routes

When creating child routes for a layout:

- Check the parent's \`_contract.yml\` for \`layout.default\` or \`layout.redirect\`
- If your route IS the default, your content renders at the parent's URL \u2014 no URL segment
- If your route is the redirect target, the parent URL bounces to your URL
- **NEVER** set a parameterised route as a default or redirect \u2014 they require runtime values

---

## Adding New Routes

When asked to add a new route, prefer \`strata add route <path>\` which scaffolds the contract and stub for you. If building manually:

1. Create the folder under the correct parent
2. Create \`_contract.yml\` first \u2014 decide: does it have slots? what does it fill?
3. If it has slots, create \`_layout.tsx\`
4. Create the page component (\`index.tsx\`)
5. Verify: does the parent need to know about this route? (default/redirect updates)
6. Run \`strata check\` mentally: do all required ancestor slots have fills in the resolution chain?

After scaffolding (CLI or manual), run \`strata build\` to regenerate types.

---

## Adding New Components

When asked to add a new component, prefer \`strata add <level> <Name>\` (e.g. \`strata add molecule SearchBar\`). If building manually:

1. Determine the level: is it primitive (atom), a small composition (molecule), or a complex group (organism)?
2. Create it in the correct folder (\`components/atoms/\`, \`components/molecules/\`, \`components/organisms/\`)
3. Check that your imports respect the rank boundary
4. Components in organisms/ can project into slots when used inside route components, but organisms themselves don't know about slots \u2014 that's the route's job

---

## Creating Modals, Slide-overs, and Overlays

**NEVER** render \`<Dialog>\`, \`<Modal>\`, or overlay components directly in a page. Instead:

- Configure the route's presentation mode in \`_contract.yml\` or route config
- The layout reads the presentation mode and renders the \`<Outlet />\` accordingly (as overlay, slide panel, etc.)
- The page component is identical regardless of presentation \u2014 it just fills slots and renders content

---

## Key Principles

1. **Pages fill slots. Layouts own chrome.** The page never decides WHERE its content renders.
2. **The contract is the documentation.** Read \`_contract.yml\`, know everything.
3. **Walk up for context.** Your available slots come from every ancestor, not just your parent.
4. **Filesystem is architecture.** Folder structure = route nesting = layout hierarchy.
5. **Simplicity is valid.** Not every route needs slots. A leaf with no contract is fine.
6. **Complexity is managed.** When you need it, the contract and slot system keeps it consistent.
`;
