/**
 * System clipboard access through the platform utility, so copied
 * text is byte-exact regardless of terminal wrapping.
 */
import { spawn } from 'node:child_process';

/**
 * Copies text to the system clipboard (pbcopy on macOS, clip on
 * Windows). Resolves false when no utility is available for the
 * platform or the utility exits with a failure.
 */
export function copyToClipboard(text: string): Promise<boolean> {
  const command =
    process.platform === 'darwin'
      ? 'pbcopy'
      : process.platform === 'win32'
        ? 'clip'
        : null;
  if (command === null) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    const child = spawn(command, { stdio: ['pipe', 'ignore', 'ignore'] });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
    child.stdin.on('error', () => {
      // Spawn failures also surface here; 'error'/'close' resolve.
    });
    child.stdin.write(text);
    child.stdin.end();
  });
}
