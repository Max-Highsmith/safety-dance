import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkCompatibility } from '../lib/compatibility.mjs';
import { validateManifest, validateCapability } from '../lib/validate.mjs';
import { getModelCapability, listModels } from '../lib/registry.mjs';

// ─── Helper: minimal valid manifest ───
function makeManifest(overrides = {}) {
  return {
    manifest_version: '0.1.0',
    id: 'test-scenario',
    interaction: { pattern: 'multi_turn', timing: 'turn_based', max_turns: 8 },
    input: { modalities: ['text'], system_prompt: true },
    output: { modalities: ['text'] },
    resources: { min_context_tokens: 8000, min_output_tokens: 128 },
    ...overrides,
  };
}

// ─── Helper: minimal valid capability ───
function makeCapability(overrides = {}) {
  return {
    manifest_version: '0.1.0',
    model_id: 'test-model',
    provider: 'test',
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
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════

describe('validateManifest', () => {
  it('accepts a valid manifest', () => {
    const result = validateManifest(makeManifest());
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it('rejects missing required fields', () => {
    const result = validateManifest({});
    assert.equal(result.valid, false);
    assert.ok(result.errors.length >= 4);
  });

  it('rejects invalid interaction pattern', () => {
    const result = validateManifest(makeManifest({
      interaction: { pattern: 'batch_mode' },
    }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('interaction.pattern')));
  });

  it('rejects invalid input modality', () => {
    const result = validateManifest(makeManifest({
      input: { modalities: ['text', 'hologram'] },
    }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('hologram')));
  });

  it('rejects invalid output modality', () => {
    const result = validateManifest(makeManifest({
      output: { modalities: ['telepathy'] },
    }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('telepathy')));
  });

  it('rejects non-object input', () => {
    const result = validateManifest('not an object');
    assert.equal(result.valid, false);
  });
});

describe('validateCapability', () => {
  it('accepts a valid capability', () => {
    const result = validateCapability(makeCapability());
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it('rejects missing required fields', () => {
    const result = validateCapability({});
    assert.equal(result.valid, false);
    assert.ok(result.errors.length >= 5);
  });

  it('rejects invalid api_format', () => {
    const result = validateCapability(makeCapability({ api_format: 'soap' }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('api_format')));
  });
});

// ═══════════════════════════════════════════════════════
// COMPATIBILITY — FULL PASS
// ═══════════════════════════════════════════════════════

describe('checkCompatibility — passing cases', () => {
  it('text-only manifest vs full-capability model passes', () => {
    const result = checkCompatibility(makeManifest(), makeCapability());
    assert.equal(result.compatible, true);
    assert.equal(result.blocking.length, 0);
    assert.equal(result.breakdown.input_modalities, 'pass');
    assert.equal(result.breakdown.output_modalities, 'pass');
    assert.equal(result.breakdown.interaction_pattern, 'pass');
  });

  it('agentic manifest vs agentic-capable model passes', () => {
    const manifest = makeManifest({
      interaction: { pattern: 'agentic', timing: 'untimed', max_turns: 50 },
      output: { modalities: ['text', 'tool_use'] },
      resources: { min_context_tokens: 50000, tool_count: 8 },
    });
    const result = checkCompatibility(manifest, makeCapability());
    assert.equal(result.compatible, true);
    assert.equal(result.blocking.length, 0);
  });

  it('single_turn manifest vs multi_turn model passes (superset)', () => {
    const manifest = makeManifest({
      interaction: { pattern: 'single_turn' },
    });
    const cap = makeCapability({
      interaction: { patterns: ['multi_turn'], timings: ['untimed'] },
    });
    const result = checkCompatibility(manifest, cap);
    assert.equal(result.compatible, true);
    assert.ok(result.info.some(i => i.includes('superset')));
  });
});

// ═══════════════════════════════════════════════════════
// COMPATIBILITY — BLOCKING
// ═══════════════════════════════════════════════════════

describe('checkCompatibility — blocking cases', () => {
  it('blocks when model lacks required input modality', () => {
    const manifest = makeManifest({
      input: { modalities: ['text', 'audio'] },
    });
    const cap = makeCapability({
      input: { modalities: ['text', 'image'] },
    });
    const result = checkCompatibility(manifest, cap);
    assert.equal(result.compatible, false);
    assert.ok(result.blocking.some(b => b.includes('audio')));
  });

  it('blocks when agentic scenario needs tool_use but model lacks it', () => {
    const manifest = makeManifest({
      interaction: { pattern: 'agentic' },
      output: { modalities: ['text', 'tool_use'] },
    });
    const cap = makeCapability({
      output: { modalities: ['text'] },
    });
    const result = checkCompatibility(manifest, cap);
    assert.equal(result.compatible, false);
    assert.ok(result.blocking.some(b => b.includes('tool_use')));
  });

  it('blocks when model lacks required interaction pattern', () => {
    const manifest = makeManifest({
      interaction: { pattern: 'agentic' },
      output: { modalities: ['text', 'tool_use'] },
    });
    const cap = makeCapability({
      interaction: { patterns: ['single_turn'] },
    });
    const result = checkCompatibility(manifest, cap);
    assert.equal(result.compatible, false);
    assert.ok(result.blocking.some(b => b.includes('agentic')));
  });

  it('blocks when context window is too small', () => {
    const manifest = makeManifest({
      resources: { min_context_tokens: 500000 },
    });
    const cap = makeCapability({
      resources: { context_window_tokens: 128000 },
    });
    const result = checkCompatibility(manifest, cap);
    assert.equal(result.compatible, false);
    assert.ok(result.blocking.some(b => b.includes('context tokens')));
  });
});

// ═══════════════════════════════════════════════════════
// COMPATIBILITY — WARNINGS
// ═══════════════════════════════════════════════════════

describe('checkCompatibility — warning cases', () => {
  it('warns when non-agentic scenario needs tool_use but model lacks it', () => {
    const manifest = makeManifest({
      interaction: { pattern: 'multi_turn' },
      output: { modalities: ['text', 'tool_use'] },
    });
    const cap = makeCapability({
      output: { modalities: ['text'] },
    });
    const result = checkCompatibility(manifest, cap);
    assert.equal(result.compatible, true); // warning, not blocking
    assert.ok(result.warnings.some(w => w.includes('tool_use')));
  });

  it('warns when structured_json not supported', () => {
    const manifest = makeManifest({
      output: { modalities: ['text', 'structured_json'] },
    });
    const cap = makeCapability({
      output: { modalities: ['text'] },
    });
    const result = checkCompatibility(manifest, cap);
    assert.equal(result.compatible, true);
    assert.ok(result.warnings.some(w => w.includes('structured_json')));
  });

  it('warns when system prompt not supported', () => {
    const manifest = makeManifest({
      input: { modalities: ['text'], system_prompt: true },
    });
    const cap = makeCapability({
      input: { modalities: ['text'], system_prompt: false },
    });
    const result = checkCompatibility(manifest, cap);
    assert.equal(result.compatible, true);
    assert.ok(result.warnings.some(w => w.includes('system prompt')));
  });

  it('warns when context window has tight margin (>80%)', () => {
    const manifest = makeManifest({
      resources: { min_context_tokens: 170000 },
    });
    const cap = makeCapability({
      resources: { context_window_tokens: 200000 },
    });
    const result = checkCompatibility(manifest, cap);
    assert.equal(result.compatible, true);
    assert.ok(result.warnings.some(w => w.includes('tight margin')));
  });

  it('warns when output tokens insufficient', () => {
    const manifest = makeManifest({
      resources: { min_output_tokens: 50000 },
    });
    const cap = makeCapability({
      resources: { max_output_tokens: 32000 },
    });
    const result = checkCompatibility(manifest, cap);
    assert.equal(result.compatible, true);
    assert.ok(result.warnings.some(w => w.includes('output tokens')));
  });

  it('warns when tool count exceeds model limit', () => {
    const manifest = makeManifest({
      resources: { tool_count: 200 },
    });
    const cap = makeCapability({
      resources: { max_tool_count: 128 },
    });
    const result = checkCompatibility(manifest, cap);
    assert.equal(result.compatible, true);
    assert.ok(result.warnings.some(w => w.includes('tools')));
  });
});

// ═══════════════════════════════════════════════════════
// REGISTRY
// ═══════════════════════════════════════════════════════

describe('model registry', () => {
  it('lists known models', () => {
    const models = listModels();
    assert.ok(models.length >= 6);
    assert.ok(models.includes('anthropic/claude-opus-4-6'));
    assert.ok(models.includes('baseline/always-hold'));
  });

  it('retrieves model by exact key', () => {
    const cap = getModelCapability('anthropic', 'claude-opus-4-6');
    assert.ok(cap);
    assert.equal(cap.model_id, 'claude-opus-4-6');
    assert.equal(cap.provider, 'anthropic');
    assert.ok(cap.input.modalities.includes('text'));
  });

  it('retrieves model by partial match', () => {
    const cap = getModelCapability('anthropic', 'claude-sonnet-4-5');
    assert.ok(cap);
    assert.equal(cap.provider, 'anthropic');
  });

  it('returns null for unknown model', () => {
    const cap = getModelCapability('unknown', 'nonexistent');
    assert.equal(cap, null);
  });
});

// ═══════════════════════════════════════════════════════
// REAL-WORLD: baseline model vs agentic scenario
// ═══════════════════════════════════════════════════════

describe('real-world compatibility: baseline vs agentic', () => {
  it('baseline/always-hold is incompatible with agentic scenarios', () => {
    const agenticManifest = makeManifest({
      interaction: { pattern: 'agentic', timing: 'untimed', max_turns: 50 },
      output: { modalities: ['text', 'tool_use'] },
      resources: { min_context_tokens: 50000, tool_count: 8 },
    });
    const baseline = getModelCapability('baseline', 'always-hold');
    const result = checkCompatibility(agenticManifest, baseline);
    assert.equal(result.compatible, false);
    assert.ok(result.blocking.length > 0);
  });

  it('baseline/always-hold is compatible with text-only turn-based scenarios', () => {
    const turnBasedManifest = makeManifest({
      interaction: { pattern: 'multi_turn', timing: 'turn_based', max_turns: 8 },
      input: { modalities: ['text'] },
      output: { modalities: ['text'] },
      resources: { min_context_tokens: 8000 },
    });
    const baseline = getModelCapability('baseline', 'always-hold');
    const result = checkCompatibility(turnBasedManifest, baseline);
    assert.equal(result.compatible, true);
  });
});

// ═══════════════════════════════════════════════════════
// REAL-WORLD: audio scenario vs text-only model
// ═══════════════════════════════════════════════════════

describe('real-world compatibility: audio requirement', () => {
  it('audio+text benchmark is incompatible with text-only model', () => {
    const audioManifest = makeManifest({
      input: { modalities: ['text', 'audio'] },
    });
    const textOnly = makeCapability({
      input: { modalities: ['text'] },
    });
    const result = checkCompatibility(audioManifest, textOnly);
    assert.equal(result.compatible, false);
    assert.ok(result.blocking.some(b => b.includes('audio')));
  });

  it('audio+text benchmark is compatible with GPT-4o (supports audio)', () => {
    const audioManifest = makeManifest({
      input: { modalities: ['text', 'audio'] },
    });
    const gpt4o = getModelCapability('openai', 'gpt-4o');
    const result = checkCompatibility(audioManifest, gpt4o);
    assert.equal(result.compatible, true);
    assert.equal(result.blocking.length, 0);
  });

  it('audio+text benchmark is incompatible with Claude (no audio)', () => {
    const audioManifest = makeManifest({
      input: { modalities: ['text', 'audio'] },
    });
    const claude = getModelCapability('anthropic', 'claude-opus-4-6');
    const result = checkCompatibility(audioManifest, claude);
    assert.equal(result.compatible, false);
    assert.ok(result.blocking.some(b => b.includes('audio')));
  });

  it('video benchmark is only compatible with Gemini', () => {
    const videoManifest = makeManifest({
      input: { modalities: ['text', 'video'] },
    });
    const gemini = getModelCapability('google', 'gemini-2.5-pro');
    const claude = getModelCapability('anthropic', 'claude-opus-4-6');
    const gpt4o = getModelCapability('openai', 'gpt-4o');

    assert.equal(checkCompatibility(videoManifest, gemini).compatible, true);
    assert.equal(checkCompatibility(videoManifest, claude).compatible, false);
    assert.equal(checkCompatibility(videoManifest, gpt4o).compatible, false);
  });
});
