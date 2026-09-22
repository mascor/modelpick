/**
 * Aider polyglot benchmark (Apache-2.0). Secondary evidence: it measures whether
 * a model can apply edits to real files in several languages, which is close to
 * what a coding agent does. Comparability group = benchmark + edit format.
 */
import { parse } from 'yaml';
import { fetchText } from '../lib/http.js';
import { matchForm } from '../lib/normalize.js';
import type { QualityEvidence } from '../types.js';

const YML = 'https://raw.githubusercontent.com/Aider-AI/aider/main/aider/website/_data/polyglot_leaderboard.yml';
const HUMAN = 'https://aider.chat/docs/leaderboards/';

interface Row {
  model?: string;
  edit_format?: string;
  pass_rate_2?: number;
  percent_cases_well_formed?: number;
  date?: string;
  seconds_per_case?: number;
}

export async function fetchAider(
  observedAt: string,
  knownKeys: Map<string, string>,
): Promise<{ evidence: QualityEvidence[]; unmatched: string[]; scanned: number }> {
  const rows = (parse(await fetchText(YML)) as Row[]) ?? [];
  const evidence: QualityEvidence[] = [];
  const unmatched: string[] = [];

  for (const row of rows) {
    if (!row.model || typeof row.pass_rate_2 !== 'number') continue;
    const modelKey = knownKeys.get(matchForm(row.model));
    if (!modelKey) {
      unmatched.push(row.model);
      continue;
    }
    const format = row.edit_format ?? 'unknown';
    evidence.push({
      modelKey,
      metric: 'aider_polyglot',
      value: row.pass_rate_2,
      harness: `Aider polyglot, formato di modifica "${format}"`,
      harnessKey: `aider-polyglot|${format}`,
      attempts: 2,
      instanceCalls: null,
      reasoningEffort: null,
      measuredAt: row.date ?? null,
      sourceId: 'aider',
      sourceUrl: HUMAN,
      observedAt,
    });
  }
  return { evidence, unmatched, scanned: rows.length };
}
