/* ===================================================================
   Safety Dance — OpenRouter Integration
   Fetches model metadata from the OpenRouter API and converts it
   to Safety Dance ModelCapability format. Enables compatibility
   checks against any model available on OpenRouter.
   =================================================================== */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/models';

// Cache: { timestamp, models Map<id, capability> }
let cache = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Modality mapping — OpenRouter terms → Safety Dance taxonomy
// ---------------------------------------------------------------------------

const INPUT_MODALITY_MAP = {
  text: 'text',
  image: 'image',
  audio: 'audio',
  video: 'video',
  file: 'pdf',          // OpenRouter "file" maps closest to pdf
};

const OUTPUT_MODALITY_MAP = {
  text: 'text',
  image: 'image',
  audio: 'audio',
};

/**
 * Map OpenRouter supported_parameters to additional output modalities.
 */
function inferOutputModalities(supportedParams) {
  const extras = [];
  if (!supportedParams) return extras;

  if (supportedParams.includes('tools') || supportedParams.includes('tool_choice')) {
    extras.push('tool_use');
  }
  if (
    supportedParams.includes('response_format') ||
    supportedParams.includes('structured_outputs')
  ) {
    extras.push('structured_json');
  }
  return extras;
}

/**
 * Infer interaction patterns from model metadata.
 * Most chat models support single_turn and multi_turn.
 * Models with tool_use also support agentic.
 */
function inferInteractionPatterns(supportedParams) {
  const patterns = ['single_turn', 'multi_turn'];
  if (
    supportedParams &&
    (supportedParams.includes('tools') || supportedParams.includes('tool_choice'))
  ) {
    patterns.push('agentic');
  }
  return patterns;
}

/**
 * Determine the api_format based on the original provider.
 */
function inferApiFormat(provider) {
  switch (provider) {
    case 'anthropic':
      return 'anthropic';
    case 'openai':
      return 'openai';
    case 'google':
      return 'gemini';
    default:
      return 'openai_compatible';
  }
}

// ---------------------------------------------------------------------------
// Core conversion
// ---------------------------------------------------------------------------

/**
 * Convert an OpenRouter model object to a Safety Dance ModelCapability.
 *
 * @param {Object} orModel - Raw model object from OpenRouter API
 * @returns {Object} Safety Dance ModelCapability
 */
export function openRouterToCapability(orModel) {
  const [provider, ...rest] = orModel.id.split('/');
  const modelId = rest.join('/'); // handle ids like "openai/gpt-4o-2024-08-06"

  // Input modalities
  const inputModalities = (orModel.architecture?.input_modalities || ['text'])
    .map((m) => INPUT_MODALITY_MAP[m])
    .filter(Boolean);
  if (!inputModalities.includes('text')) {
    inputModalities.unshift('text');
  }

  // Output modalities
  const outputModalities = (orModel.architecture?.output_modalities || ['text'])
    .map((m) => OUTPUT_MODALITY_MAP[m])
    .filter(Boolean);
  if (!outputModalities.includes('text')) {
    outputModalities.unshift('text');
  }

  // Infer extras from supported_parameters
  const extras = inferOutputModalities(orModel.supported_parameters);
  for (const mod of extras) {
    if (!outputModalities.includes(mod)) {
      outputModalities.push(mod);
    }
  }

  const patterns = inferInteractionPatterns(orModel.supported_parameters);

  const capability = {
    manifest_version: '0.1.0',
    model_id: modelId,
    provider,
    api_format: inferApiFormat(provider),
    interaction: {
      patterns,
      timings: ['untimed', 'turn_based'],
    },
    input: {
      modalities: inputModalities,
      system_prompt: true,
    },
    output: {
      modalities: outputModalities,
    },
    resources: {
      context_window_tokens: orModel.context_length || 4096,
      max_output_tokens: orModel.top_provider?.max_completion_tokens || 4096,
      max_tool_count: patterns.includes('agentic') ? 128 : 0,
    },
  };

  return capability;
}

// ---------------------------------------------------------------------------
// Fetching & caching
// ---------------------------------------------------------------------------

/**
 * Fetch all models from the OpenRouter API.
 * Results are cached for 5 minutes.
 *
 * @param {Object} [options]
 * @param {boolean} [options.force] - bypass cache
 * @returns {Promise<Map<string, Object>>} Map of model id → ModelCapability
 */
export async function fetchOpenRouterModels({ force = false } = {}) {
  if (!force && cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return cache.models;
  }

  const response = await fetch(OPENROUTER_API_URL);
  if (!response.ok) {
    throw new Error(`OpenRouter API returned ${response.status}: ${response.statusText}`);
  }

  const json = await response.json();
  const models = new Map();

  for (const orModel of json.data || []) {
    if (!orModel.id) continue;
    try {
      models.set(orModel.id, openRouterToCapability(orModel));
    } catch {
      // skip models that fail to convert
    }
  }

  cache = { timestamp: Date.now(), models };
  return models;
}

/**
 * Look up a single model from OpenRouter.
 *
 * @param {string} provider - e.g. 'anthropic'
 * @param {string} modelId  - e.g. 'claude-opus-4-6'
 * @returns {Promise<Object|null>} ModelCapability or null
 */
export async function getOpenRouterCapability(provider, modelId) {
  const models = await fetchOpenRouterModels();
  const key = `${provider}/${modelId}`;

  // Exact match
  if (models.has(key)) {
    return structuredClone(models.get(key));
  }

  // Prefix match — find models that start with the key
  const prefixMatches = [];
  for (const [id, cap] of models) {
    if (id === key || id.startsWith(`${key}-`) || id.startsWith(`${key}:`)) {
      prefixMatches.push(cap);
    }
  }
  if (prefixMatches.length === 1) {
    return structuredClone(prefixMatches[0]);
  }

  return null;
}

/**
 * List all model IDs available on OpenRouter.
 *
 * @returns {Promise<string[]>} sorted list of model keys
 */
export async function listOpenRouterModels() {
  const models = await fetchOpenRouterModels();
  return [...models.keys()].sort();
}

/**
 * Clear the cached model data.
 */
export function clearOpenRouterCache() {
  cache = null;
}
