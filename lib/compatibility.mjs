/* ===================================================================
   Safety Dance — Compatibility Checker
   Core algorithm: checks whether a model meets a benchmark's requirements.
   Returns blocking issues, warnings, info, and a rule-aligned breakdown.
   =================================================================== */

const HIERARCHY = ['single_turn', 'multi_turn', 'agentic'];
const SEVERITY_RANK = {
  unknown: 0,
  pass: 1,
  warn: 2,
  fail: 3,
};

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

  const breakdown = {
    input_modalities: 'unknown',
    output_modalities: 'unknown',
    interaction_pattern: 'unknown',
    timing: 'unknown',
    system_prompt: 'unknown',
    context_window: 'unknown',
    output_tokens: 'unknown',
    tool_count: 'unknown',
  };

  const setStatus = (dimension, status) => {
    if (SEVERITY_RANK[status] > SEVERITY_RANK[breakdown[dimension]]) {
      breakdown[dimension] = status;
    }
  };

  const addBlocking = (dimension, message) => {
    blocking.push(message);
    setStatus(dimension, 'fail');
  };

  const addWarning = (dimension, message) => {
    warnings.push(message);
    setStatus(dimension, 'warn');
  };

  const addInfo = message => {
    info.push(message);
  };

  const reqInputMods = manifest.input?.modalities;
  const capInputMods = capability.input?.modalities;
  if (Array.isArray(reqInputMods) && Array.isArray(capInputMods)) {
    setStatus('input_modalities', 'pass');
    for (const mod of reqInputMods) {
      if (!capInputMods.includes(mod)) {
        addBlocking('input_modalities', `Model does not support required input modality: ${mod}`);
      }
    }
    const extraInputMods = capInputMods.filter(mod => !reqInputMods.includes(mod));
    if (extraInputMods.length > 0) {
      addInfo(`Model has additional input modalities: ${extraInputMods.join(', ')}`);
    }
  }

  const reqOutputMods = manifest.output?.modalities;
  const capOutputMods = capability.output?.modalities;
  if (Array.isArray(reqOutputMods) && Array.isArray(capOutputMods)) {
    setStatus('output_modalities', 'pass');
    for (const mod of reqOutputMods) {
      if (capOutputMods.includes(mod)) continue;

      if (mod === 'tool_use') {
        if (manifest.interaction?.pattern === 'agentic') {
          addBlocking('output_modalities', 'Model does not support tool_use (required for agentic interaction)');
        } else {
          addWarning('output_modalities', 'Model does not support tool_use; benchmark may use text parsing fallback');
        }
      } else if (mod === 'structured_json') {
        addWarning('output_modalities', 'Model does not declare structured_json output; text parsing fallback will be used');
      } else {
        addBlocking('output_modalities', `Model does not support required output modality: ${mod}`);
      }
    }
  }

  const reqPattern = manifest.interaction?.pattern;
  const capPatterns = capability.interaction?.patterns;
  if (reqPattern != null && Array.isArray(capPatterns)) {
    setStatus('interaction_pattern', 'pass');
    if (!capPatterns.includes(reqPattern)) {
      if (supportsSupersetPattern(reqPattern, capPatterns)) {
        addInfo(`Benchmark needs ${reqPattern}; model supports ${capPatterns.join(', ')} (compatible superset)`);
      } else {
        addBlocking('interaction_pattern', `Model does not support interaction pattern: ${reqPattern}`);
      }
    }
  }

  const reqTiming = manifest.interaction?.timing;
  const capTimings = capability.interaction?.timings;
  if (reqTiming != null) {
    setStatus('timing', 'pass');
    if (reqTiming !== 'untimed') {
      if (Array.isArray(capTimings)) {
        if (!capTimings.includes(reqTiming)) {
          addWarning('timing', `Model may not perform well in ${reqTiming} timing mode`);
        }
      } else {
        addWarning('timing', `Model may not perform well in ${reqTiming} timing mode`);
      }
    }
  }

  const reqSysPrompt = manifest.input?.system_prompt;
  const capSysPrompt = capability.input?.system_prompt;
  if (reqSysPrompt != null) {
    setStatus('system_prompt', 'pass');
    if (reqSysPrompt === true && capSysPrompt === false) {
      addWarning('system_prompt', 'Benchmark uses system prompt but model does not support one; content will be prepended to user message');
    }
  }

  const reqContext = manifest.resources?.min_context_tokens;
  const capContext = capability.resources?.context_window_tokens;
  if (typeof reqContext === 'number') {
    setStatus('context_window', 'pass');
    if (typeof capContext === 'number') {
      if (reqContext > capContext) {
        addBlocking('context_window', `Benchmark requires ${reqContext} context tokens; model supports ${capContext}`);
      } else if (reqContext > capContext * 0.8) {
        addWarning('context_window', `Benchmark needs ${reqContext} context tokens; model has ${capContext} (tight margin)`);
      }
    } else {
      breakdown.context_window = 'unknown';
    }
  }

  const reqOutput = manifest.resources?.min_output_tokens;
  const capOutput = capability.resources?.max_output_tokens;
  if (typeof reqOutput === 'number') {
    setStatus('output_tokens', 'pass');
    if (typeof capOutput === 'number') {
      if (reqOutput > capOutput) {
        addWarning('output_tokens', `Benchmark expects ${reqOutput} output tokens; model max is ${capOutput}`);
      }
    } else {
      breakdown.output_tokens = 'unknown';
    }
  }

  const reqTools = manifest.resources?.tool_count;
  const capTools = capability.resources?.max_tool_count;
  if (typeof reqTools === 'number') {
    setStatus('tool_count', 'pass');
    if (typeof capTools === 'number') {
      if (reqTools > capTools) {
        addWarning('tool_count', `Benchmark uses ${reqTools} tools; model supports max ${capTools}`);
      }
    } else {
      breakdown.tool_count = 'unknown';
    }
  }

  if (manifest.resources?.token_budget != null) {
    addInfo(`Benchmark has ${manifest.resources.token_budget} token budget across all turns`);
  }

  return {
    compatible: blocking.length === 0,
    blocking,
    warnings,
    info,
    breakdown,
  };
}

function supportsSupersetPattern(required, availablePatterns) {
  const reqRank = HIERARCHY.indexOf(required);
  if (reqRank === -1) return false;

  let maxCapRank = -1;
  for (const pattern of availablePatterns) {
    const rank = HIERARCHY.indexOf(pattern);
    if (rank > maxCapRank) maxCapRank = rank;
  }
  return maxCapRank >= reqRank;
}
