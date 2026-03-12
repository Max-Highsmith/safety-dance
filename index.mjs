/* ===================================================================
   Safety Dance — Public API
   A standard protocol for AI safety benchmarks to declare requirements
   and AI models to declare capabilities, enabling compatibility
   handshakes before evaluation.
   =================================================================== */

export { checkCompatibility } from './lib/compatibility.mjs';
export { getModelCapability, listModels, registerModel } from './lib/registry.mjs';
export { validateManifest, validateCapability } from './lib/validate.mjs';

// Taxonomy — shared vocabulary for modalities, patterns, and domains
export {
  INPUT_MODALITIES,
  OUTPUT_MODALITIES,
  INTERACTION_PATTERNS,
  TIMING_MODES,
  SAFETY_DOMAINS,
  MEASUREMENT_TYPES,
  API_FORMATS,
  INPUT_MODALITY_IDS,
  OUTPUT_MODALITY_IDS,
  INTERACTION_PATTERN_IDS,
  TIMING_MODE_IDS,
  SAFETY_DOMAIN_IDS,
  MEASUREMENT_TYPE_IDS,
  API_FORMAT_IDS,
} from './lib/taxonomy.mjs';
