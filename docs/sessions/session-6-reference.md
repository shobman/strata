# Session 6 Reference — Designer GitHub Pages Deployment

## Status: ✅ Complete

## What Was Built

Vite app wrapping the Strata Architect visual designer for GitHub Pages deployment.

## File Inventory

```
apps/designer/
  package.json              ← Vite 6 + React 18
  vite.config.ts            ← base: '/strata/' for GitHub Pages
  tsconfig.json             ← allowJs for the JSX component
  index.html                ← SPA entry, IBM Plex fonts from Google Fonts
  src/
    main.tsx                ← ReactDOM entry
    App.tsx                 ← header (logo + GitHub link) + StrataDesigner
    StrataDesigner.jsx      ← copy of docs/strata-architect.jsx
  public/
    favicon.svg             ← layered geometric icon

.github/workflows/deploy-designer.yml  ← GitHub Pages on push to main
```

## Config Details

- **Vite base path:** `/strata/` (matches `shobman.github.io/strata/`)
- **GitHub Actions trigger:** push to `main`, changes in `apps/designer/` or `docs/strata-architect.jsx`
- **Build output:** `apps/designer/dist/` — 171 KB (53 KB gzipped)
- **Fonts:** IBM Plex Sans/Mono from Google Fonts CDN

## Workspace Changes

- `pnpm-workspace.yaml` now includes `apps/*`
- Root `package.json` has `designer:dev` and `designer:build` scripts

## Notes for Session 7

- The designer JSX is copied into `apps/designer/src/` — if the source at `docs/strata-architect.jsx` changes, it needs manual sync. Could add a prebuild copy step.
- README should link to `shobman.github.io/strata/` as the live demo.
- The GitHub Actions workflow should be reviewed before first push — confirm it uses the right pnpm version and node version.