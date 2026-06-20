import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const CLI_PATH = join(process.cwd(), 'bin/safety-dance.mjs');

function runCli(args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

function writeJson(dir, name, value) {
  const filePath = join(dir, name);
  writeFileSync(filePath, JSON.stringify(value, null, 2));
  return filePath;
}

describe('CLI', () => {
  it('lists bundled models', () => {
    const result = runCli(['models']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /anthropic\/claude-opus-4-6/);
  });

  it('validates a manifest file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'safety-dance-cli-'));
    const manifestPath = writeJson(dir, 'manifest.json', {
      manifest_version: '0.1.0',
      id: 'cli/test-manifest',
      interaction: { pattern: 'multi_turn', timing: 'turn_based' },
      input: { modalities: ['text'] },
      output: { modalities: ['text'] },
    });

    const result = runCli(['validate', 'manifest', manifestPath]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /"valid": true/);
  });

  it('returns a non-zero exit code for incompatible checks', () => {
    const dir = mkdtempSync(join(tmpdir(), 'safety-dance-cli-'));
    const manifestPath = writeJson(dir, 'manifest.json', {
      manifest_version: '0.1.0',
      id: 'cli/audio-test',
      interaction: { pattern: 'multi_turn', timing: 'turn_based' },
      input: { modalities: ['text', 'audio'] },
      output: { modalities: ['text'] },
    });

    const result = runCli(['check', manifestPath, 'anthropic/claude-opus-4-6']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /"compatible": false/);
    assert.match(result.stdout, /audio/);
  });
});
