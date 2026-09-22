/** HTTP helpers: timeouts, bounded retries, polite concurrency, disk cache. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { HTTP, PATHS } from '../config.js';

export class HttpError extends Error {
  constructor(readonly status: number, readonly url: string, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry only on transient failures; a 404 is an answer, not a hiccup. */
const retriable = (status: number) => status === 408 || status === 425 || status === 429 || status >= 500;

export async function fetchText(url: string, init: RequestInit = {}): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= HTTP.retries; attempt++) {
    if (attempt > 0) await sleep(HTTP.backoffMs * 2 ** (attempt - 1));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTTP.timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: { 'user-agent': HTTP.userAgent, accept: 'application/json, text/plain, */*', ...(init.headers ?? {}) },
      });
      if (!res.ok) {
        const err = new HttpError(res.status, url, `HTTP ${res.status} su ${url}`);
        if (retriable(res.status) && attempt < HTTP.retries) {
          lastError = err;
          continue;
        }
        throw err;
      }
      return await res.text();
    } catch (err) {
      lastError = err;
      const fatal = err instanceof HttpError && !retriable(err.status);
      if (fatal || attempt === HTTP.retries) throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const text = await fetchText(url, init);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Risposta non JSON da ${url}`);
  }
}

const cachePath = (key: string) => join(PATHS.cache, `${createHash('sha1').update(key).digest('hex')}.json`);

/**
 * Immutable-by-nature resources (a published benchmark run never changes) are
 * cached forever so a daily update costs one request per new item.
 */
export async function fetchJsonCached<T>(url: string, key = url): Promise<T> {
  const file = cachePath(key);
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    /* cache miss */
  }
  const value = await fetchJson<T>(url);
  await mkdir(PATHS.cache, { recursive: true });
  await writeFile(file, JSON.stringify(value), 'utf8');
  return value;
}

export async function fetchTextCached(url: string, key = url): Promise<string> {
  const file = cachePath(`text:${key}`);
  try {
    return await readFile(file, 'utf8');
  } catch {
    /* cache miss */
  }
  const value = await fetchText(url);
  await mkdir(PATHS.cache, { recursive: true });
  await writeFile(file, value, 'utf8');
  return value;
}

/** Runs tasks with a fixed worker pool so we never hammer a source. */
export async function pooled<T, R>(items: T[], worker: (item: T, index: number) => Promise<R>, limit = HTTP.concurrency): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor++;
      const item = items[index];
      if (index >= items.length || item === undefined) return;
      try {
        results[index] = { status: 'fulfilled', value: await worker(item, index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  });
  await Promise.all(runners);
  return results;
}
