# Development

Notes for developing ppv26-cli. See [README.md](README.md) for setup and usage, and [PRD.md](PRD.md) for requirements and design.

## Commands

```console
npm run typecheck      # tsc --noEmit
npm test               # vitest
npm run lint           # eslint (lint:fix to autofix)
npm run format         # prettier --write (format:check to check only)
npm run build          # build:tsc then build:bundle -> dist/
```

`npm install` also builds `dist/` automatically (via the `prepare` script), so a fresh clone is runnable right away.

CI runs all of the above (formatting as a check) plus a `--help` smoke test of the built CLI on ubuntu / windows with Node 22 / 24.

## Running the binaries

There are two ways to run the binaries; for pptop / ppex the two ways use different React builds. This matters:

```console
# From source (fast iteration). Uses React's DEVELOPMENT build.
npx tsx src/pptop.tsx
npx tsx src/ppex.tsx
npm run ppv-cli -- <cmd>

# From dist/ (production-equivalent). Uses React's PRODUCTION build.
npm run build && node dist/pptop
node dist/ppex
node dist/ppv-cli
```

Why the split: Ink picks React's dev vs production build at runtime from `process.env.NODE_ENV`, and neither `tsx` nor `tsc` replaces that value, so running from source (or a plain `tsc` output) gets the **dev** build.
React 19's dev build carries the Component Performance Track, which serializes changed props into `performance.measure` entries that Node's performance timeline retains indefinitely. When a large array prop changes reference every render (pptop sort / search recomputing `filtered`), that grows without bound and the process eventually OOMs (issue #18).

`npm run build` runs two stages (`package.json` scripts):

- `build:tsc` - `tsc` emits `ppv-cli` and the shared React-free `dist/core/` (no Ink/ui output).
- `build:bundle` - `scripts/build-ink.mjs` bundles pptop / ppex with esbuild, baking `NODE_ENV=production` (via `define`) so React's production build is selected at build time and the dev-only instrumentation is dead-code-eliminated. This is what makes the shipped binaries safe from the OOM above. `ppv-cli` (no React) stays on `tsc`. Use `npm run build:bundle` alone to rebuild just the bundles.

Practical guidance:

- UI work / quick checks -> `npx tsx src/pptop.tsx` is fine. Just avoid hammering sort / search over a large snapshot; the dev build leaks.
- Memory or production-fidelity checks -> run the built binary with `npm run build && node dist/pptop`, or prefix the source run with `NODE_ENV=production npx tsx src/pptop.tsx` (which also disables the instrumentation).

## Source layout

One binary = one entry file at the src/ root (named after the bin) plus one directory of the same name:

```text
src/
  ppv-cli.ts  ppex.tsx  pptop.tsx   # bin entries (thin launchers)
  ppc/                          # ppv-cli-only (commands/, explorer.ts)
  ppex/                         # ppex-only (app container, screens)
  pptop/                        # pptop-only (app container, header)
  ui/                           # shared Ink components
  core/                         # shared React-free logic
```

Rules:

- Shared code has exactly two homes: `ui/` for anything that depends on Ink (React), `core/` for everything else.
- Dependencies point one way: `pp*/ -> ui/ -> core/`. One-shot binaries (ppv-cli) must not import from `ui/`, so starting the CLI never loads Ink/React.
- Tests are co-located: `foo.ts` is tested by `foo.test.ts` right next to it (excluded from the build by tsconfig.build.json), so tests move together with their subjects when directories are reorganized.

To add a new binary `ppxxx`:

1. Create `src/ppxxx.tsx` (arg parsing, TTY guard, render) and `src/ppxxx/` (the app). The existing three are the templates.
2. Add `"ppxxx": "./dist/ppxxx.js"` to `bin` in package.json.
3. Document it in README.md and PRD.md.

## Dependencies management

Check for updates with:

```console
npx npm-check-updates --format group
```

Policy:

- **Patch / minor updates**: apply freely. Run the full check suite (format:check, lint, typecheck, test, build, and a smoke run of `dist/ppv-cli.js`) before committing.
- **Major updates**: review the changelog first, apply one package at a time, and verify with the full check suite.

### Constraints

Deliberate exceptions to "just update". Do not bump these without revisiting the reasoning:

| Package                                                    | Constraint                | Reason                                                                                                                                                                                                                              |
| ---------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typescript`                                               | Stay on 5.x               | TypeScript 6/7 is the native-compiler (tsgo) generation, not a routine upgrade. Wait until the toolchain (typescript-eslint, tsx) and the PROMIDAS ecosystem (all repos on 5.9) have migrated, then follow. (Decided 2026-07-15)    |
| `@types/node`                                              | Stay on 24.x              | Type definitions should not exceed the supported/tested Node versions (engines: >=22, CI matrix: 22 / 24). Newer majors would let APIs unavailable on Node 22 pass the typecheck. Raise only together with the engines / CI matrix. |
| `promidas` / `promidas-utils` / `protopedia-api-v2-client` | Update promptly, together | PROMIDAS ecosystem packages. Keep `promidas` and `protopedia-api-v2-client` on versions that satisfy the peerDependency (`^3`). This CLI dogfoods the ecosystem, so new releases should be adopted early.                           |
