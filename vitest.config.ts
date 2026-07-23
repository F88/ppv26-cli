import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The Ink component tests render a full React tree via
    // ink-testing-library; on the slower Windows CI runners a few can
    // exceed vitest's 5s default and fail as flaky timeouts - unrelated
    // to the code under test (they pass on re-run and on other runners).
    // Give them headroom rather than masking the flakiness per-test.
    testTimeout: 15_000,
    // Tests live next to the sources they cover; nothing else is a test.
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
