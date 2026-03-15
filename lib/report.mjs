/* ===================================================================
   Safety Dance — Evaluation Report Builder
   Assembles a standardized report from a benchmark manifest,
   model capability, compatibility check, run metadata, and results.
   =================================================================== */

import { checkCompatibility } from './compatibility.mjs';

/**
 * Build a complete evaluation report.
 *
 * @param {Object} opts
 * @param {Object} opts.manifest       - BenchmarkManifest used for evaluation
 * @param {Object} opts.capability     - ModelCapability used for evaluation
 * @param {Object} [opts.compatibility] - Pre-computed compatibility result; auto-derived if omitted
 * @param {Object} opts.run            - Execution metadata ({ runner, samples, duration_ms, config, ... })
 * @param {Object} opts.results        - Outcome data ({ measurement_type, passed, primary_score, samples, aggregation })
 * @param {Object} [opts.metadata]     - Arbitrary metadata
 * @param {string} [opts.id]           - Report ID; auto-generated if omitted
 * @param {string} [opts.timestamp]    - ISO 8601 timestamp; defaults to now
 * @returns {Object} EvaluationReport conforming to the schema
 */
export function buildReport({ manifest, capability, compatibility, run, results, metadata, id, timestamp }) {
  if (!manifest) throw new Error('buildReport: manifest is required');
  if (!capability) throw new Error('buildReport: capability is required');
  if (!run) throw new Error('buildReport: run is required');
  if (!results) throw new Error('buildReport: results is required');
  if (!results.measurement_type) throw new Error('buildReport: results.measurement_type is required');
  if (!run.runner) throw new Error('buildReport: run.runner is required');

  const ts = timestamp || new Date().toISOString();
  const reportId = id || `${manifest.id || 'unknown'}:${capability.model_id || 'unknown'}:${ts}`;

  // Auto-derive compatibility if not provided
  const compat = compatibility || checkCompatibility(manifest, capability);

  // Auto-compute aggregation from samples if samples exist but aggregation is missing
  const finalResults = { ...results };
  if (finalResults.samples && finalResults.samples.length > 0 && !finalResults.aggregation) {
    finalResults.aggregation = computeAggregation(finalResults.samples, finalResults.measurement_type);
  }

  return {
    report_version: '0.1.0',
    id: reportId,
    timestamp: ts,
    manifest,
    capability,
    compatibility: {
      compatible: compat.compatible,
      blocking: compat.blocking || [],
      warnings: compat.warnings || [],
      info: compat.info || [],
    },
    run,
    results: finalResults,
    ...(metadata != null ? { metadata } : {}),
  };
}

/**
 * Compute aggregation statistics from an array of sample results.
 *
 * @param {Object[]} samples - Array of { sample_id, outcome, score, details }
 * @param {string} measurementType - 'binary' | 'categorical' | 'scalar' | 'rubric'
 * @returns {Object} Aggregation object with count, mean, median, std_dev, min, max, pass_rate
 */
export function computeAggregation(samples, measurementType) {
  const count = samples.length;
  if (count === 0) {
    return { count: 0, mean: null, median: null, std_dev: null, min: null, max: null, pass_rate: null };
  }

  const aggregation = { count, mean: null, median: null, std_dev: null, min: null, max: null, pass_rate: null };

  // Binary: compute pass_rate from outcomes
  if (measurementType === 'binary') {
    const passed = samples.filter(s => s.outcome === true || s.outcome === 'pass').length;
    aggregation.pass_rate = passed / count;
  }

  // Numeric aggregation from score fields (works for scalar, rubric, and binary with scores)
  const scores = samples.map(s => s.score).filter(s => typeof s === 'number');
  if (scores.length > 0) {
    const sorted = [...scores].sort((a, b) => a - b);
    const sum = scores.reduce((a, b) => a + b, 0);
    aggregation.mean = sum / scores.length;
    aggregation.min = sorted[0];
    aggregation.max = sorted[sorted.length - 1];

    // Median
    const mid = Math.floor(sorted.length / 2);
    aggregation.median = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];

    // Standard deviation (population)
    const variance = scores.reduce((acc, s) => acc + (s - aggregation.mean) ** 2, 0) / scores.length;
    aggregation.std_dev = Math.sqrt(variance);
  }

  return aggregation;
}
