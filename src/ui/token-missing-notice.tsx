/**
 * Shared render for the "API token not set" case, used by the snapshot
 * picker and the snapshot manager so both surfaces show the same content
 * and colours (ppex / pptop differ only by language).
 *
 * Two lines, by colour meaning:
 *   - error (red): the processing result — what went wrong.
 *   - guide (default colour): the app's suggested remediation, which is
 *     not itself a processing result; the `ppv-cli config set-token` command
 *     within it is highlighted (cyan) so it stands out to copy.
 */
import { Box, Text } from 'ink';

import { SET_TOKEN_COMMAND, TOKEN_MISSING_MESSAGE } from '../core/token.js';

export type TokenMissingLang = keyof typeof TOKEN_MISSING_MESSAGE;

export function TokenMissingNotice({
  lang,
}: {
  readonly lang: TokenMissingLang;
}) {
  const { error, guide } = TOKEN_MISSING_MESSAGE[lang];
  const index = guide.indexOf(SET_TOKEN_COMMAND);
  return (
    <Box flexDirection="column">
      <Text color="red">{error}</Text>
      <Text>
        {index === -1 ? (
          guide
        ) : (
          <>
            {guide.slice(0, index)}
            <Text color="cyan">{SET_TOKEN_COMMAND}</Text>
            {guide.slice(index + SET_TOKEN_COMMAND.length)}
          </>
        )}
      </Text>
    </Box>
  );
}
