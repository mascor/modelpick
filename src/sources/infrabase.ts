/**
 * Infrabase.ai: hand-maintained directory of inference providers.
 *
 * Fills the gap every price source leaves open - who the provider actually is:
 * official site, headquarters country, GDPR status. Its robots.txt points
 * agents at a public JSON API, the data is CC-BY-4.0, and attribution is
 * required, so we carry it through to the sources page.
 *
 * The API returns at most 50 rows a page and paginates with `offset`,
 * `total` and `next_offset` (null on the last page), so each listing is read
 * to the end.
 */
import { fetchJson, pooled } from '../lib/http.js';

const API = 'https://infrabase.ai/api/query';

/** Listings read in full: together they cover the providers we quote. */
const LISTINGS: string[] = ['category=inference-apis', 'job=hosted-inference-api'];
const PAGE = 50;
/** Guard against a cursor that never ends: 20 pages is 1000 rows. */
const MAX_PAGES = 20;

type Page = { results?: Row[]; next_offset?: number | null };
type Get = (url: string) => Promise<Page>;

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

/** Every row of one listing, following next_offset to the last page. */
export async function readListing(query: string, get: Get = fetchJson<Page>): Promise<Row[]> {
  const rows: Row[] = [];
  let offset: number | null | undefined = 0;
  for (let page = 0; offset != null && page < MAX_PAGES; page++) {
    const body: Page = await get(`${API}?${query}&limit=${PAGE}&offset=${offset}`);
    rows.push(...(body.results ?? []));
    // Stop on a cursor that does not move forward, as well as on the last page.
    offset = body.next_offset != null && body.next_offset > offset ? body.next_offset : null;
  }
  return rows;
}

/**
 * @param lookFor provider names seen in our offers. Those the full listings do
 *        not cover get one targeted search each.
 */
export async function fetchInfrabase(lookFor: string[] = [], get: Get = fetchJson<Page>): Promise<{ providers: ProviderProfile[]; queries: number }> {
  const byKey = new Map<string, ProviderProfile>();
  const add = (rows: Row[]) => {
    for (const row of rows) {
      if (!row.name) continue;
      const key = providerKey(row.name);
      // First write wins; later queries only fill gaps left by earlier ones.
      const existing = byKey.get(key);
      byKey.set(key, {
        key,
        name: existing?.name ?? row.name,
        siteUrl: existing?.siteUrl ?? row.site_url ?? null,
        hqCountry: existing?.hqCountry ?? row.hq_country ?? null,
        gdpr: existing?.gdpr ?? row.gdpr ?? null,
        directoryUrl: existing?.directoryUrl ?? row.infrabase_url ?? null,
        updatedAt: existing?.updatedAt ?? row.updated_at ?? null,
      });
    }
  };

  let ok = 0;
  for (const r of await pooled(LISTINGS, (q) => readListing(q, get), 2)) {
    if (r.status === 'rejected') continue;
    ok++;
    add(r.value);
  }

  const missing = [...new Set(lookFor)]
    .filter((n) => n.trim().length > 2 && !findProfile(byKey.values(), n))
    .slice(0, 80);
  const searches = await pooled(missing, (n) => get(`${API}?category=inference-apis&limit=5&q=${encodeURIComponent(n)}`), 3);
  for (const r of searches) {
    if (r.status === 'rejected') continue;
    ok++;
    add(r.value.results ?? []);
  }

  if (!ok) throw new Error('No Infrabase query succeeded');
  return { providers: [...byKey.values()], queries: ok };
}
