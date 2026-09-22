/**
 * Model identity. Different sources spell the same model differently; different
 * modes of the same model (batch, quantized, thinking) are deliberately NOT
 * merged, because comparing them would compare different products.
 */

const VENDOR_ALIASES: Record<string, string> = {
  'google deepmind': 'google',
  googledeepmind: 'google',
  google: 'google',
  'x ai': 'x-ai',
  xai: 'x-ai',
  'x-ai': 'x-ai',
  moonshotai: 'moonshot',
  moonshot: 'moonshot',
  'moonshot ai': 'moonshot',
  'z ai': 'z-ai',
  zai: 'z-ai',
  zhipu: 'z-ai',
  'zhipu ai': 'z-ai',
  alibaba: 'qwen',
  'alibaba cloud': 'qwen',
  qwen: 'qwen',
  'meta llama': 'meta-llama',
  meta: 'meta-llama',
  mistral: 'mistralai',
  'mistral ai': 'mistralai',
  openai: 'openai',
  anthropic: 'anthropic',
  deepseek: 'deepseek',
  minimax: 'minimax',
};

export const normalizeVendor = (raw: string): string => {
  const cleaned = raw.trim().toLowerCase().replace(/[_]+/g, ' ');
  return VENDOR_ALIASES[cleaned] ?? cleaned.replace(/\s+/g, '-');
};

/** Lowercase, dots become dashes, runs of separators collapse. */
export const normalizeSlug = (raw: string): string =>
  raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/\./g, '-')
    .replace(/_/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Canonical key: "vendor/slug[:variant]". The variant (batch, free, thinking…)
 * stays in the key on purpose.
 */
export function canonicalKey(vendorRaw: string, slugRaw: string): string {
  const [base, variant] = slugRaw.split(':');
  const slug = normalizeSlug(base ?? slugRaw);
  const vendor = normalizeVendor(vendorRaw);
  return variant ? `${vendor}/${slug}:${normalizeSlug(variant)}` : `${vendor}/${slug}`;
}

/** Splits "vendor/model" ids used by OpenRouter; "~vendor/x" are floating aliases. */
export function keyFromPath(path: string): { key: string; floating: boolean } {
  const floating = path.startsWith('~');
  const clean = floating ? path.slice(1) : path;
  const slash = clean.indexOf('/');
  if (slash === -1) return { key: canonicalKey('unknown', clean), floating };
  return { key: canonicalKey(clean.slice(0, slash), clean.slice(slash + 1)), floating };
}

/**
 * Comparison form used to match a foreign name (a benchmark row) against known
 * models: vendor dropped, punctuation flattened.
 *
 * Only reasoning-effort words and floating-alias words are removed. Mode words
 * such as "thinking", "chat" or "instruct" are kept, because they identify
 * genuinely different products that must never collapse into one another.
 */
export function matchForm(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/\(([^)]*)\)/g, ' $1 ');
  s = s.replace(/[^a-z0-9]+/g, '-');
  s = s.replace(/-(latest|stable|default|high|medium|low|minimal)\b/g, '');
  s = s.replace(/^(anthropic|openai|google|googledeepmind|deepseek|qwen|alibaba|moonshot|moonshotai|zai|z-ai|xai|x-ai|meta|meta-llama|mistral|mistralai|minimax)-/, '');
  return s.replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
}

/** Two names refer to the same model when their comparison forms agree. */
export const sameModel = (a: string, b: string): boolean => matchForm(a) === matchForm(b);

/** USD per token -> USD per 1M tokens. Returns null for missing or unparsable input. */
export function perMillion(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n * 1_000_000;
}

/** A value already expressed per 1M tokens (models.dev convention). */
export function asPerMillion(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export const hoursSince = (iso: string | null | undefined, now = Date.now()): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : (now - t) / 3_600_000;
};
