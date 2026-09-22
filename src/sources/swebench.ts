/**
 * SWE-bench Verified, read from the public leaderboard repository.
 *
 * Only runs sharing the same harness (agent scaffold + version + attempt count)
 * are comparable, so every score carries a `harnessKey` and the engine never
 * compares across keys. The repository declares no licence: we take the
 * published numbers as facts and always link back to the submission.
 */
import { parse } from 'yaml';
import { fetchJson, fetchTextCached, pooled } from '../lib/http.js';
import { matchForm } from '../lib/normalize.js';
import type { QualityEvidence } from '../types.js';

const LIST = 'https://api.github.com/repos/SWE-bench/experiments/contents/evaluation/verified';
const RAW = 'https://raw.githubusercontent.com/SWE-bench/experiments/main/evaluation/verified';
const HUMAN = 'https://github.com/SWE-bench/experiments/tree/main/evaluation/verified';

interface Entry { name: string; type: string }

interface Metadata {
  info?: {
    name?: string;
    resolved?: number;
    instance_calls?: number;
    model_release_date?: number | string;
    'mini-swe-agent_version'?: string;
  };
  tags?: {
    model?: string[];
    model_display?: string;
    model_org?: string;
    agent?: string;
    agent_org?: string;
    reasoning_effort?: string;
    system?: { attempts?: number };
  };
}

const yearMonthDay = (v: number | string | undefined): string | null => {
  if (v === undefined) return null;
  const s = String(v);
  if (!/^\d{8}$/.test(s)) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
};

/** A run only counts as measured evidence when the harness is identified. */
const harnessOf = (dir: string, meta: Metadata): { harness: string; harnessKey: string } | null => {
  const agent = meta.tags?.agent ?? null;
  const version = meta.info?.['mini-swe-agent_version'] ?? null;
  if (!agent) return null;
  const attempts = meta.tags?.system?.attempts ?? 1;
  const effort = meta.tags?.reasoning_effort ?? 'default';
  const key = `${agent}@${version ?? 'unversioned'}|attempts=${attempts}|effort=${effort}`;
  const label = version ? `${agent} ${version}` : agent;
  void dir;
  return { harness: `${label} (${attempts} attempt(s), effort ${effort})`, harnessKey: key };
};

export async function fetchSweBench(
  observedAt: string,
  knownKeys: Map<string, string>,
): Promise<{ evidence: QualityEvidence[]; unmatched: string[]; scanned: number }> {
  const entries = await fetchJson<Entry[]>(LIST);
  const dirs = entries.filter((e) => e.type === 'dir').map((e) => e.name);

  // A published run never changes, so it is cached permanently: after the first
  // update only genuinely new submissions cost a request.
  const results = await pooled(dirs, async (dir) => {
    const text = await fetchTextCached(`${RAW}/${dir}/metadata.yaml`, `swebench:${dir}`);
    return { dir, meta: parse(text) as Metadata };
  });

  const evidence: QualityEvidence[] = [];
  const unmatched: string[] = [];

  for (const r of results) {
    if (r.status === 'rejected') continue;
    const { dir, meta } = r.value;
    const resolved = meta.info?.resolved;
    if (typeof resolved !== 'number' || !Number.isFinite(resolved)) continue;

    const harness = harnessOf(dir, meta);
    if (!harness) continue;

    const candidates = [...(meta.tags?.model ?? []), meta.tags?.model_display ?? '', meta.info?.name ?? ''].filter(Boolean);
    const modelKey = candidates.map((c) => knownKeys.get(matchForm(c))).find(Boolean);
    if (!modelKey) {
      unmatched.push(candidates[0] ?? dir);
      continue;
    }

    evidence.push({
      modelKey,
      metric: 'swebench_verified',
      value: resolved,
      harness: harness.harness,
      harnessKey: harness.harnessKey,
      attempts: meta.tags?.system?.attempts ?? null,
      instanceCalls: meta.info?.instance_calls ?? null,
      reasoningEffort: meta.tags?.reasoning_effort ?? null,
      measuredAt: dir.slice(0, 8).match(/^\d{8}$/)
        ? `${dir.slice(0, 4)}-${dir.slice(4, 6)}-${dir.slice(6, 8)}`
        : yearMonthDay(meta.info?.model_release_date),
      sourceId: 'swebench',
      sourceUrl: `${HUMAN}/${dir}`,
      observedAt,
    });
  }

  return { evidence, unmatched, scanned: dirs.length };
}
