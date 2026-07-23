/**
 * Terminal size that follows resize events, so layouts react
 * immediately when the window is resized. The single shared
 * implementation for every screen and component.
 */
import { useStdout } from 'ink';
import { useEffect, useState } from 'react';

export type TerminalSize = { readonly columns: number; readonly rows: number };

export function useTerminalSize(): TerminalSize {
  const { stdout } = useStdout();
  const [size, setSize] = useState<TerminalSize>({
    columns: stdout?.columns ?? 80,
    rows: stdout?.rows ?? 24,
  });
  useEffect(() => {
    if (!stdout) return;
    const onResize = (): void => {
      setSize({ columns: stdout.columns ?? 80, rows: stdout.rows ?? 24 });
    };
    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);
  return size;
}
