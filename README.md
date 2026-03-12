# Safety Dance

A standard protocol for AI safety benchmarks to declare their requirements and AI models to declare their capabilities, enabling compatibility handshakes before evaluation.

## The Problem

There are 200+ AI safety benchmarks and a growing number of multimodal models. Each benchmark has implicit requirements — input modalities, interaction patterns, tool-use support, context window minimums — but there's no machine-readable way to check whether a given model meets them before running an evaluation.

An audio+text safety benchmark paired with a text-only model will simply fail. An agentic evaluation run against a model without tool-use support will produce meaningless results. Today, these incompatibilities are discovered at runtime.

## The Protocol

Safety Dance defines two JSON schemas and a compatibility algorithm:

**Benchmark Manifest** — what a safety evaluation requires:
```json
{
  "manifest_version": "0.1.0",
  "id": "my-benchmark/scenario-1",
  "interaction": {
    "pattern": "agentic",
    "timing": "untimed",
    "max_turns": 50
  },
  "input": {
    "modalities": ["text", "audio"],
    "system_prompt": true
  },
  "output": {
    "modalities": ["text", "tool_use"],
    "structured_format": "action_confidence_reasoning"
  },
  "resources": {
    "min_context_tokens": 50000,
    "tool_count": 8
  },
  "safety": {
    "domain": ["lethal_force", "geopolitical_escalation"]
  },
  "measurement": {
    "type": "binary",
    "question": "Did the agent authorize lethal force?"
  }
}
```

**Model Capability** — what a model provides:
```json
{
  "manifest_version": "0.1.0",
  "model_id": "claude-opus-4-6",
  "provider": "anthropic",
  "api_format": "anthropic",
  "interaction": {
    "patterns": ["single_turn", "multi_turn", "agentic"],
    "timings": ["untimed", "turn_based", "realtime"]
  },
  "input": {
    "modalities": ["text", "image"],
    "system_prompt": true
  },
  "output": {
    "modalities": ["text", "tool_use", "structured_json"]
  },
  "resources": {
    "context_window_tokens": 200000,
    "max_output_tokens": 32000,
    "max_tool_count": 128
  }
}
```

**Compatibility Check** — the handshake:
```js
import { checkCompatibility } from 'safety-dance';

const result = checkCompatibility(manifest, capability);
// {
//   compatible: false,
//   blocking: ["Model does not support required input modality: audio"],
//   warnings: [],
//   info: ["Model has additional input modalities: image"],
//   breakdown: { input_modalities: 'fail', output_modalities: 'pass', ... }
// }
```

## Compatibility Rules

Three-tier classification:

| Tier | Meaning | Examples |
|------|---------|---------|
| **Blocking** | Cannot run at all | Missing input modality, agentic needs tool_use, context window too small |
| **Warning** | Runs but degraded | Missing structured_json (text fallback), no system prompt, tight context margin |
| **Info** | Noted, no impact | Superset capabilities, token budget info |

Key rules:
- Every required input modality must exist in model capabilities
- `tool_use` is blocking for `agentic` pattern, warning for `multi_turn`
- `single_turn` is a subset of `multi_turn` is a subset of `agentic` (compatible supersets)
- Context window below requirement is blocking; below 80% margin is warning

## Quick Start

```js
import {
  checkCompatibility,
  getModelCapability,
  validateManifest,
  validateCapability,
} from 'safety-dance';

// Look up a known model
const claude = getModelCapability('anthropic', 'claude-opus-4-6');
const gpt4o = getModelCapability('openai', 'gpt-4o');

// Your benchmark manifest
const manifest = {
  manifest_version: '0.1.0',
  id: 'my-benchmark',
  interaction: { pattern: 'multi_turn', timing: 'turn_based' },
  input: { modalities: ['text'] },
  output: { modalities: ['text'] },
};

// Check compatibility
const result = checkCompatibility(manifest, claude);
console.log(result.compatible); // true
console.log(result.blocking);   // []
```

## Model Registry

Pre-populated capabilities for known models:

| Key | Input | Output | Patterns | Context |
|-----|-------|--------|----------|---------|
| `anthropic/claude-opus-4-6` | text, image | text, tool_use, json | all | 200K |
| `anthropic/claude-sonnet-4-5-20250929` | text, image | text, tool_use, json | all | 200K |
| `openai/gpt-4o` | text, image, audio | text, tool_use, json | all | 128K |
| `openai/gpt-4.1` | text, image | text, tool_use, json | all | 1M |
| `google/gemini-2.5-pro` | text, image, audio, video | text, tool_use, json | all | 1M |
| `xai/grok-4` | text, image | text, tool_use, json | all | 131K |
| `baseline/always-hold` | text | text | single, multi | N/A |
| `baseline/always-launch` | text | text | single, multi | N/A |

Register custom models:
```js
import { registerModel } from 'safety-dance';

registerModel('custom/my-model', {
  manifest_version: '0.1.0',
  model_id: 'my-model',
  provider: 'custom',
  interaction: { patterns: ['single_turn', 'multi_turn'] },
  input: { modalities: ['text'] },
  output: { modalities: ['text'] },
  resources: { context_window_tokens: 32000 },
});
```

## Writing an Adapter

Adapters convert benchmark-specific scenario formats into Safety Dance manifests. See `adapters/panopticon.mjs` for a full example.

```js
// adapters/my-benchmark.mjs
export function scenarioToManifest(scenario) {
  return {
    manifest_version: '0.1.0',
    id: scenario.id,
    source: 'my-benchmark',
    interaction: {
      pattern: scenario.multi_turn ? 'multi_turn' : 'single_turn',
      timing: scenario.timed ? 'realtime' : 'untimed',
    },
    input: {
      modalities: scenario.uses_images ? ['text', 'image'] : ['text'],
      system_prompt: true,
    },
    output: {
      modalities: scenario.needs_tools ? ['text', 'tool_use'] : ['text'],
    },
  };
}
```

## Panopticon Adapter

The included panopticon adapter auto-derives manifests from [Panopticon](https://github.com/Max-Highsmith/panopticon) wargame scenario JSONs:

```js
import { scenarioToManifest, providerToCapability } from 'safety-dance/adapters/panopticon';
import { checkCompatibility } from 'safety-dance';

// Load a panopticon scenario
const scenario = JSON.parse(fs.readFileSync('scenarios/nuke-retaliation.json'));

// Derive manifest (no manual annotation needed)
const manifest = scenarioToManifest(scenario);
// → { pattern: 'multi_turn', timing: 'turn_based', modalities: ['text'], ... }

// Check if a model is compatible
const claude = providerToCapability('anthropic', 'claude-opus-4-6');
const result = checkCompatibility(manifest, claude);
// → { compatible: true, blocking: [], warnings: [] }

const baseline = providerToCapability('baseline', 'always-hold');
const agenticResult = checkCompatibility(
  scenarioToManifest(agenticScenario),
  baseline
);
// → { compatible: false, blocking: ["Model does not support tool_use..."] }
```

Mapping from panopticon fields:

| Panopticon | Safety Dance |
|-----------|--------------|
| `execution_mode: "agentic"` | `interaction.pattern: "agentic"` |
| `execution_mode: "turn_based"` | `interaction.pattern: "multi_turn", timing: "turn_based"` |
| `execution_mode: "realtime"` | `interaction.pattern: "multi_turn", timing: "realtime"` |
| `response_format: "json"` | `output.modalities` includes `"structured_json"` |
| `tools` / `monitors` defined | `output.modalities` includes `"tool_use"` |
| `navigation: true` | `output.modalities` includes `"structured_json"` |
| `framings.delegated` / `.advisory` | `safety.domain` includes `"delegation_effects"` |

## JSON Schemas

Machine-readable schemas for validation:

- `schema/benchmark-manifest.schema.json`
- `schema/model-capability.schema.json`

## Tests

```bash
npm test
```

Unit tests for the compatibility checker and adapter run without any external dependencies.

Integration tests against real panopticon scenarios run automatically when a panopticon clone is available. Set the `PANOPTICON_DIR` environment variable to point at the `scenarios/` directory:

```bash
git clone https://github.com/Max-Highsmith/panopticon.git ../panopticon
PANOPTICON_DIR=../panopticon/scenarios npm test
```

If panopticon is not available, integration tests are skipped gracefully.

## Contributing

To add a new adapter for your benchmark framework:

1. Create `adapters/my-benchmark.mjs` with a `scenarioToManifest()` function
2. Add tests in `test/my-benchmark-adapter.test.mjs`
3. Submit a PR

To add a new model to the registry, add an entry to `lib/registry.mjs`.

## License

MIT — see [LICENSE](LICENSE).
