/**
 * Snapshot file deletion (issue #10).
 *
 * Permanent deletion with a confirmation step in the UI - Trash
 * support was considered and permanently rejected:
 * trashing does not free disk space (the motivation for deleting),
 * has no Node standard API, and behaves unpredictably across
 * platforms.
 *
 * No pre-checks: filesystem state can change at any moment, so each
 * unlink is attempted and its own failure is reported (per file);
 * one failure does not stop the rest.
 */
import { unlink } from 'node:fs/promises';
import path from 'node:path';

export type DeleteResult = {
  readonly filePath: string;
  readonly fileName: string;
  readonly ok: boolean;
  /** Failure reason (errno message) when ok is false. */
  readonly message?: string;
};

/**
 * Deletes the given snapshot files, one by one. Always returns one
 * result per requested path, in the requested order.
 */
export async function deleteSnapshotFiles(
  filePaths: readonly string[],
): Promise<DeleteResult[]> {
  const results: DeleteResult[] = [];
  for (const filePath of filePaths) {
    const fileName = path.basename(filePath);
    try {
      await unlink(filePath);
      results.push({ filePath, fileName, ok: true });
    } catch (error) {
      results.push({
        filePath,
        fileName,
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}
