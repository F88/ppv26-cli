/**
 * Tool version, read from package.json so there is a single source
 * of truth for chore(release) bumps.
 *
 * The runtime read below works from both the compiled layout
 * (dist/core/) and the tsx source layout (src/core/): two levels up is
 * the package root either way. But when the Ink binaries are bundled by
 * esbuild every module collapses into a single dist/*.js file, so
 * `import.meta.url` no longer points two levels below the root and the
 * relative read would miss. For that build the version is baked in via
 * an esbuild `define` for `__PPCLI_VERSION__`; the read is then dead
 * code and is eliminated. Under tsc/tsx the constant is undefined and
 * the read runs as before. `typeof` on the undeclared global is safe.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

declare const __PPCLI_VERSION__: string | undefined;

function readPackageVersion(): string {
  const packageJsonPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'package.json',
  );
  return (
    JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string }
  ).version;
}

export const VERSION: string =
  typeof __PPCLI_VERSION__ === 'string'
    ? __PPCLI_VERSION__
    : readPackageVersion();
