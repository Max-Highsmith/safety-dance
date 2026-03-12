import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { taskToManifest, allTasksToManifests } from '../adapters/inspect.mjs';
import { validateManifest } from '../lib/validate.mjs';
import { checkCompatibility, getModelCapability } from '../index.mjs';

// ═══════════════════════════════════════════════════════
// ADAPTER: taskToManifest
// ═══════════════════════════════════════════════════════

describe('inspect adapter — taskToManifest', () => {
  it('converts a simple single-turn task', () => {
    const descriptor = {
      name: 'arc_challenge',
      display_name: 'ARC Challenge',
      description: 'AI2 Reasoning Challenge — multiple choice science questions',
      solver: { type: 'generate' },
      scorer: { type: 'choice' },
      dataset: { modalities: ['text'], sample_count: 1172 },
    };

    const manifest = taskToManifest(descriptor);
    assert.equal(manifest.id, 'inspect/arc_challenge');
    assert.equal(manifest.source, 'inspect');
    assert.equal(manifest.interaction.pattern, 'single_turn');
    assert.deepEqual(manifest.input.modalities, ['text']);
    assert.deepEqual(manifest.output.modalities, ['text']);
    assert.equal(manifest.measurement.type, 'binary');

    const validation = validateManifest(manifest);
    assert.equal(validation.valid, true, `Validation errors: ${validation.errors.join(', ')}`);
  });

  it('converts an agentic task with tools and sandbox', () => {
    const descriptor = {
      name: 'gaia',
      display_name: 'GAIA Benchmark',
      description: 'General AI Assistants benchmark with real-world tasks',
      solver: {
        type: 'basic_agent',
        tools: ['bash', 'python', 'web_browser'],
        has_system_message: true,
      },
      scorer: { type: 'model_graded_fact' },
      dataset: { modalities: ['text'] },
      sandbox: 'docker',
      message_limit: 100,
      config: { max_tokens: 4096 },
    };

    const manifest = taskToManifest(descriptor);
    assert.equal(manifest.interaction.pattern, 'agentic');
    assert.equal(manifest.interaction.max_turns, 100);
    assert.ok(manifest.output.modalities.includes('tool_use'));
    assert.ok(manifest.output.modalities.includes('code_execution'));
    assert.equal(manifest.input.system_prompt, true);
    assert.equal(manifest.resources.tool_count, 3);
    assert.equal(manifest.resources.min_output_tokens, 4096);
    assert.equal(manifest.measurement.type, 'rubric');
    assert.equal(manifest.metadata.inspect_sandbox, 'docker');

    const validation = validateManifest(manifest);
    assert.equal(validation.valid, true, `Validation errors: ${validation.errors.join(', ')}`);
  });

  it('converts a multi-turn task with tools (not agentic)', () => {
    const descriptor = {
      name: 'tool-use-eval',
      description: 'Evaluates tool use capability',
      solver: {
        type: 'custom',
        tools: ['bash', 'python'],
      },
      scorer: { type: 'exact' },
      message_limit: 10,
    };

    const manifest = taskToManifest(descriptor);
    assert.equal(manifest.interaction.pattern, 'multi_turn');
    assert.ok(manifest.output.modalities.includes('tool_use'));

    const validation = validateManifest(manifest);
    assert.equal(validation.valid, true, `Validation errors: ${validation.errors.join(', ')}`);
  });

  it('detects multimodal input from dataset', () => {
    const descriptor = {
      name: 'mmmu',
      description: 'Multimodal understanding benchmark',
      solver: { type: 'generate' },
      scorer: { type: 'choice' },
      dataset: { modalities: ['text', 'image'] },
    };

    const manifest = taskToManifest(descriptor);
    assert.deepEqual(manifest.input.modalities, ['text', 'image']);

    const validation = validateManifest(manifest);
    assert.equal(validation.valid, true, `Validation errors: ${validation.errors.join(', ')}`);
  });

  it('maps scorer types to measurement types', () => {
    const cases = [
      { scorer: 'choice', expected: 'binary' },
      { scorer: 'match', expected: 'binary' },
      { scorer: 'f1', expected: 'scalar' },
      { scorer: 'model_graded_qa', expected: 'rubric' },
    ];

    for (const { scorer, expected } of cases) {
      const descriptor = {
        name: `test-${scorer}`,
        solver: { type: 'generate' },
        scorer: { type: scorer },
      };
      const manifest = taskToManifest(descriptor);
      assert.equal(manifest.measurement.type, expected, `${scorer} should map to ${expected}`);
    }
  });

  it('converts time_limit seconds to time_limit_ms', () => {
    const descriptor = {
      name: 'timed-task',
      solver: { type: 'generate' },
      scorer: { type: 'exact' },
      time_limit: 300,
    };

    const manifest = taskToManifest(descriptor);
    assert.equal(manifest.interaction.time_limit_ms, 300000);
  });

  it('infers safety domains from name and description', () => {
    const descriptor = {
      name: 'cybersecurity-ctf',
      description: 'Evaluates ability to find and exploit vulnerabilities',
      solver: { type: 'basic_agent', tools: ['bash'] },
      scorer: { type: 'exact' },
      tags: ['security', 'cyber'],
    };

    const manifest = taskToManifest(descriptor);
    assert.ok(manifest.safety.domain.includes('cyber_operations'));
  });

  it('reads explicit safety_dance metadata', () => {
    const descriptor = {
      name: 'custom-safety',
      description: 'A custom safety eval',
      solver: { type: 'generate' },
      scorer: { type: 'model_graded_qa' },
      metadata: {
        safety_dance: {
          safety_domain: ['deception', 'civilian_harm'],
        },
      },
    };

    const manifest = taskToManifest(descriptor);
    assert.ok(manifest.safety.domain.includes('deception'));
    assert.ok(manifest.safety.domain.includes('civilian_harm'));
  });

  it('preserves inspect-specific metadata', () => {
    const descriptor = {
      name: 'versioned-task',
      solver: { type: 'generate' },
      scorer: { type: 'exact' },
      version: 2,
      epochs: 5,
      tags: ['benchmark', 'v2'],
    };

    const manifest = taskToManifest(descriptor);
    assert.equal(manifest.metadata.inspect_version, 2);
    assert.equal(manifest.metadata.inspect_epochs, 5);
    assert.deepEqual(manifest.metadata.inspect_tags, ['benchmark', 'v2']);
  });
});

// ═══════════════════════════════════════════════════════
// COMPATIBILITY
// ═══════════════════════════════════════════════════════

describe('inspect adapter — compatibility', () => {
  it('agentic task blocks baseline models', () => {
    const descriptor = {
      name: 'gaia',
      solver: { type: 'basic_agent', tools: ['bash', 'python'] },
      scorer: { type: 'model_graded_fact' },
      message_limit: 100,
    };
    const manifest = taskToManifest(descriptor);

    const baseline = getModelCapability('baseline', 'always-hold');
    const result = checkCompatibility(manifest, baseline);
    assert.equal(result.compatible, false);
    assert.ok(result.blocking.some(b => b.includes('tool_use')));
  });

  it('agentic task is compatible with Claude', () => {
    const descriptor = {
      name: 'gaia',
      solver: { type: 'basic_agent', tools: ['bash', 'python'] },
      scorer: { type: 'model_graded_fact' },
      message_limit: 100,
    };
    const manifest = taskToManifest(descriptor);

    const claude = getModelCapability('anthropic', 'claude-opus-4-6');
    const result = checkCompatibility(manifest, claude);
    assert.equal(result.compatible, true);
  });

  it('simple task is compatible with all models', () => {
    const descriptor = {
      name: 'mmlu',
      solver: { type: 'generate' },
      scorer: { type: 'choice' },
    };
    const manifest = taskToManifest(descriptor);

    for (const [provider, modelId] of [
      ['anthropic', 'claude-opus-4-6'],
      ['openai', 'gpt-4o'],
      ['baseline', 'always-hold'],
    ]) {
      const cap = getModelCapability(provider, modelId);
      const result = checkCompatibility(manifest, cap);
      assert.equal(result.compatible, true, `${provider}/${modelId}: ${result.blocking.join(', ')}`);
    }
  });

  it('image task blocks text-only baseline', () => {
    const descriptor = {
      name: 'mmmu',
      solver: { type: 'generate' },
      scorer: { type: 'choice' },
      dataset: { modalities: ['text', 'image'] },
    };
    const manifest = taskToManifest(descriptor);

    const baseline = getModelCapability('baseline', 'always-hold');
    const result = checkCompatibility(manifest, baseline);
    assert.equal(result.compatible, false);
    assert.ok(result.blocking.some(b => b.includes('image')));
  });
});
