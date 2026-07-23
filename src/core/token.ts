/**
 * Token resolution for the ProtoPedia API.
 *
 * The global config file is the single source of truth (issue #7, decided
 * 2026-07-16): the token is read from the config file only. No
 * environment variables. Set it with the config set-token command
 * (see SET_TOKEN_COMMAND).
 */
import { configEntries } from './config-entries.js';
import { PPV_CLI_TOOL_NAME } from './constants.js';

/**
 * Returns the ProtoPedia API token, or null when not configured.
 */
export function resolveToken(): string | null {
  return configEntries().token;
}

/** The command that configures the token, shared by message + highlight. */
export const SET_TOKEN_COMMAND = `${PPV_CLI_TOOL_NAME} config set-token`;

/**
 * User-facing message shown when the API token is not configured, split
 * into the error (what went wrong) and the guide (how to fix it, which
 * embeds SET_TOKEN_COMMAND). The shared UI renders error in red, guide
 * in the default colour, and the command in cyan. Shared by the snapshot
 * picker and the snapshot manager so both stay identical (ppex / pptop
 * differ only by language). The ppv-cli CLI keeps its own stderr wording.
 */
export const TOKEN_MISSING_MESSAGE = {
  ja: {
    error: 'PROTOPEDIA_API_V2_TOKEN が未設定です。',
    guide: `${SET_TOKEN_COMMAND} で設定してください。`,
  },
  en: {
    error: 'PROTOPEDIA_API_V2_TOKEN is not set.',
    guide: `Run: ${SET_TOKEN_COMMAND}`,
  },
} as const;
