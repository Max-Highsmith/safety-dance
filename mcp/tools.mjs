/* ===================================================================
   Safety Dance MCP — Tool Definitions
   Zod schemas, handler functions, and tool registration for the
   Safety Dance MCP server.
   =================================================================== */

import { z } from 'zod';

import {
  checkCompatibility,
  getModelCapability,
  listModels,
  registerModel,
  getModelCapabilityAsync,
  listModelsAsync,
  validateManifest,
  validateCapability,
  validateReport,
  buildReport,
  computeAggregation,
  INPUT_MODALITIES,
  OUTPUT_MODALITIES,
  INTERACTION_PATTERNS,
  TIMING_MODES,
  SAFETY_DOMAINS,
  MEASUREMENT_TYPES,
  API_FORMATS,
} from '../index.mjs';

import { scenarioToManifest } from '../adapters/panopticon.mjs';
import { gameToManifest } from '../adapters/machiavelli.mjs';
import { behaviorToManifest } from '../adapters/harmbench.mjs';
import { taskToManifest } from '../adapters/inspect.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResult(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function errorResult(message) {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

// ---------------------------------------------------------------------------
// Reusable Zod sub-schemas
// ---------------------------------------------------------------------------

const ManifestSchema = z
  .object({
    manifest_version: z.string(),
    id: z.string(),
    interaction: z
      .object({
        pattern: z.enum(['single_turn', 'multi_turn', 'agentic']),
        timing: z.enum(['untimed', 'turn_based', 'realtime']).optional(),
        max_turns: z.number().int().optional(),
        tick_count: z.number().int().optional(),
        tick_interval_ms: z.number().int().optional(),
        time_limit_ms: z.number().int().optional(),
      })
      .passthrough(),
    input: z.object({
      modalities: z.array(z.string()).min(1),
      system_prompt: z.boolean().optional(),
    }),
    output: z
      .object({
        modalities: z.array(z.string()).min(1),
        structured_format: z.string().optional(),
      })
      .passthrough(),
    resources: z
      .object({
        min_context_tokens: z.number().int().optional(),
        min_output_tokens: z.number().int().optional(),
        token_budget: z.number().int().optional(),
        tool_count: z.number().int().optional(),
      })
      .passthrough()
      .optional(),
    safety: z.object({}).passthrough().optional(),
    measurement: z.object({}).passthrough().optional(),
  })
  .passthrough();

const CapabilitySchema = z
  .object({
    manifest_version: z.string(),
    model_id: z.string(),
    provider: z.string(),
    api_format: z.string().optional(),
    interaction: z.object({
      patterns: z.array(z.string()).min(1),
      timings: z.array(z.string()).optional(),
    }),
    input: z.object({
      modalities: z.array(z.string()).min(1),
      system_prompt: z.boolean().optional(),
    }),
    output: z.object({
      modalities: z.array(z.string()).min(1),
    }),
    resources: z.object({}).passthrough().optional(),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Handler functions (exported for testing)
// ---------------------------------------------------------------------------

export const handlers = {
  async checkCompatibility({ manifest, capability, provider, model_id }) {
    try {
      let cap = capability;
      if (!cap) {
        if (!provider || !model_id) {
          return errorResult(
            'Provide either a full capability object or both provider and model_id.',
          );
        }
        cap = await getModelCapabilityAsync(provider, model_id);
        if (!cap) {
          return errorResult(`Unknown model: ${provider}/${model_id}`);
        }
      }
      return jsonResult(checkCompatibility(manifest, cap));
    } catch (e) {
      return errorResult(e.message);
    }
  },

  async getModel({ action, provider, model_id, include_openrouter }) {
    try {
      if (action === 'list') {
        const models = include_openrouter ? await listModelsAsync() : listModels();
        return jsonResult(models);
      }
      if (!provider || !model_id) {
        return errorResult('provider and model_id are required for action "get".');
      }
      const cap = await getModelCapabilityAsync(provider, model_id);
      if (!cap) {
        return errorResult(`Unknown model: ${provider}/${model_id}`);
      }
      return jsonResult(cap);
    } catch (e) {
      return errorResult(e.message);
    }
  },

  async validate({ type, document }) {
    try {
      const validators = {
        manifest: validateManifest,
        capability: validateCapability,
        report: validateReport,
      };
      return jsonResult(validators[type](document));
    } catch (e) {
      return errorResult(e.message);
    }
  },

  async buildReport(args) {
    try {
      return jsonResult(buildReport(args));
    } catch (e) {
      return errorResult(e.message);
    }
  },

  async computeAggregation({ samples, measurement_type }) {
    try {
      return jsonResult(computeAggregation(samples, measurement_type));
    } catch (e) {
      return errorResult(e.message);
    }
  },

  async convertToManifest({ source, data, game_id, options }) {
    try {
      switch (source) {
        case 'panopticon':
          return jsonResult(scenarioToManifest(data));
        case 'machiavelli':
          if (!game_id) {
            return errorResult('game_id is required for MACHIAVELLI source.');
          }
          return jsonResult(gameToManifest(data, game_id, options));
        case 'harmbench':
          return jsonResult(behaviorToManifest(data));
        case 'inspect':
          return jsonResult(taskToManifest(data));
        default:
          return errorResult(`Unknown source: ${source}`);
      }
    } catch (e) {
      return errorResult(e.message);
    }
  },

  async getTaxonomy({ category }) {
    try {
      const all = {
        input_modalities: INPUT_MODALITIES,
        output_modalities: OUTPUT_MODALITIES,
        interaction_patterns: INTERACTION_PATTERNS,
        timing_modes: TIMING_MODES,
        safety_domains: SAFETY_DOMAINS,
        measurement_types: MEASUREMENT_TYPES,
        api_formats: API_FORMATS,
      };
      if (category) {
        if (!all[category]) {
          return errorResult(
            `Unknown category: ${category}. Valid: ${Object.keys(all).join(', ')}`,
          );
        }
        return jsonResult(all[category]);
      }
      return jsonResult(all);
    } catch (e) {
      return errorResult(e.message);
    }
  },

  async registerModel({ key, capability }) {
    try {
      registerModel(key, capability);
      return jsonResult({ registered: key });
    } catch (e) {
      return errorResult(e.message);
    }
  },
};

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerTools(server) {
  // 1. check_compatibility
  server.tool(
    'check_compatibility',
    'Check whether an AI model meets a safety benchmark\'s requirements. ' +
      'Returns blocking issues, warnings, and a per-field breakdown. ' +
      'Pass a full capability object OR provider+model_id to look up from the registry.',
    {
      manifest: ManifestSchema,
      capability: CapabilitySchema.optional().describe(
        'Full model capability object. Omit if using provider+model_id.',
      ),
      provider: z
        .string()
        .optional()
        .describe('Model provider (e.g. "anthropic"). Used with model_id for registry lookup.'),
      model_id: z
        .string()
        .optional()
        .describe('Model identifier (e.g. "claude-opus-4-6"). Used with provider for registry lookup.'),
    },
    handlers.checkCompatibility,
  );

  // 2. get_model
  server.tool(
    'get_model',
    'Look up a model\'s capability declaration, or list all available models. ' +
      'Use action "list" to see available models, then "get" to retrieve details. ' +
      'Models are looked up in the local registry first, then from OpenRouter.',
    {
      action: z.enum(['get', 'list']).describe('"list" to list all models, "get" to retrieve one.'),
      provider: z.string().optional().describe('Required for action "get".'),
      model_id: z.string().optional().describe('Required for action "get".'),
      include_openrouter: z.boolean().optional().describe('Include OpenRouter models in "list" results. Default false.'),
    },
    handlers.getModel,
  );

  // 3. validate
  server.tool(
    'validate',
    'Validate a Safety Dance document against the protocol schema. ' +
      'Returns { valid: boolean, errors: string[] }.',
    {
      type: z
        .enum(['manifest', 'capability', 'report'])
        .describe('Which schema to validate against.'),
      document: z.object({}).passthrough().describe('The document to validate.'),
    },
    handlers.validate,
  );

  // 4. build_report
  server.tool(
    'build_report',
    'Build a standardized Safety Dance evaluation report. ' +
      'Auto-computes compatibility and aggregation statistics if not provided.',
    {
      manifest: ManifestSchema,
      capability: CapabilitySchema,
      run: z
        .object({
          runner: z.string().describe('Runner identifier (e.g. "panopticon@0.3.0").'),
          samples: z.number().int().optional(),
          duration_ms: z.number().int().optional(),
          config: z.object({}).passthrough().optional(),
        })
        .passthrough(),
      results: z.object({
        measurement_type: z.enum(['binary', 'categorical', 'scalar', 'rubric']),
        passed: z.boolean().nullable().optional(),
        primary_score: z.number().nullable().optional(),
        samples: z
          .array(
            z.object({
              sample_id: z.string(),
              outcome: z.any().optional(),
              score: z.number().nullable().optional(),
              details: z.object({}).passthrough().optional(),
            }),
          )
          .optional(),
        aggregation: z.object({}).passthrough().optional(),
      }),
      id: z.string().optional(),
      timestamp: z.string().optional(),
      metadata: z.object({}).passthrough().optional(),
    },
    handlers.buildReport,
  );

  // 5. compute_aggregation
  server.tool(
    'compute_aggregation',
    'Compute summary statistics (count, mean, median, std_dev, min, max, pass_rate) ' +
      'from an array of sample results.',
    {
      samples: z.array(
        z.object({
          sample_id: z.string(),
          outcome: z.any().optional(),
          score: z.number().nullable().optional(),
        }),
      ),
      measurement_type: z.enum(['binary', 'categorical', 'scalar', 'rubric']),
    },
    handlers.computeAggregation,
  );

  // 6. convert_to_manifest
  server.tool(
    'convert_to_manifest',
    'Convert a benchmark-specific scenario, game, behavior, or task descriptor ' +
      'into a Safety Dance benchmark manifest. Supports Panopticon, MACHIAVELLI, HarmBench, and Inspect AI.',
    {
      source: z.enum(['panopticon', 'machiavelli', 'harmbench', 'inspect']),
      data: z
        .object({})
        .passthrough()
        .describe('The source-specific input object (scenario, game metadata, behavior, or task descriptor).'),
      game_id: z.string().optional().describe('Required for MACHIAVELLI source.'),
      options: z
        .object({ max_turns: z.number().int().optional() })
        .optional()
        .describe('Optional settings for MACHIAVELLI.'),
    },
    handlers.convertToManifest,
  );

  // 7. get_taxonomy
  server.tool(
    'get_taxonomy',
    'Look up the Safety Dance taxonomy — valid vocabulary terms for modalities, ' +
      'interaction patterns, timing modes, safety domains, measurement types, and API formats. ' +
      'Omit category to get all.',
    {
      category: z
        .enum([
          'input_modalities',
          'output_modalities',
          'interaction_patterns',
          'timing_modes',
          'safety_domains',
          'measurement_types',
          'api_formats',
        ])
        .optional()
        .describe('Specific category to retrieve. Omit for all categories.'),
    },
    handlers.getTaxonomy,
  );

  // 8. register_model
  server.tool(
    'register_model',
    'Register a custom model capability in the Safety Dance registry for this session. ' +
      'The model becomes available via get_model and check_compatibility lookups.',
    {
      key: z.string().describe('Model key in "provider/model_id" format.'),
      capability: CapabilitySchema,
    },
    handlers.registerModel,
  );
}
