/* ===================================================================
   Safety Dance — Public API
   A standard protocol for AI safety benchmarks to declare requirements
   and AI models to declare capabilities, enabling compatibility
   handshakes before evaluation.
   =================================================================== */

export { checkCompatibility } from './lib/compatibility.mjs';
export { getModelCapability, listModels, registerModel } from './lib/registry.mjs';
export { validateManifest, validateCapability } from './lib/validate.mjs';
