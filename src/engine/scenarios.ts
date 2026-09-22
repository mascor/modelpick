/**
 * Usage scenarios. These are explicit, documented assumptions - never presented
 * as measured usage. Published on the method page; the API also accepts custom usage.
 */
export type TaskId = 'small-changes' | 'bug' | 'new-features' | 'refactoring' | 'analysis';
export type Priority = 'cheap' | 'balanced' | 'quality';

export interface TokenMix {
  /** Fresh input tokens read by the model in a month. */
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface Scenario {
  id: TaskId;
  label: string;
  description: string;
  /** Monthly token volumes for a single developer using a coding agent daily. */
  monthly: TokenMix;
  /** Minimum context an offer must serve for this kind of work. */
  minContextTokens: number;
}

export const SCENARIOS: Record<TaskId, Scenario> = {
  'small-changes': {
    id: 'small-changes',
    label: 'Piccole modifiche',
    description: 'Ritocchi mirati, rinomine, piccoli aggiustamenti su file già noti.',
    monthly: { input: 4_000_000, output: 400_000, cacheRead: 20_000_000, cacheWrite: 2_000_000 },
    minContextTokens: 100_000,
  },
  bug: {
    id: 'bug',
    label: 'Correzione di bug',
    description: 'Riprodurre, cercare la causa, correggere e far passare i test.',
    monthly: { input: 8_000_000, output: 900_000, cacheRead: 40_000_000, cacheWrite: 4_000_000 },
    minContextTokens: 128_000,
  },
  'new-features': {
    id: 'new-features',
    label: 'Nuove funzionalità',
    description: 'Scrivere codice nuovo su più file, con test e integrazione.',
    monthly: { input: 12_000_000, output: 1_800_000, cacheRead: 55_000_000, cacheWrite: 6_000_000 },
    minContextTokens: 200_000,
  },
  refactoring: {
    id: 'refactoring',
    label: 'Refactoring',
    description: 'Riorganizzare codice esistente su molti file mantenendo il comportamento.',
    monthly: { input: 15_000_000, output: 2_200_000, cacheRead: 70_000_000, cacheWrite: 7_000_000 },
    minContextTokens: 200_000,
  },
  analysis: {
    id: 'analysis',
    label: 'Analisi di un progetto',
    description: 'Leggere e spiegare un repository, poco codice prodotto, molta lettura.',
    monthly: { input: 20_000_000, output: 600_000, cacheRead: 90_000_000, cacheWrite: 9_000_000 },
    minContextTokens: 256_000,
  },
};

export const TASK_IDS = Object.keys(SCENARIOS) as TaskId[];
export const PRIORITIES: Priority[] = ['cheap', 'balanced', 'quality'];

/**
 * Quality gate per priority, on the scale of the reference metric: the
 * Artificial Analysis Coding Index when available, SWE-bench Verified otherwise.
 * The AA gates keep roughly the selectivity the SWE-bench ones had (top ~50%,
 * ~35%, ~25% of measured models for the everyday pick).
 * Documented in METHODOLOGY.md; changing these changes the recommendations.
 */
export type Gate = { everyday: number; hard: number };
export const QUALITY_GATE: Record<Priority, Gate> = {
  cheap: { everyday: 45, hard: 62 },
  balanced: { everyday: 55, hard: 68 },
  quality: { everyday: 64, hard: 72 },
};
export const AA_QUALITY_GATE: Record<Priority, Gate> = {
  cheap: { everyday: 45, hard: 68 },
  balanced: { everyday: 55, hard: 72 },
  quality: { everyday: 65, hard: 75 },
};
export const gateFor = (metric: string | null, priority: Priority): Gate =>
  (metric === 'aa_coding_index' ? AA_QUALITY_GATE : QUALITY_GATE)[priority];
