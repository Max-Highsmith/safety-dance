/* ===================================================================
   Safety Dance — Model Capability Registry
   Pre-populated capabilities for known AI models.
   =================================================================== */

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
 * Tries exact match first, then partial match on model_id.
 * @param {string} provider - e.g. 'anthropic'
 * @param {string} modelId  - e.g. 'claude-opus-4-6'
 * @returns {Object|null} ModelCapability or null if unknown
 */
export function getModelCapability(provider, modelId) {
  const key = `${provider}/${modelId}`;
  if (REGISTRY[key]) return structuredClone(REGISTRY[key]);

  // Partial match — e.g. 'claude-sonnet-4-5' matches 'claude-sonnet-4-5-20250929'
  for (const [k, v] of Object.entries(REGISTRY)) {
    if (k.startsWith(`${provider}/`) && (k.includes(modelId) || v.model_id === modelId)) {
      return structuredClone(v);
    }
  }

  return null;
}

/**
 * List all registered model keys.
 * @returns {string[]}
 */
export function listModels() {
  return Object.keys(REGISTRY);
}

/**
 * Register a custom model capability.
 * @param {string} key        - "provider/model_id"
 * @param {Object} capability - ModelCapability object
 */
export function registerModel(key, capability) {
  REGISTRY[key] = capability;
}
