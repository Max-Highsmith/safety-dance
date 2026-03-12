/* ===================================================================
   Safety Dance — Compatibility Checker
   Core algorithm: checks whether a model meets a benchmark's requirements.
   Returns blocking issues, warnings, and per-field breakdown.
   =================================================================== */

/**
 * Check compatibility between a benchmark manifest and a model capability.
 * @param {Object} manifest   - BenchmarkManifest (what the benchmark needs)
 * @param {Object} capability - ModelCapability (what the model provides)
 * @returns {{ compatible: boolean, blocking: string[], warnings: string[], info: string[], breakdown: Object }}
 */
export function checkCompatibility(manifest, capability) {
  const blocking = [];
  const warnings = [];
  const info = [];

  // ── 1. INPUT MODALITIES (BLOCKING) ──
  // Every required input modality must be supported by the model.
  const reqInputMods = manifest.input?.modalities || [];
  const capInputMods = capability.input?.modalities || [];
  for (const mod of reqInputMods) {
    if (!capInputMods.includes(mod)) {
      blocking.push(`Model does not support required input modality: ${mod}`);
    }
  }
  const extraInputMods = capInputMods.filter(m => !reqInputMods.includes(m));
  if (extraInputMods.length > 0) {
    info.push(`Model has additional input modalities: ${extraInputMods.join(', ')}`);
  }

  // ── 2. OUTPUT MODALITIES (BLOCKING or WARNING) ──
  const reqOutputMods = manifest.output?.modalities || [];
  const capOutputMods = capability.output?.modalities || [];
  for (const mod of reqOutputMods) {
    if (!capOutputMods.includes(mod)) {
      if (mod === 'tool_use') {
        // tool_use is blocking for agentic; warning otherwise (text fallback possible)
        if (manifest.interaction?.pattern === 'agentic') {
          blocking.push('Model does not support tool_use (required for agentic interaction)');
        } else {
          warnings.push('Model does not support tool_use; benchmark may use text parsing fallback');
        }
      } else if (mod === 'structured_json') {
        // structured_json can degrade to text parsing
        warnings.push('Model does not declare structured_json output; text parsing fallback will be used');
      } else {
        blocking.push(`Model does not support required output modality: ${mod}`);
      }
    }
  }

  // ── 3. INTERACTION PATTERN (BLOCKING) ──
  const reqPattern = manifest.interaction?.pattern;
  const capPatterns = capability.interaction?.patterns || [];
  if (reqPattern && !capPatterns.includes(reqPattern)) {
    // Check compatible supersets: single_turn ⊂ multi_turn ⊂ agentic
    const hierarchy = ['single_turn', 'multi_turn', 'agentic'];
    const reqRank = hierarchy.indexOf(reqPattern);
    const maxCapRank = Math.max(...capPatterns.map(p => hierarchy.indexOf(p)));
    if (reqRank >= 0 && maxCapRank >= reqRank) {
      info.push(`Benchmark needs ${reqPattern}; model supports ${capPatterns.join(', ')} (compatible superset)`);
    } else {
      blocking.push(`Model does not support interaction pattern: ${reqPattern}`);
    }
  }

  // ── 4. TIMING (WARNING) ──
  const reqTiming = manifest.interaction?.timing;
  if (reqTiming && reqTiming !== 'untimed') {
    const capTimings = capability.interaction?.timings || ['untimed', 'turn_based', 'realtime'];
    if (!capTimings.includes(reqTiming)) {
      warnings.push(`Model may not perform well in ${reqTiming} timing mode`);
    }
  }

  // ── 5. SYSTEM PROMPT (WARNING) ──
  const reqSysPrompt = manifest.input?.system_prompt;
  const capSysPrompt = capability.input?.system_prompt;
  if (reqSysPrompt && capSysPrompt === false) {
    warnings.push('Benchmark uses system prompt but model does not support one; content will be prepended to user message');
  }

  // ── 6. CONTEXT WINDOW (BLOCKING or WARNING) ──
  const reqContext = manifest.resources?.min_context_tokens;
  const capContext = capability.resources?.context_window_tokens;
  if (reqContext != null && capContext != null) {
    if (reqContext > capContext) {
      blocking.push(`Benchmark requires ${reqContext} context tokens; model supports ${capContext}`);
    } else if (reqContext > capContext * 0.8) {
      warnings.push(`Benchmark needs ${reqContext} context tokens; model has ${capContext} (tight margin)`);
    }
  }

  // ── 7. OUTPUT TOKENS (WARNING) ──
  const reqOutput = manifest.resources?.min_output_tokens;
  const capOutput = capability.resources?.max_output_tokens;
  if (reqOutput != null && capOutput != null) {
    if (reqOutput > capOutput) {
      warnings.push(`Benchmark expects ${reqOutput} output tokens; model max is ${capOutput}`);
    }
  }

  // ── 8. TOOL COUNT (WARNING) ──
  const reqTools = manifest.resources?.tool_count;
  const capTools = capability.resources?.max_tool_count;
  if (reqTools != null && capTools != null) {
    if (reqTools > capTools) {
      warnings.push(`Benchmark uses ${reqTools} tools; model supports max ${capTools}`);
    }
  }

  // ── 9. TOKEN BUDGET (INFO) ──
  if (manifest.resources?.token_budget != null) {
    info.push(`Benchmark has ${manifest.resources.token_budget} token budget across all turns`);
  }

  // ── Build per-field breakdown ──
  const breakdown = {
    input_modalities: fieldCheck(reqInputMods, capInputMods, 'subset'),
    output_modalities: fieldCheck(reqOutputMods, capOutputMods, 'subset'),
    interaction_pattern: fieldCheck(reqPattern, capPatterns, 'member_or_superset'),
    timing: fieldCheck(reqTiming, capability.interaction?.timings, 'member'),
    system_prompt: fieldCheck(reqSysPrompt, capSysPrompt, 'bool'),
    context_window: fieldCheck(reqContext, capContext, 'lte'),
    output_tokens: fieldCheck(reqOutput, capOutput, 'lte'),
    tool_count: fieldCheck(reqTools, capTools, 'lte'),
  };

  return {
    compatible: blocking.length === 0,
    blocking,
    warnings,
    info,
    breakdown,
  };
}

/**
 * Per-field compatibility check.
 * @returns {'pass'|'fail'|'warn'|'unknown'}
 */
function fieldCheck(required, available, mode) {
  if (required == null || available == null) return 'unknown';
  switch (mode) {
    case 'subset':
      if (!Array.isArray(required) || !Array.isArray(available)) return 'unknown';
      return required.every(r => available.includes(r)) ? 'pass' : 'fail';
    case 'member':
      if (!Array.isArray(available)) return available === required ? 'pass' : 'fail';
      return available.includes(required) ? 'pass' : 'fail';
    case 'member_or_superset': {
      if (!Array.isArray(available)) return 'unknown';
      if (available.includes(required)) return 'pass';
      // Check hierarchy: single_turn ⊂ multi_turn ⊂ agentic
      const hierarchy = ['single_turn', 'multi_turn', 'agentic'];
      const reqRank = hierarchy.indexOf(required);
      const maxCapRank = Math.max(...available.map(p => hierarchy.indexOf(p)));
      return (reqRank >= 0 && maxCapRank >= reqRank) ? 'pass' : 'fail';
    }
    case 'bool':
      return (!required || available !== false) ? 'pass' : 'warn';
    case 'lte':
      if (typeof required !== 'number' || typeof available !== 'number') return 'unknown';
      return required <= available ? 'pass' : 'fail';
    default:
      return 'unknown';
  }
}
