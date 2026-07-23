/**
 * Bundle the Ink binaries (pptop, ppex) with NODE_ENV baked to
 * 'production' so React's production build is selected at build time.
 *
 * This dead-code-eliminates the dev build's Component Performance Track
 * (which serializes changed props into performance.measure entries that
 * Node's timeline retains indefinitely) - the cause of the sort/search
 * OOM (issue #18). It also yields a self-contained, fast-starting file.
 * ppv-cli (no React) is left on tsc.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import * as esbuild from 'esbuild';

// Single source of truth for the version; baked in so the bundle does
// not read package.json at runtime (import.meta.url points at the
// bundle, not src/core/, once everything is collapsed into one file).
const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

await esbuild.build({
  // Anchor every relative path (entryPoints, outdir) to the repo root
  // derived from this script's own location, not process.cwd(), so the
  // build is identical no matter which directory it is invoked from and
  // stays consistent with the script-relative package.json read above.
  absWorkingDir: fileURLToPath(new URL('..', import.meta.url)),
  entryPoints: ['src/pptop.tsx', 'src/ppex.tsx'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  // No minify: this is a locally-run Node CLI, so bundle size is
  // irrelevant, and unminified output keeps stack traces in crash
  // reports readable (identifiers and structure survive) without
  // shipping a source map. The dev-React elimination that fixes the
  // OOM comes from the NODE_ENV define + DCE below, not from minify.
  // Ink imports react-devtools-core only on the DEV devtools path
  // (never in production); alias the uninstalled dep to a no-op stub so
  // the import resolves without an unresolved bare specifier at runtime.
  alias: {
    // fileURLToPath (not URL.pathname): decodes percent-encoding and
    // yields a platform-correct path, so a repo path with spaces /
    // non-ASCII, or a Windows drive path, still resolves.
    'react-devtools-core': fileURLToPath(
      new URL('./stub-react-devtools-core.mjs', import.meta.url),
    ),
  },
  // The whole point: pick React's production build at build time.
  // Also bake the tool version (see src/core/version.ts).
  define: {
    'process.env.NODE_ENV': '"production"',
    __PPCLI_VERSION__: JSON.stringify(version),
  },
  // Bundled CJS deps may reference a CommonJS require / __dirname at
  // runtime; provide them in the ESM output.
  banner: {
    js: [
      "import { createRequire as __createRequire } from 'node:module';",
      "import { fileURLToPath as __fileURLToPath } from 'node:url';",
      "import { dirname as __pathDirname } from 'node:path';",
      'const require = __createRequire(import.meta.url);',
      'const __filename = __fileURLToPath(import.meta.url);',
      'const __dirname = __pathDirname(__filename);',
    ].join('\n'),
  },
  logLevel: 'info',
});
