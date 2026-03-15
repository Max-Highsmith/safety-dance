import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, computeAggregation } from '../lib/report.mjs';
import { validateReport } from '../lib/validate.mjs';
import { checkCompatibility } from '../lib/compatibility.mjs';
import { getModelCapability } from '../lib/registry.mjs';

// ─── Helper: minimal valid manifest ───
function makeManifest(overrides = {}) {
  return {
    manifest_version: '0.1.0',
    id: 'test-benchmark/scenario-1',
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

// ─── Helper: minimal valid report ───
function makeReport(overrides = {}) {
  const manifest = makeManifest();
  const capability = makeCapability();
  return {
    report_version: '0.1.0',
    id: 'test-benchmark/scenario-1:test-model:2026-03-15T12:00:00Z',
    timestamp: '2026-03-15T12:00:00Z',
    manifest,
    capability,
    compatibility: {
      compatible: true,
      blocking: [],
      warnings: [],
      info: [],
    },
    run: {
      runner: 'test-runner@1.0.0',
      samples: 3,
      duration_ms: 5000,
    },
    results: {
      measurement_type: 'binary',
      passed: true,
      primary_score: 1.0,
      samples: [
        { sample_id: 's1', outcome: true, score: 1.0 },
        { sample_id: 's2', outcome: true, score: 1.0 },
        { sample_id: 's3', outcome: true, score: 1.0 },
      ],
      aggregation: {
        count: 3,
        mean: 1.0,
        median: 1.0,
        std_dev: 0,
        min: 1.0,
        max: 1.0,
        pass_rate: 1.0,
      },
    },
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════

describe('validateReport', () => {
  it('accepts a valid report', () => {
    const result = validateReport(makeReport());
    assert.equal(result.valid, true, `Validation errors: ${result.errors.join(', ')}`);
    assert.equal(result.errors.length, 0);
  });

  it('rejects non-object input', () => {
    const result = validateReport('not an object');
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('object')));
  });

  it('rejects missing required fields', () => {
    const result = validateReport({});
    assert.equal(result.valid, false);
    assert.ok(result.errors.length >= 7);
  });

  it('rejects unsupported report_version', () => {
    const result = validateReport(makeReport({ report_version: '99.0.0' }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('report_version')));
  });

  it('rejects invalid timestamp', () => {
    const result = validateReport(makeReport({ timestamp: 'not-a-date' }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('timestamp')));
  });

  it('rejects manifest without id', () => {
    const report = makeReport();
    delete report.manifest.id;
    const result = validateReport(report);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('manifest.id')));
  });

  it('rejects capability without model_id', () => {
    const report = makeReport();
    delete report.capability.model_id;
    const result = validateReport(report);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('capability.model_id')));
  });

  it('rejects capability without provider', () => {
    const report = makeReport();
    delete report.capability.provider;
    const result = validateReport(report);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('capability.provider')));
  });

  it('rejects non-boolean compatibility.compatible', () => {
    const result = validateReport(makeReport({
      compatibility: { compatible: 'yes', blocking: [], warnings: [] },
    }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('compatibility.compatible')));
  });

  it('rejects missing run.runner', () => {
    const result = validateReport(makeReport({ run: { samples: 1 } }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('run.runner')));
  });

  it('rejects invalid measurement_type', () => {
    const report = makeReport();
    report.results.measurement_type = 'vibes';
    const result = validateReport(report);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('measurement_type')));
  });

  it('rejects missing results.measurement_type', () => {
    const report = makeReport();
    delete report.results.measurement_type;
    const result = validateReport(report);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('measurement_type')));
  });

  it('rejects samples without sample_id', () => {
    const report = makeReport();
    report.results.samples = [{ outcome: true }];
    const result = validateReport(report);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('sample_id')));
  });

  it('rejects non-array samples', () => {
    const report = makeReport();
    report.results.samples = 'not-an-array';
    const result = validateReport(report);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('samples must be an array')));
  });
});

// ═══════════════════════════════════════════════════════
// buildReport
// ═══════════════════════════════════════════════════════

describe('buildReport', () => {
  it('builds a valid report from inputs', () => {
    const manifest = makeManifest();
    const capability = makeCapability();
    const report = buildReport({
      manifest,
      capability,
      run: { runner: 'test@1.0.0', samples: 1 },
      results: { measurement_type: 'binary', passed: true },
    });

    assert.equal(report.report_version, '0.1.0');
    assert.ok(report.id);
    assert.ok(report.timestamp);
    assert.equal(report.manifest.id, 'test-benchmark/scenario-1');
    assert.equal(report.capability.model_id, 'test-model');

    const validation = validateReport(report);
    assert.equal(validation.valid, true, `Validation errors: ${validation.errors.join(', ')}`);
  });

  it('auto-generates id from manifest + capability + timestamp', () => {
    const report = buildReport({
      manifest: makeManifest(),
      capability: makeCapability(),
      run: { runner: 'test@1.0.0' },
      results: { measurement_type: 'scalar' },
      timestamp: '2026-01-01T00:00:00Z',
    });
    assert.equal(report.id, 'test-benchmark/scenario-1:test-model:2026-01-01T00:00:00Z');
  });

  it('uses provided id when given', () => {
    const report = buildReport({
      manifest: makeManifest(),
      capability: makeCapability(),
      run: { runner: 'test@1.0.0' },
      results: { measurement_type: 'binary' },
      id: 'custom-id-123',
    });
    assert.equal(report.id, 'custom-id-123');
  });

  it('uses provided timestamp when given', () => {
    const report = buildReport({
      manifest: makeManifest(),
      capability: makeCapability(),
      run: { runner: 'test@1.0.0' },
      results: { measurement_type: 'binary' },
      timestamp: '2025-06-01T12:00:00Z',
    });
    assert.equal(report.timestamp, '2025-06-01T12:00:00Z');
  });

  it('auto-derives compatibility when not provided', () => {
    const manifest = makeManifest({ input: { modalities: ['text', 'audio'] } });
    const capability = makeCapability({ input: { modalities: ['text'] } });
    const report = buildReport({
      manifest,
      capability,
      run: { runner: 'test@1.0.0' },
      results: { measurement_type: 'binary' },
    });
    assert.equal(report.compatibility.compatible, false);
    assert.ok(report.compatibility.blocking.some(b => b.includes('audio')));
  });

  it('uses provided compatibility when given', () => {
    const compat = { compatible: true, blocking: [], warnings: ['test warning'], info: [] };
    const report = buildReport({
      manifest: makeManifest(),
      capability: makeCapability(),
      compatibility: compat,
      run: { runner: 'test@1.0.0' },
      results: { measurement_type: 'binary' },
    });
    assert.deepEqual(report.compatibility.warnings, ['test warning']);
  });

  it('auto-computes aggregation from samples when missing', () => {
    const report = buildReport({
      manifest: makeManifest(),
      capability: makeCapability(),
      run: { runner: 'test@1.0.0' },
      results: {
        measurement_type: 'binary',
        samples: [
          { sample_id: 's1', outcome: true, score: 1.0 },
          { sample_id: 's2', outcome: false, score: 0.0 },
          { sample_id: 's3', outcome: true, score: 1.0 },
        ],
      },
    });
    assert.ok(report.results.aggregation);
    assert.equal(report.results.aggregation.count, 3);
    assert.equal(report.results.aggregation.pass_rate, 2 / 3);
  });

  it('preserves existing aggregation when provided', () => {
    const report = buildReport({
      manifest: makeManifest(),
      capability: makeCapability(),
      run: { runner: 'test@1.0.0' },
      results: {
        measurement_type: 'scalar',
        samples: [{ sample_id: 's1', score: 0.5 }],
        aggregation: { count: 100, mean: 0.75, median: 0.8, std_dev: 0.1, min: 0.2, max: 1.0, pass_rate: null },
      },
    });
    assert.equal(report.results.aggregation.count, 100);
    assert.equal(report.results.aggregation.mean, 0.75);
  });

  it('includes metadata when provided', () => {
    const report = buildReport({
      manifest: makeManifest(),
      capability: makeCapability(),
      run: { runner: 'test@1.0.0' },
      results: { measurement_type: 'binary' },
      metadata: { experiment: 'ablation-1' },
    });
    assert.equal(report.metadata.experiment, 'ablation-1');
  });

  it('omits metadata key when not provided', () => {
    const report = buildReport({
      manifest: makeManifest(),
      capability: makeCapability(),
      run: { runner: 'test@1.0.0' },
      results: { measurement_type: 'binary' },
    });
    assert.equal('metadata' in report, false);
  });

  it('throws when manifest is missing', () => {
    assert.throws(() => buildReport({
      capability: makeCapability(),
      run: { runner: 'test@1.0.0' },
      results: { measurement_type: 'binary' },
    }), /manifest is required/);
  });

  it('throws when capability is missing', () => {
    assert.throws(() => buildReport({
      manifest: makeManifest(),
      run: { runner: 'test@1.0.0' },
      results: { measurement_type: 'binary' },
    }), /capability is required/);
  });

  it('throws when run is missing', () => {
    assert.throws(() => buildReport({
      manifest: makeManifest(),
      capability: makeCapability(),
      results: { measurement_type: 'binary' },
    }), /run is required/);
  });

  it('throws when results is missing', () => {
    assert.throws(() => buildReport({
      manifest: makeManifest(),
      capability: makeCapability(),
      run: { runner: 'test@1.0.0' },
    }), /results is required/);
  });

  it('throws when results.measurement_type is missing', () => {
    assert.throws(() => buildReport({
      manifest: makeManifest(),
      capability: makeCapability(),
      run: { runner: 'test@1.0.0' },
      results: { passed: true },
    }), /measurement_type is required/);
  });

  it('throws when run.runner is missing', () => {
    assert.throws(() => buildReport({
      manifest: makeManifest(),
      capability: makeCapability(),
      run: { samples: 1 },
      results: { measurement_type: 'binary' },
    }), /run\.runner is required/);
  });
});

// ═══════════════════════════════════════════════════════
// computeAggregation
// ═══════════════════════════════════════════════════════

describe('computeAggregation', () => {
  it('returns empty aggregation for no samples', () => {
    const agg = computeAggregation([], 'binary');
    assert.equal(agg.count, 0);
    assert.equal(agg.mean, null);
    assert.equal(agg.pass_rate, null);
  });

  it('computes pass_rate for binary samples', () => {
    const samples = [
      { sample_id: 's1', outcome: true, score: 1.0 },
      { sample_id: 's2', outcome: false, score: 0.0 },
      { sample_id: 's3', outcome: true, score: 1.0 },
      { sample_id: 's4', outcome: false, score: 0.0 },
    ];
    const agg = computeAggregation(samples, 'binary');
    assert.equal(agg.count, 4);
    assert.equal(agg.pass_rate, 0.5);
  });

  it('accepts "pass" string as truthy binary outcome', () => {
    const samples = [
      { sample_id: 's1', outcome: 'pass', score: 1.0 },
      { sample_id: 's2', outcome: false, score: 0.0 },
    ];
    const agg = computeAggregation(samples, 'binary');
    assert.equal(agg.pass_rate, 0.5);
  });

  it('computes scalar statistics', () => {
    const samples = [
      { sample_id: 's1', score: 0.2 },
      { sample_id: 's2', score: 0.4 },
      { sample_id: 's3', score: 0.6 },
      { sample_id: 's4', score: 0.8 },
    ];
    const agg = computeAggregation(samples, 'scalar');
    assert.equal(agg.count, 4);
    assert.equal(agg.mean, 0.5);
    assert.equal(agg.median, 0.5); // (0.4 + 0.6) / 2
    assert.equal(agg.min, 0.2);
    assert.equal(agg.max, 0.8);
    assert.equal(agg.pass_rate, null); // not binary
  });

  it('computes correct median for odd count', () => {
    const samples = [
      { sample_id: 's1', score: 0.1 },
      { sample_id: 's2', score: 0.5 },
      { sample_id: 's3', score: 0.9 },
    ];
    const agg = computeAggregation(samples, 'scalar');
    assert.equal(agg.median, 0.5);
  });

  it('computes std_dev correctly', () => {
    // All same score → std_dev = 0
    const samples = [
      { sample_id: 's1', score: 0.5 },
      { sample_id: 's2', score: 0.5 },
      { sample_id: 's3', score: 0.5 },
    ];
    const agg = computeAggregation(samples, 'scalar');
    assert.equal(agg.std_dev, 0);
  });

  it('ignores samples without numeric score for aggregation', () => {
    const samples = [
      { sample_id: 's1', outcome: 'category_a' },
      { sample_id: 's2', outcome: 'category_b', score: 0.8 },
    ];
    const agg = computeAggregation(samples, 'categorical');
    assert.equal(agg.count, 2);
    assert.equal(agg.mean, 0.8); // only one numeric score
    assert.equal(agg.median, 0.8);
  });
});

// ═══════════════════════════════════════════════════════
// INTEGRATION: real registry models
// ═══════════════════════════════════════════════════════

describe('integration: buildReport with real models', () => {
  it('builds a valid report for Claude vs text-only benchmark', () => {
    const manifest = makeManifest();
    const claude = getModelCapability('anthropic', 'claude-opus-4-6');
    const report = buildReport({
      manifest,
      capability: claude,
      run: { runner: 'panopticon@0.3.0', samples: 10, duration_ms: 120000 },
      results: {
        measurement_type: 'binary',
        passed: true,
        primary_score: 0.9,
        samples: [
          { sample_id: 'run-1', outcome: true, score: 1.0 },
          { sample_id: 'run-2', outcome: true, score: 1.0 },
          { sample_id: 'run-3', outcome: false, score: 0.0 },
          { sample_id: 'run-4', outcome: true, score: 1.0 },
          { sample_id: 'run-5', outcome: true, score: 1.0 },
          { sample_id: 'run-6', outcome: true, score: 1.0 },
          { sample_id: 'run-7', outcome: true, score: 1.0 },
          { sample_id: 'run-8', outcome: true, score: 1.0 },
          { sample_id: 'run-9', outcome: false, score: 0.0 },
          { sample_id: 'run-10', outcome: true, score: 1.0 },
        ],
      },
    });

    const validation = validateReport(report);
    assert.equal(validation.valid, true, `Validation errors: ${validation.errors.join(', ')}`);
    assert.equal(report.compatibility.compatible, true);
    assert.equal(report.results.aggregation.count, 10);
    assert.equal(report.results.aggregation.pass_rate, 0.8);
    assert.equal(report.results.aggregation.mean, 0.8);
  });

  it('builds a valid report for incompatible model (audio benchmark vs Claude)', () => {
    const manifest = makeManifest({
      id: 'audio-safety/speech-test',
      input: { modalities: ['text', 'audio'] },
    });
    const claude = getModelCapability('anthropic', 'claude-opus-4-6');
    const report = buildReport({
      manifest,
      capability: claude,
      run: { runner: 'audio-bench@0.1.0', samples: 0 },
      results: {
        measurement_type: 'binary',
        passed: null,
        primary_score: null,
      },
    });

    const validation = validateReport(report);
    assert.equal(validation.valid, true, `Validation errors: ${validation.errors.join(', ')}`);
    assert.equal(report.compatibility.compatible, false);
    assert.ok(report.compatibility.blocking.some(b => b.includes('audio')));
  });
});
