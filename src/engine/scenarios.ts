/**
 * Usage scenarios. These are explicit, documented assumptions - never presented
 * as measured usage. The user can replace every number from the UI.
 */
export type TaskId = 'piccole-modifiche' | 'bug' | 'nuove-funzionalita' | 'refactoring' | 'analisi';
export type Priority = 'risparmio' | 'equilibrio' | 'qualita';

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
  'piccole-modifiche': {
    id: 'piccole-modifiche',
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
  'nuove-funzionalita': {
    id: 'nuove-funzionalita',
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
  analisi: {
    id: 'analisi',
    label: 'Analisi di un progetto',
    description: 'Leggere e spiegare un repository, poco codice prodotto, molta lettura.',
    monthly: { input: 20_000_000, output: 600_000, cacheRead: 90_000_000, cacheWrite: 9_000_000 },
    minContextTokens: 256_000,
  },
};

export const TASK_IDS = Object.keys(SCENARIOS) as TaskId[];
export const PRIORITIES: Priority[] = ['risparmio', 'equilibrio', 'qualita'];

/**
 * Quality gate per priority, expressed as a minimum SWE-bench Verified score.
 * Documented in METHODOLOGY.md; changing these changes the recommendations.
 */
export const QUALITY_GATE: Record<Priority, { everyday: number; hard: number }> = {
  risparmio: { everyday: 45, hard: 62 },
  equilibrio: { everyday: 55, hard: 68 },
  qualita: { everyday: 64, hard: 72 },
};
