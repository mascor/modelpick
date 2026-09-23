/**
 * OpenCode configuration.
 *
 * The important subtlety: `opencode -m openrouter/<model>` does NOT choose a
 * provider. OpenRouter routes the request itself, so a price quoted for one
 * provider is not what that command will bill. To hold a provider you must pin
 * it in the config, which OpenCode passes through to OpenRouter's routing.
 *
 * Two things we still never do: put a literal API key in the file, or claim
 * OpenCode falls back to the backup model on its own.
 */
import type { Offer, ModelRecord } from '../types.js';
import { t, type Lang } from '../i18n.js';

export interface PickConfig {
  /** provider/model string, as OpenCode addresses it. */
  modelId: string;
  /** Quick try. Exact for a direct provider; unpinned through a broker. */
  command: string;
  /** True when the command alone really uses the quoted provider. */
  commandIsExact: boolean;
  /** Config that pins the provider, when pinning is possible. */
  config: string | null;
  /** Why a pin is needed, or why it cannot be done. */
  pinNote: string | null;
}

export interface OpenCodeConfigResult {
  json: string;
  /** Whether the file really holds the provider we quoted, per pick. */
  pinned: { everyday: boolean; hard: boolean };
  everydayId: string;
  backupId: string | null;
  everydayCommand: string;
  backupCommand: string | null;
  envVars: string[];
  instructions: string[];
}

/**
 * models.dev is the registry OpenCode uses, so its provider ids are the ones
 * OpenCode expects. OpenRouter offers are addressed through its own provider.
 */
export function modelIdFor(offer: Offer): string {
  if (offer.sourceId === 'openrouter') return `openrouter/${offer.remoteModelId}`;
  return `${offer.providerId}/${offer.remoteModelId}`;
}

/** Everything needed to actually use one offer. */
/** Reasoning efforts OpenCode can set on OpenAI's own API (docs: opencode.ai/docs/models). */
export const OPENAI_EFFORTS = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']);

/**
 * @param effort the reasoning effort the score was measured with. When set,
 *        the configuration asks for it: without it the buyer would get another
 *        variant than the one we quoted.
 */
export function configFor(offer: Offer, lang: Lang = 'it', effort: string | null = null): PickConfig {
  const c = t(lang).engine;
  const modelId = modelIdFor(offer);
  const command = `opencode -m ${modelId}`;
  const routed = offer.sourceId === 'openrouter';

  if (!routed && effort && offer.providerId === 'openai' && OPENAI_EFFORTS.has(effort)) {
    const config = {
      $schema: 'https://opencode.ai/config.json',
      provider: { openai: { models: { [offer.remoteModelId ?? '']: { options: { reasoningEffort: effort } } } } },
      model: modelId,
    };
    return { modelId, command, commandIsExact: false, config: JSON.stringify(config, null, 2), pinNote: null };
  }

  if (!routed) {
    // Buying straight from the provider: the model id already determines who bills you.
    return { modelId, command, commandIsExact: true, config: null, pinNote: null };
  }

  if (!offer.routingSlug) {
    return {
      modelId,
      command,
      commandIsExact: false,
      config: null,
      pinNote: c.cannotPin(offer.providerName),
    };
  }

  const config = {
    $schema: 'https://opencode.ai/config.json',
    provider: {
      openrouter: {
        models: {
          [offer.remoteModelId ?? '']: {
            options: { provider: { order: [offer.routingSlug], allow_fallbacks: false } },
          },
        },
      },
    },
    model: modelId,
  };

  return {
    modelId,
    command,
    commandIsExact: false,
    config: JSON.stringify(config, null, 2),
    pinNote: c.pinNote(offer.providerName),
  };
}

export function buildOpenCodeConfig(
  everyday: { model: ModelRecord; offer: Offer; effort?: string | null } | null,
  hard: { model: ModelRecord; offer: Offer; effort?: string | null } | null,
): OpenCodeConfigResult | null {
  if (!everyday) return null;

  const eConf = configFor(everyday.offer, 'it', everyday.effort ?? null);
  const hConf = hard ? configFor(hard.offer, 'it', hard.effort ?? null) : null;

  // One file for both picks: each provider is pinned under its own model id,
  // so choosing the backup with /models keeps the provider we quoted a price for.
  const config: Record<string, unknown> = eConf.config
    ? (JSON.parse(eConf.config) as Record<string, unknown>)
    : { $schema: 'https://opencode.ai/config.json', model: eConf.modelId };
  if (hConf?.config) {
    const hard = JSON.parse(hConf.config) as { provider?: Record<string, { models?: Record<string, unknown> }> };
    const into = (config.provider ??= {}) as Record<string, { models?: Record<string, unknown> }>;
    for (const [providerId, block] of Object.entries(hard.provider ?? {})) {
      const existing = (into[providerId] ??= {});
      existing.models = { ...(existing.models ?? {}), ...(block.models ?? {}) };
    }
  }
  // The everyday pick stays the default model whatever the backup pinned.
  config.model = eConf.modelId;

  const envVars = [...new Set([everyday.offer.apiKeyEnv, hard?.offer.apiKeyEnv].filter(Boolean) as string[])];

  const instructions = [
    `Prova subito: ${eConf.command}${eConf.commandIsExact ? '' : ' (OpenRouter sceglie il provider, il prezzo può differire)'}.`,
    eConf.config
      ? 'Per usare davvero il provider indicato salva questa configurazione come opencode.json nella cartella del progetto, oppure in ~/.config/opencode/opencode.json.'
      : 'Per renderlo predefinito salva questa configurazione come opencode.json nella cartella del progetto, oppure in ~/.config/opencode/opencode.json.',
    envVars.length
      ? `La chiave si registra con il comando /connect dentro OpenCode, oppure esportandola nella shell: ${envVars.map((v) => `export ${v}="..."`).join(', ')}. Il sito non la chiede e non la riceve mai.`
      : 'Configura la chiave del provider secondo la sua documentazione: questo sito non chiede mai le tue chiavi.',
    hConf
      ? `Per i problemi difficili usa ${hConf.modelId}: selezionalo a mano con /models o cambiando "model". OpenCode non passa automaticamente a un modello di riserva.`
      : 'Non indichiamo un modello di riserva: le prove disponibili non ne giustificano uno.',
  ];

  return {
    // Buying direct needs no pin: the model id already names who bills you.
    pinned: {
      everyday: Boolean(eConf.config) || eConf.commandIsExact,
      hard: hConf ? Boolean(hConf.config) || hConf.commandIsExact : true,
    },
    json: JSON.stringify(config, null, 2),
    everydayId: eConf.modelId,
    backupId: hConf?.modelId ?? null,
    everydayCommand: eConf.command,
    backupCommand: hConf?.command ?? null,
    envVars,
    instructions,
  };
}
