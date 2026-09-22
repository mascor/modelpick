/**
 * OpenCode configuration generator.
 *
 * Two things we do not do, because the documentation does not support them:
 * we never put a literal API key in the file, and we never claim OpenCode will
 * switch to the backup model on its own - it will not.
 */
import type { Offer, ModelRecord } from '../types.js';

export interface OpenCodeConfigResult {
  /** File contents, ready to save as opencode.json. */
  json: string;
  /** Provider/model string for the everyday pick. */
  everydayId: string;
  backupId: string | null;
  /** One line to paste in a terminal: the fastest way to try the model. */
  everydayCommand: string;
  backupCommand: string | null;
  /** Environment variables the user has to export themselves. */
  envVars: string[];
  instructions: string[];
}

/**
 * models.dev is the registry OpenCode itself uses, so a provider id coming from
 * that source is already the provider id OpenCode expects. OpenRouter offers are
 * addressed through the built-in `openrouter` provider.
 */
export function modelIdFor(offer: Offer): string {
  if (offer.sourceId === 'openrouter') return `openrouter/${offer.remoteModelId}`;
  return `${offer.providerId}/${offer.remoteModelId}`;
}

export function buildOpenCodeConfig(
  everyday: { model: ModelRecord; offer: Offer } | null,
  hard: { model: ModelRecord; offer: Offer } | null,
): OpenCodeConfigResult | null {
  if (!everyday) return null;

  const everydayId = modelIdFor(everyday.offer);
  const backupId = hard ? modelIdFor(hard.offer) : null;

  const config: Record<string, unknown> = {
    $schema: 'https://opencode.ai/config.json',
    model: everydayId,
  };

  const envVars = [...new Set([everyday.offer.apiKeyEnv, hard?.offer.apiKeyEnv].filter(Boolean) as string[])];

  const instructions = [
    `Prova subito senza cambiare niente: ${'`'}opencode -m ${everydayId}${'`'}.`,
    'Per renderlo permanente salva il file come opencode.json nella cartella del progetto, oppure in ~/.config/opencode/opencode.json per usarlo ovunque.',
    envVars.length
      ? `Esporta la chiave del provider nella tua shell: ${envVars.map((v) => `export ${v}="..."`).join(' e ')}. La chiave resta sul tuo computer: questo sito non la chiede e non la riceve mai.`
      : 'Configura la chiave del provider secondo la sua documentazione: questo sito non chiede mai le tue chiavi.',
    backupId
      ? `Per il modello dei problemi difficili usa ${backupId}: in OpenCode selezionalo a mano con il comando /models, oppure cambia il valore di "model" in questo file. OpenCode non passa automaticamente a un modello di riserva.`
      : 'Non indichiamo un modello di riserva: le prove disponibili non ne giustificano uno.',
  ];

  return {
    json: JSON.stringify(config, null, 2),
    everydayId,
    backupId,
    everydayCommand: `opencode -m ${everydayId}`,
    backupCommand: backupId ? `opencode -m ${backupId}` : null,
    envVars,
    instructions,
  };
}
