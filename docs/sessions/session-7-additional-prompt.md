Additional items discovered during earlier sessions:

1. YAML bracket quoting: [fundId] is valid YAML array syntax, so all
   _contract.yml references to param folders must use quotes: "[fundId]".
   Verify that strata add generates quoted YAML for bracket segments.
   Add a note about this in the strata-cli README under gotchas/tips.

2. ESLint files pattern: ESLint 9 flat config won't lint .tsx files
   unless explicitly included. The strata-lint README config example
   MUST show the files array:
   files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]

3. Two source sync points to document in CONTRIBUTING.md:
   - docs/STRATA-SKILL.md → packages/strata-cli/src/templates/skill-content.ts
   - docs/strata-architect.jsx → apps/designer/src/StrataDesigner.jsx
   Consider adding a prebuild script that copies these automatically.

4. strata-ui README should mention:
   - The data-strata-slot attribute on SlotTarget divs (useful for
     testing and debugging)
   - The useSyncExternalStore approach (per-slot subscriptions, zero
     context re-renders) as a design highlight

5. "What Strata Is NOT" — add a short section to the root README:
   Strata does not constrain what a layout renders. Layouts are regular
   React components. Slots are projection targets inside that layout,
   not the layout itself. A layout with zero slots is valid. A page
   with zero fills is valid.

6. Check if fast-glob is still unused in strata-cli. If so, remove it
   from dependencies.

7. Use the integration fixture project (tests/integration/fixture/) as
   source material for README code examples — it's a realistic,
   tested reference.

8. Designer live link: shobman.github.io/strata/ — reference in root
   README under "See it in action".

9. Review .github/workflows/deploy-designer.yml — confirm pnpm and
   node version pins are correct for the monorepo.