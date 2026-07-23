/**
 * Converts promidas-utils file I/O errors into user-facing messages.
 */
import { toLocalizedMessage } from 'promidas-utils/repository';

import type { FileIoError } from 'promidas-utils/file-io';

/**
 * Returns a Japanese description of a snapshot file I/O failure.
 */
export function describeFileIoError(error: FileIoError): string {
  const code = error.code ? ` (${error.code})` : '';
  switch (error.kind) {
    case 'READ_FAILED':
      return `ファイルを読み込めません${code}: ${error.message}`;
    case 'PARSE_FAILED':
      return `JSON として解釈できません: ${error.message}`;
    case 'SETUP_FAILED':
      return `snapshot データが不正です: ${toLocalizedMessage(error.snapshotFailure ?? null)}`;
    case 'SERIALIZE_FAILED':
      return `snapshot のシリアライズに失敗しました: ${error.message}`;
    case 'WRITE_FAILED':
      return `ファイルへの書き込みに失敗しました${code}: ${error.message}`;
    default:
      return error.message;
  }
}
