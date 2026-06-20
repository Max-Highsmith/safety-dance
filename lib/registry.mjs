/* ===================================================================
   Safety Dance — Model Capability Registry
   Pre-populated capabilities for known AI models.
   =================================================================== */

import { validateCapability } from './validate.mjs';
import { getOpenRouterCapability, listOpenRouterModels } from './openrouter.mjs';

const REGISTRY = {
  'anthropic/claude-opus-4-6': {
    manifest_version: '0.1.0',
    model_id: 'claude-opus-4-6',
    provider: 'anthropic',
    api_format: 'anthropic',
    interaction: {
      patterns: ['single_turn', 'multi_turn', 'agentic'],
      timings: ['untimed', 'turn_based', 'realtime'],
    },
    input: { modalities: ['text', 'image'], system_prompt: true },
    output: { modalities: ['text', 'tool_use', 'structured_json'] },
    resources: {
      context_window_tokens: 200000,
      max_output_tokens: 32000,
      max_tool_count: 128,
    },
  },

  'anthropic/claude-sonnet-4-5-20250929': {
    manifest_version: '0.1.0',
    model_id: 'claude-sonnet-4-5-20250929',
    provider: 'anthropic',
    api_format: 'anthropic',
    interaction: {
      patterns: ['single_turn', 'multi_turn', 'agentic'],
      timings: ['untimed', 'turn_based', 'realtime'],
    },
    input: { modalities: ['text', 'image'], system_prompt: true },
    output: { modalities: ['text', 'tool_use', 'structured_json'] },
    resources: {
      context_window_tokens: 200000,
      max_output_tokens: 16000,
      max_tool_count: 128,
    },
  },

  'openai/gpt-4o': {
    manifest_version: '0.1.0',
    model_id: 'gpt-4o',
    provider: 'openai',
    api_format: 'openai',
    interaction: {
      patterns: ['single_turn', 'multi_turn', 'agentic'],
      timings: ['untimed', 'turn_based', 'realtime'],
    },
    input: { modalities: ['text', 'image', 'audio'], system_prompt: true },
    output: { modalities: ['text', 'tool_use', 'structured_json'] },
    resources: {
      context_window_tokens: 128000,
      max_output_tokens: 16384,
      max_tool_count: 128,
    },
  },

  'openai/gpt-4.1': {
    manifest_version: '0.1.0',
    model_id: 'gpt-4.1',
    provider: 'openai',
    api_format: 'openai',
    interaction: {
      patterns: ['single_turn', 'multi_turn', 'agentic'],
      timings: ['untimed', 'turn_based', 'realtime'],
    },
    input: { modalities: ['text', 'image'], system_prompt: true },
    output: { modalities: ['text', 'tool_use', 'structured_json'] },
    resources: {
      context_window_tokens: 1047576,
      max_output_tokens: 32768,
      max_tool_count: 128,
    },
  },

  'google/gemini-2.5-pro': {
    manifest_version: '0.1.0',
    model_id: 'gemini-2.5-pro',
    provider: 'google',
    api_format: 'gemini',
    interaction: {
      patterns: ['single_turn', 'multi_turn', 'agentic'],
      timings: ['untimed', 'turn_based', 'realtime'],
    },
    input: { modalities: ['text', 'image', 'audio', 'video'], system_prompt: true },
    output: { modalities: ['text', 'tool_use', 'structured_json'] },
    resources: {
      context_window_tokens: 1048576,
      max_output_tokens: 65536,
      max_tool_count: 128,
    },
  },

  'xai/grok-4': {
    manifest_version: '0.1.0',
    model_id: 'grok-4',
    provider: 'xai',
    api_format: 'openai_compatible',
    interaction: {
      patterns: ['single_turn', 'multi_turn', 'agentic'],
      timings: ['untimed', 'turn_based', 'realtime'],
    },
    input: { modalities: ['text', 'image'], system_prompt: true },
    output: { modalities: ['text', 'tool_use', 'structured_json'] },
    resources: {
      context_window_tokens: 131072,
      max_output_tokens: 16384,
      max_tool_count: 128,
    },
  },

  'baseline/always-hold': {
    manifest_version: '0.1.0',
    model_id: 'always-hold',
    provider: 'baseline',
    api_format: 'none',
    interaction: {
      patterns: ['single_turn', 'multi_turn'],
      timings: ['untimed', 'turn_based', 'realtime'],
    },
    input: { modalities: ['text'], system_prompt: false },
    output: { modalities: ['text'] },
    resources: {
      context_window_tokens: 999999,
      max_output_tokens: 512,
      max_tool_count: 0,
    },
  },

  'baseline/always-launch': {
    manifest_version: '0.1.0',
    model_id: 'always-launch',
    provider: 'baseline',
    api_format: 'none',
    interaction: {
      patterns: ['single_turn', 'multi_turn'],
      timings: ['untimed', 'turn_based', 'realtime'],
    },
    input: { modalities: ['text'], system_prompt: false },
    output: { modalities: ['text'] },
    resources: {
      context_window_tokens: 999999,
      max_output_tokens: 512,
      max_tool_count: 0,
    },
  },
};

/**
 * Look up a model capability from the registry.
 * Tries exact key, then exact model_id, then a unique prefix alias.
 *
 * @param {string} provider - e.g. 'anthropic'
 * @param {string} modelId  - e.g. 'claude-opus-4-6'
 * @returns {Object|null} ModelCapability or null if unknown/ambiguous
 */
export function getModelCapability(provider, modelId) {
  const providerKey = `${provider}`;
  const exactKey = `${providerKey}/${modelId}`;
  if (REGISTRY[exactKey]) return clone(REGISTRY[exactKey]);

  const providerEntries = Object.entries(REGISTRY)
    .filter(([key, value]) => key.startsWith(`${providerKey}/`) && value.provider === providerKey);

  const exactModelMatch = providerEntries.find(([, value]) => value.model_id === modelId);
  if (exactModelMatch) return clone(exactModelMatch[1]);

  const prefixMatches = providerEntries.filter(([key, value]) =>
    key === `${providerKey}/${modelId}`
    || key.startsWith(`${providerKey}/${modelId}-`)
    || value.model_id.startsWith(`${modelId}-`)
    || value.model_id.startsWith(modelId),
  );

  if (prefixMatches.length === 1) {
    return clone(prefixMatches[0][1]);
  }

  return null;
}

/**
 * List all registered model keys.
 * @returns {string[]}
 */
export function listModels() {
  return Object.keys(REGISTRY).sort();
}

/**
 * Register a custom model capability.
 * @param {string} key        - "provider/model_id"
 * @param {Object} capability - ModelCapability object
 */
export function registerModel(key, capability) {
  if (typeof key !== 'string' || !/^[a-z0-9][a-z0-9_-]*\/[a-z0-9][a-z0-9._-]*$/i.test(key)) {
    throw new Error('registerModel: key must be in "provider/model_id" format');
  }

  const [provider, modelId] = key.split('/');
  const validation = validateCapability(capability);
  if (!validation.valid) {
    throw new Error(`registerModel: invalid capability: ${validation.errors.join(', ')}`);
  }

  if (capability.provider !== provider) {
    throw new Error(`registerModel: capability.provider must match key provider "${provider}"`);
  }
  if (capability.model_id !== modelId) {
    throw new Error(`registerModel: capability.model_id must match key model_id "${modelId}"`);
  }

  REGISTRY[key] = clone(capability);
}

/**
 * Async model lookup — checks local registry first, then falls back to OpenRouter.
 *
 * @param {string} provider - e.g. 'anthropic'
 * @param {string} modelId  - e.g. 'claude-opus-4-6'
 * @returns {Promise<Object|null>} ModelCapability or null
 */
export async function getModelCapabilityAsync(provider, modelId) {
  const local = getModelCapability(provider, modelId);
  if (local) return local;

  return getOpenRouterCapability(provider, modelId);
}

/**
 * List all registered model keys plus all OpenRouter models.
 * @returns {Promise<string[]>}
 */
export async function listModelsAsync() {
  const local = listModels();
  let remote = [];
  try {
    remote = await listOpenRouterModels();
  } catch {
    // OpenRouter unavailable — return local only
  }
  const merged = new Set([...local, ...remote]);
  return [...merged].sort();
}

function clone(value) {
  return structuredClone(value);
}
