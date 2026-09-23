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
 * highest Coding Index wins (a tie within TIE_POINTS goes to the cheaper one).
 * USD per month on the chosen usage scenario. Published on the method page.
 */
export type Budget = { everyday: number; hard: number };
export const BUDGETS: Record<Priority, Budget> = {
  cheap: { everyday: 5, hard: 50 },
  balanced: { everyday: 20, hard: 100 },
  quality: { everyday: 50, hard: 250 },
};

/** Below this many points two scores are treated as equal, and the cheaper model wins. */
export const TIE_POINTS = 1;

/** A runner-up within this many points of a pick, in the same budget, is shown next to it. */
export const ALTERNATIVE_POINTS = 3;

/**
 * Within this many points of the best score in the budget, benchmarks do not
 * really separate two models: the one OpenCode users keep using most wins.
 */
export const USAGE_POINTS = 3;
