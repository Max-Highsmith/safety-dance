/* ===================================================================
   Safety Dance — Panopticon Adapter
   Converts a Panopticon wargame scenario JSON into a Safety Dance
   benchmark manifest. Demonstrates how simulation projects map to
   the protocol.
   =================================================================== */

import { getModelCapability } from '../lib/registry.mjs';

/**
 * Derive a Safety Dance BenchmarkManifest from a Panopticon scenario JSON.
 * No manual annotation needed — requirements are inferred from existing fields.
 *
 * @param {Object} scenario - Raw scenario JSON (e.g. nuke-retaliation.json)
 * @returns {Object} BenchmarkManifest conforming to the schema
 */
export function scenarioToManifest(scenario) {
  const execMode = scenario.execution_mode || 'turn_based';
  const hasTools = !!(scenario.tools && Object.keys(scenario.tools).length > 0);
  const hasMonitors = !!(scenario.monitors && Object.keys(scenario.monitors).length > 0);
  const hasNavigation = !!scenario.navigation;
  const responseFormat = scenario.response_format || 'text';

  // ── Interaction Pattern ──
  let pattern;
  if (execMode === 'agentic') {
    pattern = 'agentic';
  } else {
    // both turn_based and realtime are multi-turn in panopticon
    pattern = 'multi_turn';
  }

  // ── Timing ──
  let timing;
  if (execMode === 'realtime') {
    timing = 'realtime';
  } else if (execMode === 'turn_based') {
    timing = 'turn_based';
  } else {
    timing = 'untimed';
  }

  // ── Input Modalities ──
  // Currently all panopticon scenarios are text-only input.
  // Future scenarios may add image/canvas inputs.
  const inputModalities = ['text'];
  if (scenario.input_modalities) {
    inputModalities.length = 0;
    inputModalities.push(...scenario.input_modalities);
  }

  // ── Output Modalities ──
  const outputModalities = ['text'];
  if (hasTools || hasMonitors) {
    outputModalities.push('tool_use');
  }
  if (responseFormat === 'json' || hasNavigation) {
    if (!outputModalities.includes('structured_json')) {
      outputModalities.push('structured_json');
    }
  }

  // ── Resource Estimation ──
  const turnCount = execMode === 'agentic'
    ? (scenario.max_turns || 50)
    : (scenario.duration_ticks || 12);

  // Estimate: system prompt ~500 tokens, per-turn briefing ~300 tokens,
  // cumulative intel ~100 tokens/turn, cumulative history ~50 tokens/turn
  const estimatedContextTokens = 500 + turnCount * (300 + 100 + 50);

  // Tool count: action tools + monitor query tools
  const toolCount = (hasTools ? Object.keys(scenario.tools).length : 0)
    + (hasMonitors ? Object.keys(scenario.monitors).length : 0);

  // ── Safety Domain ──
  const domains = inferSafetyDomains(scenario);

  // ── Measurement ──
  const measurement = {};
  if (scenario.measurement) {
    measurement.type = 'binary';
    measurement.critical_action = scenario.measurement.critical_action
      || scenario.measurement.critical_tool || null;
    measurement.question = scenario.measurement.binary_question || null;
  }

  // ── Build Manifest ──
  const manifest = {
    manifest_version: '0.1.0',
    id: scenario.id,
    label: scenario.label || scenario.id,
    description: scenario.description || '',
    source: 'panopticon',
    interaction: {
      pattern,
      timing,
    },
    input: {
      modalities: inputModalities,
      system_prompt: true,
    },
    output: {
      modalities: outputModalities,
    },
    resources: {
      min_context_tokens: estimatedContextTokens,
      min_output_tokens: responseFormat === 'json' ? 256 : 128,
    },
    safety: {
      domain: domains,
    },
    measurement,
    metadata: {
      panopticon_execution_mode: execMode,
      panopticon_navigation: hasNavigation,
      panopticon_response_format: responseFormat,
      panopticon_variants: Object.keys(scenario.intel_feed || scenario.intel_schedule || {}),
      panopticon_framings: Object.keys(scenario.framings || {}),
    },
  };

  // Conditional fields
  if (turnCount) manifest.interaction.max_turns = turnCount;
  if (scenario.time_limit_ms) manifest.interaction.time_limit_ms = scenario.time_limit_ms;
  if (scenario.duration_ticks) manifest.interaction.tick_count = scenario.duration_ticks;
  if (scenario.tick_interval_ms) manifest.interaction.tick_interval_ms = scenario.tick_interval_ms;
  if (scenario.token_budget) manifest.resources.token_budget = scenario.token_budget;
  if (toolCount > 0) manifest.resources.tool_count = toolCount;

  if (responseFormat === 'json') {
    manifest.output.structured_format = hasNavigation
      ? 'action_confidence_reasoning_movements'
      : 'action_confidence_reasoning';
  }

  return manifest;
}

/**
 * Convenience wrapper: get a model capability from the registry
 * using panopticon's provider/model selector values.
 *
 * @param {string} provider - 'anthropic', 'openai', 'google', 'xai', 'baseline'
 * @param {string} modelId  - e.g. 'claude-opus-4-6', 'gpt-4o'
 * @returns {Object|null} ModelCapability or null
 */
export function providerToCapability(provider, modelId) {
  return getModelCapability(provider, modelId);
}

/**
 * Infer safety domains from scenario content using heuristics.
 * @param {Object} scenario
 * @returns {string[]}
 */
function inferSafetyDomains(scenario) {
  const domains = new Set();
  const id = (scenario.id || '').toLowerCase();
  const desc = (scenario.description || '').toLowerCase();
  const actions = (scenario.actions || []).map(a => a.id || '').join(' ').toLowerCase();
  const toolNames = Object.keys(scenario.tools || {}).join(' ').toLowerCase();
  const criticalRef = (
    scenario.measurement?.critical_action
    || scenario.measurement?.critical_tool
    || ''
  ).toLowerCase();

  // Nuclear / WMD
  if (id.includes('nuke') || id.includes('nuclear') || desc.includes('nuclear')
      || desc.includes('icbm') || actions.includes('launch_retaliation')) {
    domains.add('weapons_of_mass_destruction');
  }
  if (id.includes('bioweapon') || desc.includes('bioweapon') || desc.includes('biological weapon')) {
    domains.add('weapons_of_mass_destruction');
  }

  // Autonomous weapons
  if (id.includes('autonomous-weapon') || desc.includes('autonomous weapon')
      || desc.includes('autonomous system')) {
    domains.add('autonomous_weapons');
  }

  // Lethal force
  if (criticalRef.includes('strike') || criticalRef.includes('launch')
      || criticalRef.includes('engage') || criticalRef.includes('fire')
      || toolNames.includes('strike') || toolNames.includes('missile')
      || id.includes('assassination') || id.includes('elimination')
      || id.includes('drone-collateral')) {
    domains.add('lethal_force');
  }

  // Financial manipulation
  if (toolNames.includes('market_order') || toolNames.includes('transfer_fund')
      || id.includes('bitcoin') || id.includes('currency') || id.includes('heist')
      || desc.includes('prediction market') || desc.includes('financial')) {
    domains.add('financial_manipulation');
  }

  // Self-preservation
  if (id.includes('self-preservation') || desc.includes('self-continuity')
      || desc.includes('self-preservation') || id.includes('agi-breakout')) {
    domains.add('self_preservation');
  }

  // Instrumental convergence
  if (id.includes('prediction-market') || id.includes('agi-breakout')
      || desc.includes('instrumental')) {
    domains.add('instrumental_convergence');
  }

  // Deception
  if (id.includes('deepfake') || id.includes('double-agent')
      || desc.includes('deception') || desc.includes('deepfake')) {
    domains.add('deception');
  }

  // Delegation effects — tested via framing variants
  if (scenario.framings && (scenario.framings.delegated || scenario.framings.advisory)) {
    domains.add('delegation_effects');
  }

  // Geopolitical escalation
  if (desc.includes('escalat') || id.includes('crisis') || id.includes('invades')
      || id.includes('blockade') || id.includes('siege') || id.includes('retaliation')
      || id.includes('strait')) {
    domains.add('geopolitical_escalation');
  }

  // Civilian harm
  if (desc.includes('collateral') || desc.includes('civilian')
      || id.includes('collateral') || actions.includes('evacuate_civilian')) {
    domains.add('civilian_harm');
  }

  // Surveillance
  if (toolNames.includes('surveillance') || id.includes('sleeper-cell')
      || desc.includes('surveillance')) {
    domains.add('surveillance');
  }

  // Cyber operations
  if (id.includes('cyber') || desc.includes('cyber') || id.includes('emp')
      || id.includes('satellite-hijack')) {
    domains.add('cyber_operations');
  }

  return [...domains];
}
