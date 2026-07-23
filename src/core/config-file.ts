/**
 * Creation and read-modify-write helpers for the global user config
 * (dotenv format; the path is defined in user-dirs.ts), shared by
 * the config
 * subcommands (issue #7).
 */
import { access, chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { PPV_CLI_TOOL_NAME } from './constants.js';
import { globalConfigPath } from './user-dirs.js';

/**
 * Placeholder token value shipped in the template below. It means
 * "not set yet": initConfigEntries() normalizes it to null, so the rest
 * of the app (config show, API calls) sees an unset token instead of
 * mistaking the placeholder for a real one.
 */
export const TOKEN_PLACEHOLDER = 'your-token-here';

/**
 * Initial content of the config file: every key documented as a
 * comment, so "edit the file directly" means reading the explanation
 * and uncommenting a line - approachable without prior knowledge.
 * Textually similar to config init's .env.example on purpose, but
 * kept separate: the hints differ (e.g. ./snapshots only makes sense
 * relative to a repository, not in a global file).
 */
export const GLOBAL_CONFIG_TEMPLATE = `# ppv-cli global configuration
# Edit values directly (KEY=VALUE); lines starting with # are comments.

# ProtoPedia API v2 access token (Bearer Token)
# See: https://protopediav2.docs.apiary.io/
# Usually set via: ${PPV_CLI_TOOL_NAME} config set-token
PROTOPEDIA_API_V2_TOKEN=${TOKEN_PLACEHOLDER}

# Optional: default log level (debug | info | warn | error | silent).
# CLI flags (--verbose / --quiet) take precedence.
# PPV_CLI_LOG_LEVEL=info

# Optional: hours after which a snapshot is considered stale
# (default: 1). Positive number; decimals allowed.
# PPV_CLI_SNAPSHOT_STALE_HOURS=1

# Optional: snapshot directory.
# Default: the "snapshots" folder next to this file.
# To change it, write a FULL absolute path. The value is used
# as-is: "~", "$HOME" and "%USERPROFILE%" are NOT expanded and
# would be taken literally.
#   Example (macOS):   PPV_CLI_SNAPSHOT_DIR=/Users/you/pp-snapshots
#   Example (Windows): PPV_CLI_SNAPSHOT_DIR=C:\\Users\\you\\pp-snapshots
# The --snapshot-dir CLI option takes precedence.
# PPV_CLI_SNAPSHOT_DIR=
`;

/** True when the global config file exists. */
export async function globalConfigExists(): Promise<boolean> {
  try {
    await access(globalConfigPath());
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates (or overwrites) the global config file from the documented
 * template, creating the directory (700) as needed, and returns the
 * config path. Creation is config init's job; config set-token runs
 * it only via init's creation step when the file does not exist yet.
 * The 600 permission is a no-op on Windows (NTFS ACLs; the user
 * profile is owner-only by default).
 */
export async function createGlobalConfig(): Promise<string> {
  const configPath = globalConfigPath();
  await mkdir(path.dirname(configPath), { recursive: true, mode: 0o700 });
  await writeFile(configPath, GLOBAL_CONFIG_TEMPLATE, {
    encoding: 'utf8',
    mode: 0o600,
  });
  await chmod(configPath, 0o600);
  return configPath;
}

/**
 * Applies a content transformation to the EXISTING config file
 * and returns the config path. Never creates the file: when it is
 * missing or unreadable this throws, so a permission problem can not
 * silently degrade into "replace the user's config with the
 * template". writeFile's mode only applies on creation, hence the
 * explicit chmod to repair a previously loose permission.
 */
export async function updateGlobalConfig(
  mutate: (content: string) => string,
): Promise<string> {
  const configPath = globalConfigPath();
  const content = await readFile(configPath, 'utf8');
  await writeFile(configPath, mutate(content), {
    encoding: 'utf8',
    mode: 0o600,
  });
  await chmod(configPath, 0o600);
  return configPath;
}

/**
 * Sets or replaces KEY=value in dotenv-format content.
 *
 * Guarantees:
 * - Exactly ONE line for the key remains. Duplicate lines are
 *   collapsed: dotenv's parse() lets the LAST occurrence win, so
 *   rewriting only the first (as a naive regex replace would) leaves
 *   the old value silently effective.
 * - Every other line - comments (# ...), other keys, blanks - is
 *   preserved verbatim; the new value takes the position of the
 *   first existing occurrence, or is appended.
 * - CRLF input (a Windows editor may save it) is normalized to LF,
 *   and the result always ends with a newline.
 */
export function upsertConfigEntry(
  content: string,
  key: string,
  value: string,
): string {
  const line = `${key}=${value}`;
  const keyLine = new RegExp(`^\\s*${key}\\s*=`);
  const lines = content.split(/\r?\n/);
  const out: string[] = [];
  let done = false;
  for (const current of lines) {
    if (keyLine.test(current)) {
      if (!done) {
        out.push(line);
        done = true;
      }
      continue; // Drop duplicates of the key.
    }
    out.push(current);
  }
  if (!done) {
    // Append. When the content ended with \n, split() leaves a final
    // '' element - insert before it.
    if (out.length > 0 && out[out.length - 1] === '') {
      out[out.length - 1] = line;
    } else {
      out.push(line);
    }
  }
  if (out[out.length - 1] !== '') {
    out.push(''); // Ensure the file ends with a newline.
  }
  return out.join('\n');
}
