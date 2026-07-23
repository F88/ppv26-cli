/**
 * User-level directories of the ppv-cli tools (issue #7).
 *
 * Everything lives under a single, discoverable dot directory in the
 * user's home (`~/.ppv-cli`), the same shape on every OS (Windows has
 * no name-based hiding, so it is plainly visible in Explorer):
 *
 *   ~/.ppv-cli/
 *     config        KEY=VALUE (dotenv format): token and PPV_CLI_*
 *     snapshots/    default snapshot directory
 *
 * The classic dot-dir pattern (cargo, npm, aws) was chosen over
 * XDG / APPDATA deliberately: it is easier to find and to document,
 * and needs zero platform branching.
 */
import os from 'node:os';
import path from 'node:path';

/** Root of all ppv-cli user files: `~/.ppv-cli`. */
export function ppCliHome(): string {
  return path.join(os.homedir(), '.ppv-cli');
}

/** Global config file (dotenv format): `~/.ppv-cli/config`. */
export function globalConfigPath(): string {
  return path.join(ppCliHome(), 'config');
}

/** Built-in default snapshot directory: `~/.ppv-cli/snapshots`. */
export function defaultSnapshotDir(): string {
  return path.join(ppCliHome(), 'snapshots');
}
