/**
 * How models relate to each other by name: which builds belong to a
 * deprecated model, and which newer version of a line has come out.
 *
 * Both rules work on our canonical keys ("vendor/slug"). They are deliberately
 * narrow: a wrong "successor" or a wrong "deprecated" would mislead the user.
 */

const slugOf = (key: string) => key.slice(key.indexOf('/') + 1);
const vendorOf = (key: string) => key.slice(0, key.indexOf('/'));

/** A dated build tag: 0731, 260731, 20260731. */
const DATE_TAG = /^(\d{4}|\d{6}|\d{8})$/;

/**
 * Keys that belong to a deprecated model: the model itself, its dated builds
 * and the variants sellers publish under it ("-0731", ":thinking", "-flex",
 * "@eu"). A different version is not included: "gpt-4" deprecated does not
 * touch "gpt-4-1" (GPT-4.1) or "gpt-4o".
 */
export function deprecatedKeys(deprecated: Iterable<string>, allKeys: Iterable<string>): Set<string> {
  const bases = [...deprecated];
  const out = new Set<string>(bases);
  for (const key of allKeys) {
    const vendor = vendorOf(key);
    const slug = slugOf(key);
    for (const base of bases) {
      if (vendorOf(base) !== vendor) continue;
      const b = slugOf(base);
      if (slug === b) {
        out.add(key);
        break;
      }
      if (!slug.startsWith(b) || !/^[-:@]/.test(slug.slice(b.length))) continue;
      const next = slug.slice(b.length + 1).split(/[-:@]/)[0] ?? '';
      // A plain number right after the base is a new version, not a build.
      if (/^\d+$/.test(next) && !DATE_TAG.test(next)) continue;
      out.add(key);
      break;
    }
  }
  return out;
}

/** Variants a seller adds to a model: they are not a new version of anything. */
const VARIANT_TOKENS = new Set(['free', 'flex', 'fast', 'speed', 'batch', 'turbo', 'eu', 'us', 'exp', 'preview', 'latest', 'beta']);

export interface Line {
  /** The name without its version: "deepseek-flash" for DeepSeek V4.1 Flash. */
  line: string;
  /** The version numbers in order: [4, 1] for V4.1. */
  version: number[];
}

/**
 * Splits a key into its line and version, or null when the key is a seller's
 * variant (":thinking", "@eu", "-free") rather than a model of its own.
 */
export function lineOf(key: string): Line | null {
  const slug = slugOf(key);
  if (/[:@~]/.test(slug)) return null;
  // "2024-05-13" is one date, not a version 5.13.
  const tokens = slug.replace(/(?:^|-)20\d\d-\d\d-\d\d(?=-|$)/g, '').split('-').filter(Boolean);
  const words: string[] = [];
  const version: number[] = [];
  for (const t of tokens) {
    if (VARIANT_TOKENS.has(t)) return null;
    if (DATE_TAG.test(t)) continue;
    const v = /^v?(\d{1,3})$/.exec(t);
    if (v) {
      version.push(Number(v[1]));
      continue;
    }
    words.push(t);
  }
  if (!version.length || !words.length) return null;
  return { line: `${vendorOf(key)}/${words.join('-')}`, version };
}

const newer = (a: number[], b: number[]): boolean => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
};

/**
 * The most recent version of the same line among `candidates`, newer than
 * `key`. Candidates are the models on sale that have no quality measurement.
 */
export function successorOf(key: string, candidates: Iterable<string>): string | null {
  const own = lineOf(key);
  if (!own) return null;
  let best: { key: string; version: number[] } | null = null;
  for (const k of candidates) {
    if (k === key) continue;
    const other = lineOf(k);
    if (!other || other.line !== own.line || !newer(other.version, own.version)) continue;
    if (!best || newer(other.version, best.version)) best = { key: k, version: other.version };
  }
  return best?.key ?? null;
}
