/**
 * Infrabase.ai: hand-maintained directory of inference providers.
 *
 * Fills the gap every price source leaves open - who the provider actually is:
 * official site, headquarters country, GDPR status. Its robots.txt points
 * agents at a public JSON API, the data is CC-BY-4.0, and attribution is
 * required, so we carry it through to the sources page.
 *
 * The API caps `limit` at 50 with no pagination, so we widen coverage with
 * several narrow queries and merge the results.
 */
import { fetchJson, pooled } from '../lib/http.js';

const API = 'https://infrabase.ai/api/query';

/** Queries chosen to spread across the directory despite the 50-row cap. */
const QUERIES: string[] = [
  'category=inference-apis&limit=50&sort=name&order=asc',
  'category=inference-apis&limit=50&sort=name&order=desc',
  'category=inference-apis&limit=50&sort=updated&order=desc',
  'category=inference-apis&limit=50&sort=github_stars&order=desc',
  'category=inference-apis&gdpr=true&limit=50',
  'job=hosted-inference-api&limit=50',
];

export interface ProviderProfile {
  /** Normalised key used to match against the provider names in our offers. */
  key: string;
  name: string;
  siteUrl: string | null;
  /** ISO-3166 alpha-2 of the headquarters, when the directory records one. */
  hqCountry: string | null;
  /** Directory's GDPR flag: true, false, or null when not assessed. */
  gdpr: boolean | null;
  directoryUrl: string | null;
  updatedAt: string | null;
}

interface Row {
  name?: string;
  slug?: string;
  site_url?: string | null;
  infrabase_url?: string | null;
  hq_country?: string | null;
  gdpr?: boolean | null;
  updated_at?: string | null;
}

/** "GMI Cloud" and "GMICloud" are the same company written by two sources. */
export const providerKey = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * The directory writes a company's name with its product ("Anthropic Claude",
 * "Google Gemini API") where our offers carry the company alone. We accept a
 * prefix match only when exactly one entry matches, so "OpenAI" can never be
 * attached to a hypothetical "OpenAI Router" while both exist.
 */
export function findProfile<T extends { key: string }>(profiles: Iterable<T>, providerName: string): T | null {
  const key = providerKey(providerName);
  if (!key) return null;
  const all = [...profiles];
  const exact = all.find((p) => p.key === key);
  if (exact) return exact;
  const near = all.filter((p) => p.key.startsWith(key) || key.startsWith(p.key));
  return near.length === 1 ? near[0]! : null;
}

/**
 * @param lookFor provider names seen in our offers. The directory caps a query
 *        at 50 rows with no pagination, so the broad sweeps above are followed
 *        by one targeted search per provider we actually quote.
 */
export async function fetchInfrabase(lookFor: string[] = []): Promise<{ providers: ProviderProfile[]; queries: number }> {
  const targeted = [...new Set(lookFor)]
    .filter((n) => n.trim().length > 2)
    .slice(0, 80)
    .map((n) => `category=inference-apis&limit=5&q=${encodeURIComponent(n)}`);

  const results = await pooled([...QUERIES, ...targeted], async (qs) => fetchJson<{ results?: Row[] }>(`${API}?${qs}`), 3);

  const byKey = new Map<string, ProviderProfile>();
  let ok = 0;
  for (const r of results) {
    if (r.status === 'rejected') continue;
    ok++;
    for (const row of r.value.results ?? []) {
      if (!row.name) continue;
      const key = providerKey(row.name);
      // First write wins; later queries only fill gaps left by earlier ones.
      const existing = byKey.get(key);
      const profile: ProviderProfile = {
        key,
        name: row.name,
        siteUrl: row.site_url ?? existing?.siteUrl ?? null,
        hqCountry: row.hq_country ?? existing?.hqCountry ?? null,
        gdpr: row.gdpr ?? existing?.gdpr ?? null,
        directoryUrl: row.infrabase_url ?? existing?.directoryUrl ?? null,
        updatedAt: row.updated_at ?? existing?.updatedAt ?? null,
      };
      byKey.set(key, profile);
    }
  }

  if (!ok) throw new Error('No Infrabase query succeeded');
  return { providers: [...byKey.values()], queries: ok };
}
