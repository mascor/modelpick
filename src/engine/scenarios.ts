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
 * The whole choice rule: each priority is a monthly budget, and within it the
 * highest Coding Index wins; models within CLOSE_POINTS of it are treated as
 * close enough for usage and price to decide.
 * USD per month on the chosen usage scenario. Published on the method page.
 */
export type Budget = { everyday: number; hard: number };
export const BUDGETS: Record<Priority, Budget> = {
  cheap: { everyday: 5, hard: 50 },
  balanced: { everyday: 20, hard: 100 },
  quality: { everyday: 50, hard: 250 },
};

/**
 * A project choice, not a statistical margin: scores this close are treated as
 * close enough to let usage and price decide. The same threshold is used for
 * the choice, for naming a second model and for showing an alternative.
 */
export const CLOSE_POINTS = 3;
