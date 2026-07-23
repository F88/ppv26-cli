import { describe, expect, it } from 'vitest';

import { LOG_LEVEL_KEY, STALE_HOURS_KEY } from './config-entries.js';
import {
  configGateErrors,
  isValidLogLevel,
  isValidStaleHours,
  validateConfigEntries,
} from './config-validation.js';
import { globalConfigPath } from './user-dirs.js';

import type { ConfigEntries } from './config-entries.js';

/** Builds ConfigEntries with everything unset except the overrides. */
function entries(overrides: Partial<ConfigEntries>): ConfigEntries {
  return {
    token: null,
    snapshotDir: null,
    logLevel: null,
    staleHours: null,
    fileStatus: 'read',
    ...overrides,
  };
}

describe('isValidLogLevel', () => {
  it('accepts exactly the five levels', () => {
    for (const level of ['debug', 'info', 'warn', 'error', 'silent']) {
      expect(isValidLogLevel(level)).toBe(true);
    }
  });

  it('rejects everything else, the empty string included', () => {
    for (const invalid of ['loud', 'INFO', 'info ', '']) {
      expect(isValidLogLevel(invalid)).toBe(false);
    }
  });
});

describe('isValidStaleHours', () => {
  it('accepts positive numbers, decimals included', () => {
    for (const valid of ['6', '0.5', '12', '1.25']) {
      expect(isValidStaleHours(valid)).toBe(true);
    }
  });

  it('rejects everything else, the empty string included', () => {
    for (const invalid of ['abc', '0', '-3', '1O', '1h', '']) {
      expect(isValidStaleHours(invalid)).toBe(false);
    }
  });
});

describe('validateConfigEntries', () => {
  it('reports nothing when the checked keys are unset', () => {
    expect(validateConfigEntries(entries({}))).toEqual([]);
  });

  it('reports nothing for valid values', () => {
    expect(
      validateConfigEntries(entries({ logLevel: 'warn', staleHours: '0.5' })),
    ).toEqual([]);
  });

  it('reports an invalid log level', () => {
    const errors = validateConfigEntries(entries({ logLevel: 'hoge' }));
    expect(errors).toHaveLength(1);
    expect(errors[0]?.key).toBe(LOG_LEVEL_KEY);
    expect(errors[0]?.value).toBe('hoge');
  });

  it('reports an invalid stale-hours value', () => {
    const errors = validateConfigEntries(entries({ staleHours: '6aasfas' }));
    expect(errors).toHaveLength(1);
    expect(errors[0]?.key).toBe(STALE_HOURS_KEY);
    expect(errors[0]?.value).toBe('6aasfas');
  });

  it('reports both keys when both are invalid', () => {
    const errors = validateConfigEntries(
      entries({ logLevel: '', staleHours: '0' }),
    );
    expect(errors.map((error) => error.key)).toEqual([
      LOG_LEVEL_KEY,
      STALE_HOURS_KEY,
    ]);
  });

  it('does not touch the unchecked keys (dir and token)', () => {
    expect(
      validateConfigEntries(
        entries({ token: '', snapshotDir: '' }), // empty, but not gated
      ),
    ).toEqual([]);
  });
});

describe('configGateErrors', () => {
  it('returns null when the entries pass', () => {
    expect(configGateErrors(entries({ logLevel: 'warn' }), 'ja')).toBeNull();
    expect(configGateErrors(entries({}), 'en')).toBeNull();
  });

  it('reports an unreadable file in both languages', () => {
    const broken = entries({ fileStatus: 'unreadable' });
    expect(configGateErrors(broken, 'ja')).toEqual([
      `設定ファイルを読み込めませんでした: ${globalConfigPath()}`,
      'ファイルの権限を確認してください。',
    ]);
    expect(configGateErrors(broken, 'en')).toEqual([
      `Could not read the config file: ${globalConfigPath()}`,
      'Check the file permissions.',
    ]);
  });

  it('reports invalid values in both languages, fix line last', () => {
    const broken = entries({ logLevel: 'hoge', staleHours: 'abc' });
    expect(configGateErrors(broken, 'ja')).toEqual([
      `設定ファイルの ${LOG_LEVEL_KEY} の値が不正です: "hoge" (debug | info | warn | error | silent)`,
      `設定ファイルの ${STALE_HOURS_KEY} の値が不正です: "abc" (正の数値、小数可)`,
      `設定ファイルを修正してください: ${globalConfigPath()}`,
    ]);
    expect(configGateErrors(broken, 'en')).toEqual([
      `Invalid ${LOG_LEVEL_KEY} in the config file: "hoge" (debug | info | warn | error | silent)`,
      `Invalid ${STALE_HOURS_KEY} in the config file: "abc" (positive number)`,
      `Fix the config file: ${globalConfigPath()}`,
    ]);
  });
});
