import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gameToManifest, allGamesToManifests } from '../adapters/machiavelli.mjs';
import { validateManifest } from '../lib/validate.mjs';
import { checkCompatibility, getModelCapability } from '../index.mjs';

// ═══════════════════════════════════════════════════════
// ADAPTER: gameToManifest
// ═══════════════════════════════════════════════════════

describe('machiavelli adapter — gameToManifest', () => {
  const sampleGame = {
    title: 'Choice of the Cat',
    short_summary: 'You are a housecat, living with a family on the brink of divorce.',
    player_character: 'Stinky',
    num_scenes: 247,
    num_achievements: 42,
  };

  it('converts a game entry to a valid manifest', () => {
    const manifest = gameToManifest(sampleGame, 'cat');
    assert.equal(manifest.manifest_version, '0.1.0');
    assert.equal(manifest.id, 'machiavelli/cat');
    assert.equal(manifest.source, 'machiavelli');
    assert.equal(manifest.label, 'Choice of the Cat');
    assert.equal(manifest.interaction.pattern, 'multi_turn');
    assert.equal(manifest.interaction.timing, 'untimed');
    assert.deepEqual(manifest.input.modalities, ['text']);
    assert.deepEqual(manifest.output.modalities, ['text']);
    assert.equal(manifest.measurement.type, 'scalar');

    const validation = validateManifest(manifest);
    assert.equal(validation.valid, true, `Validation errors: ${validation.errors.join(', ')}`);
  });

  it('sets max_turns from num_scenes', () => {
    const manifest = gameToManifest(sampleGame, 'cat');
    assert.equal(manifest.interaction.max_turns, 247);
  });

  it('caps max_turns at 500', () => {
    const bigGame = { ...sampleGame, num_scenes: 800 };
    const manifest = gameToManifest(bigGame, 'big-game');
    assert.equal(manifest.interaction.max_turns, 500);
  });

  it('allows max_turns override', () => {
    const manifest = gameToManifest(sampleGame, 'cat', { max_turns: 100 });
    assert.equal(manifest.interaction.max_turns, 100);
  });

  it('infers deception and civilian_harm for all games', () => {
    const manifest = gameToManifest(sampleGame, 'cat');
    assert.ok(manifest.safety.domain.includes('deception'));
    assert.ok(manifest.safety.domain.includes('civilian_harm'));
  });

  it('infers lethal_force from war-themed games', () => {
    const warGame = {
      title: 'War of the Roses',
      short_summary: 'Lead your army into battle and fight for the throne.',
      num_scenes: 300,
    };
    const manifest = gameToManifest(warGame, 'war-roses');
    assert.ok(manifest.safety.domain.includes('lethal_force'));
    assert.ok(manifest.safety.domain.includes('instrumental_convergence'));
  });

  it('preserves metadata', () => {
    const manifest = gameToManifest(sampleGame, 'cat');
    assert.equal(manifest.metadata.machiavelli_game_id, 'cat');
    assert.equal(manifest.metadata.machiavelli_num_scenes, 247);
    assert.equal(manifest.metadata.machiavelli_player_character, 'Stinky');
  });
});

// ═══════════════════════════════════════════════════════
// ADAPTER: allGamesToManifests
// ═══════════════════════════════════════════════════════

describe('machiavelli adapter — allGamesToManifests', () => {
  it('converts multiple games', () => {
    const metadata = {
      cat: { title: 'Cat', short_summary: 'Be a cat.', num_scenes: 100 },
      dragon: { title: 'Dragon', short_summary: 'Be a dragon that kills.', num_scenes: 200 },
    };
    const manifests = allGamesToManifests(metadata);
    assert.equal(manifests.length, 2);
    assert.equal(manifests[0].id, 'machiavelli/cat');
    assert.equal(manifests[1].id, 'machiavelli/dragon');
    for (const m of manifests) {
      const v = validateManifest(m);
      assert.equal(v.valid, true, `${m.id}: ${v.errors.join(', ')}`);
    }
  });
});

// ═══════════════════════════════════════════════════════
// COMPATIBILITY: text-only multi-turn → all LLMs compatible
// ═══════════════════════════════════════════════════════

describe('machiavelli adapter — compatibility', () => {
  const game = {
    title: 'Test Game',
    short_summary: 'A test.',
    num_scenes: 50,
  };

  it('all major LLMs are compatible (text-only multi-turn)', () => {
    const manifest = gameToManifest(game, 'test-game');
    for (const [provider, modelId] of [
      ['anthropic', 'claude-opus-4-6'],
      ['openai', 'gpt-4o'],
      ['google', 'gemini-2.5-pro'],
    ]) {
      const cap = getModelCapability(provider, modelId);
      const result = checkCompatibility(manifest, cap);
      assert.equal(result.compatible, true, `${provider}/${modelId}: ${result.blocking.join(', ')}`);
    }
  });

  it('baseline models are compatible (text-only)', () => {
    const manifest = gameToManifest(game, 'test-game');
    const baseline = getModelCapability('baseline', 'always-hold');
    const result = checkCompatibility(manifest, baseline);
    assert.equal(result.compatible, true);
  });
});
