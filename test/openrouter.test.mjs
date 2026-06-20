import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  openRouterToCapability,
  clearOpenRouterCache,
} from '../lib/openrouter.mjs';
import { validateCapability } from '../lib/validate.mjs';
import { getModelCapabilityAsync, listModelsAsync } from '../lib/registry.mjs';

// ─── Helper: minimal OpenRouter model object ───
function makeOrModel(overrides = {}) {
  return {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Anthropic: Claude 3.5 Sonnet',
    context_length: 200000,
    architecture: {
      modality: 'text+image->text',
      input_modalities: ['text', 'image'],
      output_modalities: ['text'],
      tokenizer: 'Claude',
      instruct_type: null,
    },
    top_provider: {
      context_length: 200000,
      max_completion_tokens: 8192,
      is_moderated: false,
    },
    supported_parameters: [
      'max_tokens',
      'response_format',
      'stop',
      'tool_choice',
      'tools',
    ],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════
// openRouterToCapability
// ═══════════════════════════════════════════════════════

describe('openRouterToCapability', () => {
  it('converts a basic model correctly', () => {
    const cap = openRouterToCapability(makeOrModel());
    assert.equal(cap.model_id, 'claude-3.5-sonnet');
    assert.equal(cap.provider, 'anthropic');
    assert.equal(cap.api_format, 'anthropic');
    assert.equal(cap.manifest_version, '0.1.0');
  });

  it('produces a valid Safety Dance capability', () => {
    const cap = openRouterToCapability(makeOrModel());
    const result = validateCapability(cap);
    assert.equal(result.valid, true, `Validation errors: ${result.errors.join(', ')}`);
  });

  it('maps input modalities from architecture', () => {
    const cap = openRouterToCapability(
      makeOrModel({
        architecture: {
          modality: 'text+image+audio+video->text',
          input_modalities: ['text', 'image', 'audio', 'video'],
          output_modalities: ['text'],
        },
      }),
    );
    assert.ok(cap.input.modalities.includes('text'));
    assert.ok(cap.input.modalities.includes('image'));
    assert.ok(cap.input.modalities.includes('audio'));
    assert.ok(cap.input.modalities.includes('video'));
  });

  it('maps file input to pdf modality', () => {
    const cap = openRouterToCapability(
      makeOrModel({
        architecture: {
          modality: 'text+file->text',
          input_modalities: ['text', 'file'],
          output_modalities: ['text'],
        },
      }),
    );
    assert.ok(cap.input.modalities.includes('pdf'));
  });

  it('infers tool_use from supported_parameters', () => {
    const cap = openRouterToCapability(
      makeOrModel({
        supported_parameters: ['tools', 'tool_choice', 'max_tokens'],
      }),
    );
    assert.ok(cap.output.modalities.includes('tool_use'));
    assert.ok(cap.interaction.patterns.includes('agentic'));
  });

  it('infers structured_json from response_format', () => {
    const cap = openRouterToCapability(
      makeOrModel({
        supported_parameters: ['response_format', 'max_tokens'],
      }),
    );
    assert.ok(cap.output.modalities.includes('structured_json'));
  });

  it('infers structured_json from structured_outputs', () => {
    const cap = openRouterToCapability(
      makeOrModel({
        supported_parameters: ['structured_outputs'],
      }),
    );
    assert.ok(cap.output.modalities.includes('structured_json'));
  });

  it('does not add agentic without tool support', () => {
    const cap = openRouterToCapability(
      makeOrModel({
        supported_parameters: ['max_tokens', 'stop'],
      }),
    );
    assert.ok(!cap.interaction.patterns.includes('agentic'));
    assert.equal(cap.resources.max_tool_count, 0);
  });

  it('maps context_length and max_completion_tokens', () => {
    const cap = openRouterToCapability(
      makeOrModel({
        context_length: 1048576,
        top_provider: { max_completion_tokens: 65536, context_length: 1048576 },
      }),
    );
    assert.equal(cap.resources.context_window_tokens, 1048576);
    assert.equal(cap.resources.max_output_tokens, 65536);
  });

  it('defaults to 4096 when context_length is missing', () => {
    const cap = openRouterToCapability(
      makeOrModel({ context_length: undefined, top_provider: {} }),
    );
    assert.equal(cap.resources.context_window_tokens, 4096);
    assert.equal(cap.resources.max_output_tokens, 4096);
  });

  it('maps openai provider to openai api_format', () => {
    const cap = openRouterToCapability(makeOrModel({ id: 'openai/gpt-4o' }));
    assert.equal(cap.api_format, 'openai');
  });

  it('maps google provider to gemini api_format', () => {
    const cap = openRouterToCapability(makeOrModel({ id: 'google/gemini-2.5-pro' }));
    assert.equal(cap.api_format, 'gemini');
  });

  it('maps unknown provider to openai_compatible', () => {
    const cap = openRouterToCapability(makeOrModel({ id: 'mistralai/mistral-large' }));
    assert.equal(cap.api_format, 'openai_compatible');
  });

  it('ensures text is always in input modalities', () => {
    const cap = openRouterToCapability(
      makeOrModel({
        architecture: {
          modality: 'image->text',
          input_modalities: ['image'],
          output_modalities: ['text'],
        },
      }),
    );
    assert.ok(cap.input.modalities.includes('text'));
  });

  it('handles model ids with nested slashes', () => {
    const cap = openRouterToCapability(makeOrModel({ id: 'huggingface/meta-llama/llama-3' }));
    assert.equal(cap.provider, 'huggingface');
    assert.equal(cap.model_id, 'meta-llama/llama-3');
  });
});

// ═══════════════════════════════════════════════════════
// Async registry fallback (unit tests with local registry only)
// ═══════════════════════════════════════════════════════

describe('getModelCapabilityAsync', () => {
  beforeEach(() => clearOpenRouterCache());

  it('returns local registry models without network', async () => {
    const cap = await getModelCapabilityAsync('anthropic', 'claude-opus-4-6');
    assert.ok(cap);
    assert.equal(cap.model_id, 'claude-opus-4-6');
    assert.equal(cap.provider, 'anthropic');
  });

  it('returns local registry models by prefix', async () => {
    const cap = await getModelCapabilityAsync('openai', 'gpt-4o');
    assert.ok(cap);
    assert.equal(cap.model_id, 'gpt-4o');
  });
});

describe('listModelsAsync', () => {
  beforeEach(() => clearOpenRouterCache());

  it('includes local models even when OpenRouter is unreachable', async () => {
    // listModelsAsync gracefully falls back to local-only on network failure
    const models = await listModelsAsync();
    assert.ok(models.length >= 8, 'should include at least the 8 hardcoded models');
    assert.ok(models.includes('anthropic/claude-opus-4-6'));
    assert.ok(models.includes('openai/gpt-4o'));
  });
});
