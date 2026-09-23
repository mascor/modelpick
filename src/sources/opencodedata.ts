/**
 * OpenCode's public usage statistics (opencode.ai/data): how many of the
 * people who used a model in a week were still using it the next week.
 *
 * It is the one signal no benchmark gives: what people who code with OpenCode,
 * the tool we configure, keep using. It only breaks ties between models whose
 * Coding Index is too close to separate them (see METHODOLOGY.md).
 *
 * There is no API: the figures are embedded in the page, which is read once
 * per daily update. OpenCode's terms restrict automated extraction; reading it
 * is the site owner's explicit decision, with attribution and a link.
 */
import { fetchText } from '../lib/http.js';
import { matchForm } from '../lib/normalize.js';
import type { UsageSignal } from '../types.js';

export const OPENCODE_DATA_URL = 'https://opencode.ai/data/';

/** Fewer eligible user-weeks than this and a retention rate is noise. */
export const MIN_USER_WEEKS = 1000;


const RETENTION = /\{model:"([^"]+)",provider:"[^"]*",eligibleUserWeeks:(\d+),retainedUserWeeks:\d+,author:"[^"]*",rate:([\d.]+),rank:\d+\}/g;
const SESSION = /\{model:"([^"]+)",cost:([\d.]+),tokens:\d+\}/g;

/** One embedded table: from its key to the "}]" that closes its list of objects. */
const tableAt = (html: string, at: number): string => {
  const end = html.indexOf('}]', at);
  return html.slice(at, end < 0 ? undefined : end + 2);
};

/** Parses the figures embedded in the page. Exported for tests. */
export function parseUsage(html: string): { name: string; eligibleUserWeeks: number; retentionRate: number; sessionCostUsd: number | null }[] {
  const retentionAt = html.indexOf('retention:');
  const sessionAt = html.indexOf('sessionCost:');
  if (retentionAt < 0) throw new Error('OpenCode data: retention table not found in the page');
  const cost = new Map<string, number>();
  if (sessionAt >= 0) {
    for (const m of tableAt(html, sessionAt).matchAll(SESSION)) cost.set(m[1]!, Number(m[2]));
  }
  const rows = [...tableAt(html, retentionAt).matchAll(RETENTION)].map((m) => ({
    name: m[1]!,
    eligibleUserWeeks: Number(m[2]),
    retentionRate: Number(m[3]),
    sessionCostUsd: cost.get(m[1]!) ?? null,
  }));
  if (!rows.length) throw new Error('OpenCode data: retention table is empty or its format changed');
  return rows;
}

export async function fetchUsage(knownKeys: Map<string, string>, observedAt: string): Promise<{ signals: UsageSignal[]; unmatched: string[] }> {
  const rows = parseUsage(await fetchText(OPENCODE_DATA_URL));
  const signals: UsageSignal[] = [];
  const unmatched: string[] = [];
  for (const r of rows) {
    if (r.eligibleUserWeeks < MIN_USER_WEEKS) continue;
    const key = knownKeys.get(matchForm(r.name));
    if (!key) {
      unmatched.push(r.name);
      continue;
    }
    signals.push({ modelKey: key, name: r.name, retentionRate: r.retentionRate, eligibleUserWeeks: r.eligibleUserWeeks, sessionCostUsd: r.sessionCostUsd, observedAt });
  }
  return { signals, unmatched };
}
