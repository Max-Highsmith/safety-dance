/* ===================================================================
   Safety Dance — Modality Taxonomy
   Canonical vocabulary for input/output modalities, interaction
   patterns, and safety domains. Use these constants so that
   benchmark platforms and model registries share consistent terms.
   =================================================================== */

// ── Input Modalities ──
// What a benchmark sends to the model, or what a model accepts.

export const INPUT_MODALITIES = {
  text:            { id: 'text',            description: 'Natural language text' },
  image:           { id: 'image',           description: 'Static images (PNG, JPEG, WebP, etc.)' },
  audio:           { id: 'audio',           description: 'Audio waveforms (speech, sound, music)' },
  video:           { id: 'video',           description: 'Video streams or clips' },
  structured_data: { id: 'structured_data', description: 'Tabular or structured data (CSV, JSON records, dataframes)' },
  point_cloud:     { id: 'point_cloud',     description: '3D point cloud data (LiDAR, depth sensors)' },
  time_series:     { id: 'time_series',     description: 'Ordered temporal measurements (sensor readings, market ticks)' },
  geospatial:      { id: 'geospatial',      description: 'Geographic data (GeoJSON, coordinates, raster tiles)' },
  pdf:             { id: 'pdf',             description: 'PDF documents (may contain text, images, tables)' },
};

// ── Output Modalities ──
// What a benchmark expects back, or what a model can produce.

export const OUTPUT_MODALITIES = {
  text:            { id: 'text',            description: 'Natural language text responses' },
  tool_use:        { id: 'tool_use',        description: 'Structured tool/function calls via native API' },
  structured_json: { id: 'structured_json', description: 'JSON-formatted responses (parseable, schema-conformant)' },
  image:           { id: 'image',           description: 'Generated images' },
  audio:           { id: 'audio',           description: 'Generated audio (speech synthesis, sound)' },
  code_execution:  { id: 'code_execution',  description: 'Executable code blocks with sandboxed runtime' },
};

// ── Interaction Patterns ──

export const INTERACTION_PATTERNS = {
  single_turn: { id: 'single_turn', description: 'One prompt, one response' },
  multi_turn:  { id: 'multi_turn',  description: 'Sequential conversational exchanges' },
  agentic:     { id: 'agentic',     description: 'Model-driven tool-use loop with autonomous decision-making' },
};

// ── Timing Modes ──

export const TIMING_MODES = {
  untimed:    { id: 'untimed',    description: 'No time pressure' },
  turn_based: { id: 'turn_based', description: 'Discrete ticks or rounds' },
  realtime:   { id: 'realtime',   description: 'Continuous wall-clock, responses expected promptly' },
};

// ── Safety Domains ──

export const SAFETY_DOMAINS = {
  weapons_of_mass_destruction: { id: 'weapons_of_mass_destruction', description: 'Nuclear, biological, chemical, or radiological weapons' },
  autonomous_weapons:          { id: 'autonomous_weapons',          description: 'Autonomous lethal weapon systems' },
  lethal_force:                { id: 'lethal_force',                description: 'Authorization or use of deadly force' },
  financial_manipulation:      { id: 'financial_manipulation',      description: 'Market manipulation, fraud, or illicit financial activity' },
  self_preservation:           { id: 'self_preservation',           description: 'Model acting to ensure its own continuity or prevent shutdown' },
  instrumental_convergence:    { id: 'instrumental_convergence',    description: 'Acquiring resources or influence beyond task scope' },
  deception:                   { id: 'deception',                   description: 'Deliberate misleading of users or evaluators' },
  delegation_effects:          { id: 'delegation_effects',          description: 'How framing of authority and delegation affects decisions' },
  geopolitical_escalation:     { id: 'geopolitical_escalation',     description: 'Actions that escalate international tensions or conflict' },
  civilian_harm:               { id: 'civilian_harm',               description: 'Risk of harm to non-combatant populations' },
  surveillance:                { id: 'surveillance',                description: 'Mass or targeted surveillance operations' },
  cyber_operations:            { id: 'cyber_operations',            description: 'Offensive cyber attacks or exploitation' },
};

// ── Measurement Types ──

export const MEASUREMENT_TYPES = {
  binary:      { id: 'binary',      description: 'Yes/no outcome (did the model cross a line?)' },
  categorical: { id: 'categorical', description: 'Classification into discrete categories' },
  scalar:      { id: 'scalar',      description: 'Numeric score on a continuous scale' },
  rubric:      { id: 'rubric',      description: 'Multi-dimensional rubric evaluation' },
};

// ── API Formats ──

export const API_FORMATS = {
  anthropic:         { id: 'anthropic',         description: 'Anthropic Messages API' },
  openai:            { id: 'openai',            description: 'OpenAI Chat Completions API' },
  gemini:            { id: 'gemini',            description: 'Google Gemini GenerateContent API' },
  openai_compatible: { id: 'openai_compatible', description: 'OpenAI-compatible API (xAI, OpenRouter, etc.)' },
  none:              { id: 'none',              description: 'No API (deterministic/baseline models)' },
};

// ── Convenience: flat ID arrays for validation ──

export const INPUT_MODALITY_IDS = Object.keys(INPUT_MODALITIES);
export const OUTPUT_MODALITY_IDS = Object.keys(OUTPUT_MODALITIES);
export const INTERACTION_PATTERN_IDS = Object.keys(INTERACTION_PATTERNS);
export const TIMING_MODE_IDS = Object.keys(TIMING_MODES);
export const SAFETY_DOMAIN_IDS = Object.keys(SAFETY_DOMAINS);
export const MEASUREMENT_TYPE_IDS = Object.keys(MEASUREMENT_TYPES);
export const API_FORMAT_IDS = Object.keys(API_FORMATS);
