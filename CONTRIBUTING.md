# Contributing to Strata

## Getting Started

```bash
git clone https://github.com/shobman/strata.git
cd strata
pnpm install
pnpm build
pnpm test
```

## Running the Designer Locally

```bash
pnpm designer:dev
```

Opens the Strata Architect visual designer at `http://localhost:5173/strata/`.

## Project Structure

```
packages/
  strata-ui/      # Runtime components (SlotProvider, SlotTarget, FillSlot)
  strata-cli/     # CLI toolchain and contract engine
  strata-lint/    # ESLint plugin
apps/
  designer/       # Strata Architect (Vite + React)
tests/
  integration/    # Integration tests with realistic fixture project
docs/
  STRATA-DESIGN.md          # Protocol specification
  STRATA-SKILL.md           # AI agent skill file
  strata-architect.jsx      # Designer source of truth
```

## Source Sync Points

Two files are maintained as copies. When updating them, update the source of truth and copy to the destination:

| Source | Destination |
|--------|-------------|
| `docs/STRATA-SKILL.md` | `packages/strata-cli/src/templates/skill-content.ts` |
| `docs/strata-architect.jsx` | `apps/designer/src/StrataDesigner.jsx` |

## Building

```bash
pnpm build        # build all packages
pnpm test         # run all tests
```

Individual packages:

```bash
pnpm --filter @shobman/strata-ui build
pnpm --filter @shobman/strata-cli test
```

## Understanding the Protocol

Read [`docs/STRATA-DESIGN.md`](docs/STRATA-DESIGN.md) for the full protocol specification — it covers the slot/fill model, contract format, validation chain, and architectural levels.
