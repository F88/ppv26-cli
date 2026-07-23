import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { TokenMissingNotice } from './token-missing-notice.js';
import { SET_TOKEN_COMMAND } from '../core/token.js';

// The headless test frame carries no ANSI colour, so these assert the
// content and the two-line split (error line + guide line with the
// command); the cyan highlight itself is verified by eye.
describe('TokenMissingNotice', () => {
  it('renders the error and the guide (with the command) on two lines in ja', () => {
    const { lastFrame, unmount } = render(<TokenMissingNotice lang="ja" />);
    const lines = (lastFrame() ?? '').split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('PROTOPEDIA_API_V2_TOKEN が未設定です。');
    expect(lines[0]).not.toContain(SET_TOKEN_COMMAND);
    expect(lines[1]).toContain(SET_TOKEN_COMMAND);
    expect(lines[1]).toContain('で設定してください。');
    unmount();
  });

  it('renders the error and the guide (with the command) on two lines in en', () => {
    const { lastFrame, unmount } = render(<TokenMissingNotice lang="en" />);
    const lines = (lastFrame() ?? '').split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('PROTOPEDIA_API_V2_TOKEN is not set.');
    expect(lines[0]).not.toContain(SET_TOKEN_COMMAND);
    expect(lines[1]).toContain(`Run: ${SET_TOKEN_COMMAND}`);
    unmount();
  });
});
