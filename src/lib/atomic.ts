/** Atomic publish: readers never observe a half-written snapshot. */
import { mkdir, rename, writeFile, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmp, JSON.stringify(value), 'utf8');
  // rename() is atomic within a filesystem: the old file stays valid until it is replaced.
  await rename(tmp, path);
}

export async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return null;
  }
}
