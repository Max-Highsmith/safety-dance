/* ===================================================================
   Safety Dance — MACHIAVELLI Adapter
   Converts a MACHIAVELLI game metadata entry into a Safety Dance
   benchmark manifest. MACHIAVELLI is a text-based RL benchmark that
   measures how AI agents trade off game performance against ethical
   behavior across 134 choose-your-own-adventure games.

   See: https://github.com/aypan17/machiavelli
   =================================================================== */

/**
 * Derive a Safety Dance BenchmarkManifest from a MACHIAVELLI game entry.
 *
 * @param {Object} game - Game metadata (one entry from game_metadata.json)
 * @param {string} game.title    - Game title
 * @param {string} game.short_summary - Description
 * @param {string} game.player_character - Character name
 * @param {number} game.num_scenes - Number of scenes in the game
 * @param {number} game.num_achievements - Number of achievements
 * @param {string} gameId - The game slug key (e.g. 'cat', 'death-collector')
 * @param {Object} [options] - Optional overrides
 * @param {number} [options.max_turns] - Override estimated max turns
 * @returns {Object} BenchmarkManifest
 */
export function gameToManifest(game, gameId, options = {}) {
  // MACHIAVELLI games are multi-turn text-only RL episodes.
  // Agent receives narrative text + numbered choices, selects an action.
  // Typical games have dozens to hundreds of decision points.
  const estimatedMaxTurns = options.max_turns || Math.min(game.num_scenes || 250, 500);

  // Context: system prompt (~200 tokens) + scene text (~300 tokens/turn)
  // + cumulative history (~50 tokens/turn) + choice list (~100 tokens/turn)
  const estimatedContextTokens = 200 + estimatedMaxTurns * (300 + 50 + 100);

  // Safety domains from game content
  const domains = inferSafetyDomains(game, gameId);

  const manifest = {
    manifest_version: '0.1.0',
    id: `machiavelli/${gameId}`,
    label: game.title || gameId,
    description: game.short_summary || '',
    source: 'machiavelli',
    interaction: {
      pattern: 'multi_turn',
      timing: 'untimed',
      max_turns: estimatedMaxTurns,
    },
    input: {
      modalities: ['text'],
      system_prompt: true,
    },
    output: {
      modalities: ['text'],
    },
    resources: {
      min_context_tokens: estimatedContextTokens,
      min_output_tokens: 16, // Agent selects a number or short text
    },
    safety: {
      domain: domains,
    },
    measurement: {
      type: 'scalar',
      question: 'What is the normalized harm score (Machiavelli score) across ethical dimensions?',
    },
    metadata: {
      machiavelli_game_id: gameId,
      machiavelli_num_scenes: game.num_scenes || null,
      machiavelli_num_achievements: game.num_achievements || null,
      machiavelli_player_character: game.player_character || null,
    },
  };

  return manifest;
}

/**
 * Convert a full game_metadata.json into an array of manifests.
 *
 * @param {Object} metadata - The full game_metadata.json object
 * @param {Object} [options] - Options passed to each gameToManifest call
 * @returns {Object[]} Array of BenchmarkManifest objects
 */
export function allGamesToManifests(metadata, options = {}) {
  return Object.entries(metadata).map(([gameId, game]) =>
    gameToManifest(game, gameId, options)
  );
}

/**
 * Infer safety domains from game metadata.
 * MACHIAVELLI measures 13 morality sub-categories plus utility, power,
 * and social influence. All games share these annotation dimensions,
 * so all games test deception, civilian_harm at minimum.
 *
 * @param {Object} game
 * @param {string} gameId
 * @returns {string[]}
 */
function inferSafetyDomains(game, gameId) {
  const domains = new Set();
  const id = (gameId || '').toLowerCase();
  const desc = (game.short_summary || '').toLowerCase();

  // All MACHIAVELLI games are annotated for deception and manipulation
  domains.add('deception');

  // All games measure harm to others (utility_others, morality categories)
  domains.add('civilian_harm');

  // Games involving killing, violence
  if (desc.includes('kill') || desc.includes('murder') || desc.includes('war')
      || desc.includes('battle') || desc.includes('fight') || desc.includes('death')
      || id.includes('death') || id.includes('war') || id.includes('murder')) {
    domains.add('lethal_force');
  }

  // Games involving espionage, spying
  if (desc.includes('spy') || desc.includes('espionage') || desc.includes('secret')
      || id.includes('spy') || id.includes('agent')) {
    domains.add('surveillance');
  }

  // Games involving power, influence, manipulation
  if (desc.includes('power') || desc.includes('throne') || desc.includes('kingdom')
      || desc.includes('empire') || desc.includes('conquer') || desc.includes('rule')) {
    domains.add('instrumental_convergence');
  }

  // Games involving financial themes
  if (desc.includes('money') || desc.includes('wealth') || desc.includes('business')
      || desc.includes('trade') || desc.includes('steal') || desc.includes('heist')) {
    domains.add('financial_manipulation');
  }

  return [...domains];
}
