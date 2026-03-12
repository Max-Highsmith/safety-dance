/* ===================================================================
   Safety Dance — HarmBench Adapter
   Converts HarmBench behavior CSV rows into Safety Dance benchmark
   manifests. HarmBench is a standardized evaluation framework for
   automated red teaming, containing 400+ behaviors across text and
   multimodal modalities with binary attack success measurement.

   See: https://github.com/centerforaisafety/HarmBench
   =================================================================== */

/**
 * Semantic category → Safety Dance domain mapping.
 * HarmBench categories don't map 1:1; some map to multiple domains.
 */
const CATEGORY_TO_DOMAINS = {
  chemical_biological: ['weapons_of_mass_destruction'],
  cybercrime_intrusion: ['cyber_operations'],
  harassment_bullying: ['civilian_harm'],
  harmful: ['civilian_harm'],
  illegal: ['civilian_harm'],
  misinformation_disinformation: ['deception'],
  copyright: [], // No direct safety domain; tracked in metadata
};

/**
 * Derive a Safety Dance BenchmarkManifest from a single HarmBench behavior row.
 *
 * @param {Object} behavior - A parsed CSV row from harmbench_behaviors_*.csv
 * @param {string} behavior.Behavior         - The harmful behavior description
 * @param {string} behavior.BehaviorID       - Unique identifier (snake_case)
 * @param {string} behavior.FunctionalCategory - 'standard' | 'contextual' | 'copyright' | 'multimodal'
 * @param {string} behavior.SemanticCategory - Harm category
 * @param {string} [behavior.Tags]           - Comma-separated tags
 * @param {string} [behavior.ContextString]  - Additional context for contextual behaviors
 * @param {string} [behavior.ImageFileName]  - Image filename for multimodal behaviors
 * @returns {Object} BenchmarkManifest
 */
export function behaviorToManifest(behavior) {
  const isMultimodal = behavior.FunctionalCategory === 'multimodal';
  const isContextual = behavior.FunctionalCategory === 'contextual';
  const tags = (behavior.Tags || '').split(',').map(t => t.trim()).filter(Boolean);

  // Input modalities
  const inputModalities = ['text'];
  if (isMultimodal) {
    inputModalities.push('image');
  }

  // Safety domains
  const domains = CATEGORY_TO_DOMAINS[behavior.SemanticCategory] || [];

  // Context token estimation
  // Base prompt: ~50 tokens. Context string: ~500 tokens when present.
  // Multimodal: image tokens vary but typically ~300-1000.
  let estimatedContextTokens = 100;
  if (isContextual && behavior.ContextString) {
    estimatedContextTokens += Math.ceil(behavior.ContextString.length / 4);
  }

  const manifest = {
    manifest_version: '0.1.0',
    id: `harmbench/${behavior.BehaviorID}`,
    label: behavior.BehaviorID.replace(/_/g, ' '),
    description: behavior.Behavior,
    source: 'harmbench',
    interaction: {
      pattern: 'single_turn',
      timing: 'untimed',
    },
    input: {
      modalities: inputModalities,
      system_prompt: false,
    },
    output: {
      modalities: ['text'],
    },
    resources: {
      min_context_tokens: estimatedContextTokens,
      min_output_tokens: 512,
    },
    safety: {
      domain: domains,
    },
    measurement: {
      type: 'binary',
      question: 'Did the model exhibit the harmful behavior?',
    },
    metadata: {
      harmbench_functional_category: behavior.FunctionalCategory,
      harmbench_semantic_category: behavior.SemanticCategory,
      harmbench_tags: tags,
      harmbench_has_context: isContextual,
      harmbench_has_image: isMultimodal,
    },
  };

  if (isMultimodal && behavior.ImageFileName) {
    manifest.metadata.harmbench_image_file = behavior.ImageFileName;
  }

  return manifest;
}

/**
 * Convert an array of HarmBench behavior rows into manifests.
 *
 * @param {Object[]} behaviors - Array of parsed CSV rows
 * @returns {Object[]} Array of BenchmarkManifest objects
 */
export function allBehaviorsToManifests(behaviors) {
  return behaviors.map(b => behaviorToManifest(b));
}

/**
 * Parse a HarmBench CSV string into behavior objects.
 * Handles the standard CSV format with quoted fields.
 *
 * @param {string} csvText - Raw CSV text
 * @returns {Object[]} Parsed behavior rows
 */
export function parseHarmBenchCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < headers.length) continue;
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Parse a single CSV line, handling quoted fields with commas.
 * @param {string} line
 * @returns {string[]}
 */
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}
