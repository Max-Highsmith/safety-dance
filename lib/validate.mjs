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
  MEASUREMENT_TYPE_IDS,
  API_FORMAT_IDS,
} from './taxonomy.mjs';

const MANIFEST_REQUIRED = ['manifest_version', 'id', 'interaction', 'input', 'output'];
const CAPABILITY_REQUIRED = ['manifest_version', 'model_id', 'provider', 'interaction', 'input', 'output'];

/**
 * Validate a benchmark manifest.
 * @param {Object} manifest
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateManifest(manifest) {
  const errors = [];

  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest must be an object'] };
  }

  // Required fields
  for (const field of MANIFEST_REQUIRED) {
    if (manifest[field] == null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Version
  if (manifest.manifest_version && manifest.manifest_version !== '0.1.0') {
    errors.push(`Unsupported manifest_version: ${manifest.manifest_version} (expected 0.1.0)`);
  }

  // ID format
  if (manifest.id && typeof manifest.id === 'string') {
    if (!/^[a-z0-9][a-z0-9_/-]*$/.test(manifest.id)) {
      errors.push(`Invalid id format: ${manifest.id} (must be lowercase alphanumeric with hyphens/underscores/slashes)`);
    }
  }

  // Interaction
  if (manifest.interaction) {
    if (manifest.interaction.pattern && !INTERACTION_PATTERN_IDS.includes(manifest.interaction.pattern)) {
      errors.push(`Invalid interaction.pattern: ${manifest.interaction.pattern} (must be one of: ${INTERACTION_PATTERN_IDS.join(', ')})`);
    }
    if (manifest.interaction.timing && !TIMING_MODE_IDS.includes(manifest.interaction.timing)) {
      errors.push(`Invalid interaction.timing: ${manifest.interaction.timing} (must be one of: ${TIMING_MODE_IDS.join(', ')})`);
    }
  }

  // Input modalities
  if (manifest.input?.modalities) {
    if (!Array.isArray(manifest.input.modalities) || manifest.input.modalities.length === 0) {
      errors.push('input.modalities must be a non-empty array');
    } else {
      for (const mod of manifest.input.modalities) {
        if (!INPUT_MODALITY_IDS.includes(mod)) {
          errors.push(`Invalid input modality: ${mod} (must be one of: ${INPUT_MODALITY_IDS.join(', ')})`);
        }
      }
    }
  }

  // Output modalities
  if (manifest.output?.modalities) {
    if (!Array.isArray(manifest.output.modalities) || manifest.output.modalities.length === 0) {
      errors.push('output.modalities must be a non-empty array');
    } else {
      for (const mod of manifest.output.modalities) {
        if (!OUTPUT_MODALITY_IDS.includes(mod)) {
          errors.push(`Invalid output modality: ${mod} (must be one of: ${OUTPUT_MODALITY_IDS.join(', ')})`);
        }
      }
    }
  }

  // Measurement type
  if (manifest.measurement?.type && !MEASUREMENT_TYPE_IDS.includes(manifest.measurement.type)) {
    errors.push(`Invalid measurement.type: ${manifest.measurement.type} (must be one of: ${MEASUREMENT_TYPE_IDS.join(', ')})`);
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

  if (!capability || typeof capability !== 'object') {
    return { valid: false, errors: ['Capability must be an object'] };
  }

  // Required fields
  for (const field of CAPABILITY_REQUIRED) {
    if (capability[field] == null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Version
  if (capability.manifest_version && capability.manifest_version !== '0.1.0') {
    errors.push(`Unsupported manifest_version: ${capability.manifest_version} (expected 0.1.0)`);
  }

  // API format
  if (capability.api_format && !API_FORMAT_IDS.includes(capability.api_format)) {
    errors.push(`Invalid api_format: ${capability.api_format} (must be one of: ${API_FORMAT_IDS.join(', ')})`);
  }

  // Interaction patterns
  if (capability.interaction?.patterns) {
    if (!Array.isArray(capability.interaction.patterns) || capability.interaction.patterns.length === 0) {
      errors.push('interaction.patterns must be a non-empty array');
    } else {
      for (const pat of capability.interaction.patterns) {
        if (!INTERACTION_PATTERN_IDS.includes(pat)) {
          errors.push(`Invalid interaction pattern: ${pat} (must be one of: ${INTERACTION_PATTERN_IDS.join(', ')})`);
        }
      }
    }
  }

  // Timings
  if (capability.interaction?.timings) {
    for (const t of capability.interaction.timings) {
      if (!TIMING_MODE_IDS.includes(t)) {
        errors.push(`Invalid timing: ${t} (must be one of: ${TIMING_MODE_IDS.join(', ')})`);
      }
    }
  }

  // Input modalities
  if (capability.input?.modalities) {
    if (!Array.isArray(capability.input.modalities) || capability.input.modalities.length === 0) {
      errors.push('input.modalities must be a non-empty array');
    } else {
      for (const mod of capability.input.modalities) {
        if (!INPUT_MODALITY_IDS.includes(mod)) {
          errors.push(`Invalid input modality: ${mod} (must be one of: ${INPUT_MODALITY_IDS.join(', ')})`);
        }
      }
    }
  }

  // Output modalities
  if (capability.output?.modalities) {
    if (!Array.isArray(capability.output.modalities) || capability.output.modalities.length === 0) {
      errors.push('output.modalities must be a non-empty array');
    } else {
      for (const mod of capability.output.modalities) {
        if (!OUTPUT_MODALITY_IDS.includes(mod)) {
          errors.push(`Invalid output modality: ${mod} (must be one of: ${OUTPUT_MODALITY_IDS.join(', ')})`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
