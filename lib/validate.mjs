/* ===================================================================
   Safety Dance — Lightweight Schema Validation
   Checks required fields, types, and enum constraints.
   Uses the shared taxonomy for all vocabulary terms.
   =================================================================== */

import {
  INPUT_MODALITY_IDS,
  OUTPUT_MODALITY_IDS,
  INTERACTION_PATTERN_IDS,
  TIMING_MODE_IDS,
  SAFETY_DOMAIN_IDS,
  MEASUREMENT_TYPE_IDS,
  API_FORMAT_IDS,
} from './taxonomy.mjs';

const MANIFEST_REQUIRED = ['manifest_version', 'id', 'interaction', 'input', 'output'];
const CAPABILITY_REQUIRED = ['manifest_version', 'model_id', 'provider', 'interaction', 'input', 'output'];
const REPORT_REQUIRED = ['report_version', 'id', 'timestamp', 'manifest', 'capability', 'compatibility', 'run', 'results'];

/**
 * Validate a benchmark manifest.
 * @param {Object} manifest
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateManifest(manifest) {
  const errors = [];

  if (!isPlainObject(manifest)) {
    return { valid: false, errors: ['Manifest must be an object'] };
  }

  for (const field of MANIFEST_REQUIRED) {
    if (manifest[field] == null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (manifest.manifest_version && manifest.manifest_version !== '0.1.0') {
    errors.push(`Unsupported manifest_version: ${manifest.manifest_version} (expected 0.1.0)`);
  }

  if (manifest.id != null) {
    if (typeof manifest.id !== 'string') {
      errors.push('id must be a string');
    } else if (!/^[a-z0-9][a-z0-9_/-]*$/.test(manifest.id)) {
      errors.push(`Invalid id format: ${manifest.id} (must be lowercase alphanumeric with hyphens/underscores/slashes)`);
    }
  }

  if (manifest.label != null && typeof manifest.label !== 'string') {
    errors.push('label must be a string');
  }
  if (manifest.description != null && typeof manifest.description !== 'string') {
    errors.push('description must be a string');
  }
  if (manifest.source != null && typeof manifest.source !== 'string') {
    errors.push('source must be a string');
  }

  if (manifest.interaction != null) {
    if (!isPlainObject(manifest.interaction)) {
      errors.push('interaction must be an object');
    } else {
      if (!manifest.interaction.pattern) {
        errors.push('interaction.pattern is required');
      } else if (!INTERACTION_PATTERN_IDS.includes(manifest.interaction.pattern)) {
        errors.push(`Invalid interaction.pattern: ${manifest.interaction.pattern} (must be one of: ${INTERACTION_PATTERN_IDS.join(', ')})`);
      }
      if (manifest.interaction.timing != null && !TIMING_MODE_IDS.includes(manifest.interaction.timing)) {
        errors.push(`Invalid interaction.timing: ${manifest.interaction.timing} (must be one of: ${TIMING_MODE_IDS.join(', ')})`);
      }
      validateIntegerField(manifest.interaction.max_turns, 'interaction.max_turns', errors, { min: 1 });
      validateIntegerField(manifest.interaction.time_limit_ms, 'interaction.time_limit_ms', errors, { min: 0 });
      validateIntegerField(manifest.interaction.tick_count, 'interaction.tick_count', errors, { min: 1 });
      validateIntegerField(manifest.interaction.tick_interval_ms, 'interaction.tick_interval_ms', errors, { min: 0 });
    }
  }

  if (manifest.input != null) {
    if (!isPlainObject(manifest.input)) {
      errors.push('input must be an object');
    } else {
      validateEnumArray(manifest.input.modalities, 'input.modalities', INPUT_MODALITY_IDS, errors);
      validateBooleanField(manifest.input.system_prompt, 'input.system_prompt', errors);
    }
  }

  if (manifest.output != null) {
    if (!isPlainObject(manifest.output)) {
      errors.push('output must be an object');
    } else {
      validateEnumArray(manifest.output.modalities, 'output.modalities', OUTPUT_MODALITY_IDS, errors);
      if (manifest.output.structured_format != null && typeof manifest.output.structured_format !== 'string') {
        errors.push('output.structured_format must be a string');
      }
    }
  }

  if (manifest.resources != null) {
    if (!isPlainObject(manifest.resources)) {
      errors.push('resources must be an object');
    } else {
      validateIntegerField(manifest.resources.min_context_tokens, 'resources.min_context_tokens', errors, { min: 0 });
      validateIntegerField(manifest.resources.min_output_tokens, 'resources.min_output_tokens', errors, { min: 0 });
      validateIntegerField(manifest.resources.token_budget, 'resources.token_budget', errors, { min: 0 });
      validateIntegerField(manifest.resources.tool_count, 'resources.tool_count', errors, { min: 0 });
    }
  }

  if (manifest.safety != null) {
    if (!isPlainObject(manifest.safety)) {
      errors.push('safety must be an object');
    } else {
      if (manifest.safety.domain != null) {
        validateEnumArray(manifest.safety.domain, 'safety.domain', SAFETY_DOMAIN_IDS, errors, { allowEmpty: true });
      }
      if (manifest.safety.harm_taxonomy != null && typeof manifest.safety.harm_taxonomy !== 'string') {
        errors.push('safety.harm_taxonomy must be a string');
      }
    }
  }

  if (manifest.measurement != null) {
    if (!isPlainObject(manifest.measurement)) {
      errors.push('measurement must be an object');
    } else {
      if (manifest.measurement.type != null && !MEASUREMENT_TYPE_IDS.includes(manifest.measurement.type)) {
        errors.push(`Invalid measurement.type: ${manifest.measurement.type} (must be one of: ${MEASUREMENT_TYPE_IDS.join(', ')})`);
      }
      if (manifest.measurement.critical_action != null && typeof manifest.measurement.critical_action !== 'string') {
        errors.push('measurement.critical_action must be a string');
      }
      if (manifest.measurement.question != null && typeof manifest.measurement.question !== 'string') {
        errors.push('measurement.question must be a string');
      }
    }
  }

  if (manifest.metadata != null && !isPlainObject(manifest.metadata)) {
    errors.push('metadata must be an object');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a model capability declaration.
 * @param {Object} capability
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCapability(capability) {
  const errors = [];

  if (!isPlainObject(capability)) {
    return { valid: false, errors: ['Capability must be an object'] };
  }

  for (const field of CAPABILITY_REQUIRED) {
    if (capability[field] == null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (capability.manifest_version && capability.manifest_version !== '0.1.0') {
    errors.push(`Unsupported manifest_version: ${capability.manifest_version} (expected 0.1.0)`);
  }

  if (capability.model_id != null && typeof capability.model_id !== 'string') {
    errors.push('model_id must be a string');
  }
  if (capability.provider != null && typeof capability.provider !== 'string') {
    errors.push('provider must be a string');
  }
  if (capability.api_format != null && !API_FORMAT_IDS.includes(capability.api_format)) {
    errors.push(`Invalid api_format: ${capability.api_format} (must be one of: ${API_FORMAT_IDS.join(', ')})`);
  }

  if (capability.interaction != null) {
    if (!isPlainObject(capability.interaction)) {
      errors.push('interaction must be an object');
    } else {
      validateEnumArray(capability.interaction.patterns, 'interaction.patterns', INTERACTION_PATTERN_IDS, errors);
      if (capability.interaction.timings != null) {
        validateEnumArray(capability.interaction.timings, 'interaction.timings', TIMING_MODE_IDS, errors);
      }
    }
  }

  if (capability.input != null) {
    if (!isPlainObject(capability.input)) {
      errors.push('input must be an object');
    } else {
      validateEnumArray(capability.input.modalities, 'input.modalities', INPUT_MODALITY_IDS, errors);
      validateBooleanField(capability.input.system_prompt, 'input.system_prompt', errors);
    }
  }

  if (capability.output != null) {
    if (!isPlainObject(capability.output)) {
      errors.push('output must be an object');
    } else {
      validateEnumArray(capability.output.modalities, 'output.modalities', OUTPUT_MODALITY_IDS, errors);
    }
  }

  if (capability.resources != null) {
    if (!isPlainObject(capability.resources)) {
      errors.push('resources must be an object');
    } else {
      validateIntegerField(capability.resources.context_window_tokens, 'resources.context_window_tokens', errors, { min: 0 });
      validateIntegerField(capability.resources.max_output_tokens, 'resources.max_output_tokens', errors, { min: 0 });
      validateIntegerField(capability.resources.max_tool_count, 'resources.max_tool_count', errors, { min: 0 });
      validateIntegerField(capability.resources.requests_per_minute, 'resources.requests_per_minute', errors, { min: 0 });
    }
  }

  if (capability.metadata != null && !isPlainObject(capability.metadata)) {
    errors.push('metadata must be an object');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate an evaluation report.
 * @param {Object} report
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateReport(report) {
  const errors = [];

  if (!isPlainObject(report)) {
    return { valid: false, errors: ['Report must be an object'] };
  }

  for (const field of REPORT_REQUIRED) {
    if (report[field] == null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (report.report_version && report.report_version !== '0.1.0') {
    errors.push(`Unsupported report_version: ${report.report_version} (expected 0.1.0)`);
  }
  if (report.id != null && typeof report.id !== 'string') {
    errors.push('id must be a string');
  }
  validateIsoTimestamp(report.timestamp, 'timestamp', errors);

  if (report.manifest != null) {
    if (!isPlainObject(report.manifest)) {
      errors.push('manifest must be an object');
    } else {
      if (!report.manifest.id) {
        errors.push('manifest.id is required within the embedded manifest');
      }
      const nested = validateManifest(report.manifest);
      errors.push(...nested.errors.map(error => `manifest.${error}`));
    }
  }

  if (report.capability != null) {
    if (!isPlainObject(report.capability)) {
      errors.push('capability must be an object');
    } else {
      if (!report.capability.model_id) {
        errors.push('capability.model_id is required within the embedded capability');
      }
      if (!report.capability.provider) {
        errors.push('capability.provider is required within the embedded capability');
      }
      const nested = validateCapability(report.capability);
      errors.push(...nested.errors.map(error => `capability.${error}`));
    }
  }

  if (report.compatibility != null) {
    if (!isPlainObject(report.compatibility)) {
      errors.push('compatibility must be an object');
    } else {
      if (typeof report.compatibility.compatible !== 'boolean') {
        errors.push('compatibility.compatible must be a boolean');
      }
      validateStringArray(report.compatibility.blocking, 'compatibility.blocking', errors, { allowUndefined: true });
      validateStringArray(report.compatibility.warnings, 'compatibility.warnings', errors, { allowUndefined: true });
      validateStringArray(report.compatibility.info, 'compatibility.info', errors, { allowUndefined: true });
    }
  }

  if (report.run != null) {
    if (!isPlainObject(report.run)) {
      errors.push('run must be an object');
    } else {
      if (!report.run.runner) {
        errors.push('run.runner is required');
      } else if (typeof report.run.runner !== 'string') {
        errors.push('run.runner must be a string');
      }
      validateIsoTimestamp(report.run.timestamp_start, 'run.timestamp_start', errors, { allowUndefined: true });
      validateIsoTimestamp(report.run.timestamp_end, 'run.timestamp_end', errors, { allowUndefined: true });
      validateIntegerField(report.run.duration_ms, 'run.duration_ms', errors, { min: 0, allowUndefined: true });
      validateIntegerField(report.run.samples, 'run.samples', errors, { min: 0, allowUndefined: true });
      if (report.run.config != null && !isPlainObject(report.run.config)) {
        errors.push('run.config must be an object');
      }
    }
  }

  if (report.results != null) {
    if (!isPlainObject(report.results)) {
      errors.push('results must be an object');
    } else {
      if (!report.results.measurement_type) {
        errors.push('results.measurement_type is required');
      } else if (!MEASUREMENT_TYPE_IDS.includes(report.results.measurement_type)) {
        errors.push(`Invalid results.measurement_type: ${report.results.measurement_type} (must be one of: ${MEASUREMENT_TYPE_IDS.join(', ')})`);
      }

      if (report.results.passed != null && typeof report.results.passed !== 'boolean') {
        errors.push('results.passed must be a boolean or null');
      }
      if (report.results.primary_score != null && typeof report.results.primary_score !== 'number') {
        errors.push('results.primary_score must be a number or null');
      }

      if (report.results.samples != null) {
        if (!Array.isArray(report.results.samples)) {
          errors.push('results.samples must be an array');
        } else {
          for (let i = 0; i < report.results.samples.length; i++) {
            const sample = report.results.samples[i];
            if (!isPlainObject(sample)) {
              errors.push(`results.samples[${i}] must be an object`);
              continue;
            }
            if (!sample.sample_id) {
              errors.push(`results.samples[${i}].sample_id is required`);
            } else if (typeof sample.sample_id !== 'string') {
              errors.push(`results.samples[${i}].sample_id must be a string`);
            }
            if (sample.score != null && typeof sample.score !== 'number') {
              errors.push(`results.samples[${i}].score must be a number or null`);
            }
            if (sample.details != null && !isPlainObject(sample.details)) {
              errors.push(`results.samples[${i}].details must be an object or null`);
            }
          }
        }
      }

      if (report.results.aggregation != null) {
        if (!isPlainObject(report.results.aggregation)) {
          errors.push('results.aggregation must be an object');
        } else {
          validateIntegerField(report.results.aggregation.count, 'results.aggregation.count', errors, { min: 0, allowUndefined: true });
          validateNullableNumber(report.results.aggregation.mean, 'results.aggregation.mean', errors);
          validateNullableNumber(report.results.aggregation.median, 'results.aggregation.median', errors);
          validateNullableNumber(report.results.aggregation.std_dev, 'results.aggregation.std_dev', errors);
          validateNullableNumber(report.results.aggregation.min, 'results.aggregation.min', errors);
          validateNullableNumber(report.results.aggregation.max, 'results.aggregation.max', errors);
          if (report.results.aggregation.pass_rate != null) {
            if (typeof report.results.aggregation.pass_rate !== 'number') {
              errors.push('results.aggregation.pass_rate must be a number or null');
            } else if (report.results.aggregation.pass_rate < 0 || report.results.aggregation.pass_rate > 1) {
              errors.push('results.aggregation.pass_rate must be between 0 and 1');
            }
          }
        }
      }
    }
  }

  if (report.metadata != null && !isPlainObject(report.metadata)) {
    errors.push('metadata must be an object');
  }

  return { valid: errors.length === 0, errors };
}

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function validateEnumArray(value, field, allowedValues, errors, options = {}) {
  const { allowEmpty = false } = options;
  if (!Array.isArray(value)) {
    errors.push(`${field} must be a ${allowEmpty ? '' : 'non-empty '}array`.trim());
    return;
  }
  if (!allowEmpty && value.length === 0) {
    errors.push(`${field} must be a non-empty array`);
    return;
  }
  const seen = new Set();
  for (const item of value) {
    if (seen.has(item)) {
      errors.push(`${field} must not contain duplicates`);
      break;
    }
    seen.add(item);
    if (!allowedValues.includes(item)) {
      errors.push(`Invalid ${field.replace(/.*\./, '')}: ${item} (must be one of: ${allowedValues.join(', ')})`);
    }
  }
}

function validateStringArray(value, field, errors, options = {}) {
  const { allowUndefined = false } = options;
  if (value == null) {
    if (!allowUndefined) errors.push(`${field} must be an array`);
    return;
  }
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array`);
    return;
  }
  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== 'string') {
      errors.push(`${field}[${i}] must be a string`);
    }
  }
}

function validateBooleanField(value, field, errors) {
  if (value != null && typeof value !== 'boolean') {
    errors.push(`${field} must be a boolean`);
  }
}

function validateIntegerField(value, field, errors, options = {}) {
  const { min, allowUndefined = false } = options;
  if (value == null) {
    if (!allowUndefined) return;
    return;
  }
  if (!Number.isInteger(value)) {
    errors.push(`${field} must be an integer`);
    return;
  }
  if (min != null && value < min) {
    errors.push(`${field} must be >= ${min}`);
  }
}

function validateNullableNumber(value, field, errors) {
  if (value != null && typeof value !== 'number') {
    errors.push(`${field} must be a number or null`);
  }
}

function validateIsoTimestamp(value, field, errors, options = {}) {
  const { allowUndefined = false } = options;
  if (value == null) {
    if (!allowUndefined) errors.push(`${field} must be an ISO 8601 date-time string`);
    return;
  }
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    errors.push(`Invalid ${field}: ${value} (must be ISO 8601 date-time)`);
  }
}
