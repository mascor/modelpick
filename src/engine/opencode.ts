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
export function configFor(offer: Offer, lang: Lang = 'it'): PickConfig {
  const c = t(lang).engine;
  const modelId = modelIdFor(offer);
  const command = `opencode -m ${modelId}`;
  const routed = offer.sourceId === 'openrouter';

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
  everyday: { model: ModelRecord; offer: Offer } | null,
  hard: { model: ModelRecord; offer: Offer } | null,
): OpenCodeConfigResult | null {
  if (!everyday) return null;

  const eConf = configFor(everyday.offer);
  const hConf = hard ? configFor(hard.offer) : null;

  // The downloadable file pins the everyday provider when that is possible.
  const config: Record<string, unknown> = eConf.config
    ? (JSON.parse(eConf.config) as Record<string, unknown>)
    : { $schema: 'https://opencode.ai/config.json', model: eConf.modelId };

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
    json: JSON.stringify(config, null, 2),
    everydayId: eConf.modelId,
    backupId: hConf?.modelId ?? null,
    everydayCommand: eConf.command,
    backupCommand: hConf?.command ?? null,
    envVars,
    instructions,
  };
}
