/* ===================================================================
   Safety Dance MCP Server — Tests
   Uses the MCP client SDK to test the server end-to-end over stdio.
   Skipped automatically if @modelcontextprotocol/sdk is not installed.
   =================================================================== */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

let Client, StdioClientTransport, client;

// Skip all tests if the MCP SDK is not available.
try {
  ({ Client } = await import('@modelcontextprotocol/sdk/client/index.js'));
  ({ StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js'));
} catch {
  describe('MCP Server (skipped — SDK not installed)', () => {
    it('requires @modelcontextprotocol/sdk', () => {});
  });
  // Force exit so the skipped suite doesn't hang.
  process.exit(0);
}

describe('MCP Server', () => {
  before(async () => {
    const transport = new StdioClientTransport({
      command: 'node',
      args: ['mcp/server.mjs'],
    });
    client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(transport);
  });

  after(async () => {
    await client.close();
  });

  // -----------------------------------------------------------------------
  // Tool listing
  // -----------------------------------------------------------------------

  it('registers all 8 tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      'build_report',
      'check_compatibility',
      'compute_aggregation',
      'convert_to_manifest',
      'get_model',
      'get_taxonomy',
      'register_model',
      'validate',
    ]);
  });

  // -----------------------------------------------------------------------
  // check_compatibility
  // -----------------------------------------------------------------------

  describe('check_compatibility', () => {
    const textManifest = {
      manifest_version: '0.1.0',
      id: 'test/text-only',
      interaction: { pattern: 'multi_turn', timing: 'untimed' },
      input: { modalities: ['text'] },
      output: { modalities: ['text'] },
    };

    it('returns compatible for matching model', async () => {
      const res = await client.callTool({
        name: 'check_compatibility',
        arguments: { manifest: textManifest, provider: 'anthropic', model_id: 'claude-opus-4-6' },
      });
      const data = JSON.parse(res.content[0].text);
      assert.equal(data.compatible, true);
      assert.equal(data.blocking.length, 0);
    });

    it('returns blocking for missing input modality', async () => {
      const res = await client.callTool({
        name: 'check_compatibility',
        arguments: {
          manifest: {
            ...textManifest,
            id: 'test/audio',
            input: { modalities: ['text', 'audio'] },
          },
          provider: 'anthropic',
          model_id: 'claude-opus-4-6',
        },
      });
      const data = JSON.parse(res.content[0].text);
      assert.equal(data.compatible, false);
      assert.ok(data.blocking.some((b) => b.includes('audio')));
    });

    it('accepts a full capability object', async () => {
      const res = await client.callTool({
        name: 'check_compatibility',
        arguments: {
          manifest: textManifest,
          capability: {
            manifest_version: '0.1.0',
            model_id: 'custom-model',
            provider: 'custom',
            interaction: { patterns: ['single_turn', 'multi_turn'] },
            input: { modalities: ['text'] },
            output: { modalities: ['text'] },
          },
        },
      });
      const data = JSON.parse(res.content[0].text);
      assert.equal(data.compatible, true);
    });

    it('returns error for unknown model', async () => {
      const res = await client.callTool({
        name: 'check_compatibility',
        arguments: { manifest: textManifest, provider: 'unknown', model_id: 'nope' },
      });
      assert.equal(res.isError, true);
    });
  });

  // -----------------------------------------------------------------------
  // get_model
  // -----------------------------------------------------------------------

  describe('get_model', () => {
    it('lists all registered models', async () => {
      const res = await client.callTool({
        name: 'get_model',
        arguments: { action: 'list' },
      });
      const data = JSON.parse(res.content[0].text);
      assert.ok(Array.isArray(data));
      assert.ok(data.includes('anthropic/claude-opus-4-6'));
      assert.ok(data.length >= 8);
    });

    it('gets a specific model capability', async () => {
      const res = await client.callTool({
        name: 'get_model',
        arguments: { action: 'get', provider: 'anthropic', model_id: 'claude-opus-4-6' },
      });
      const data = JSON.parse(res.content[0].text);
      assert.equal(data.model_id, 'claude-opus-4-6');
      assert.ok(data.input.modalities.includes('text'));
    });

    it('returns error for unknown model', async () => {
      const res = await client.callTool({
        name: 'get_model',
        arguments: { action: 'get', provider: 'nope', model_id: 'nope' },
      });
      assert.equal(res.isError, true);
    });
  });

  // -----------------------------------------------------------------------
  // validate
  // -----------------------------------------------------------------------

  describe('validate', () => {
    it('validates a correct manifest', async () => {
      const res = await client.callTool({
        name: 'validate',
        arguments: {
          type: 'manifest',
          document: {
            manifest_version: '0.1.0',
            id: 'test',
            interaction: { pattern: 'single_turn', timing: 'untimed' },
            input: { modalities: ['text'] },
            output: { modalities: ['text'] },
          },
        },
      });
      const data = JSON.parse(res.content[0].text);
      assert.equal(data.valid, true);
      assert.equal(data.errors.length, 0);
    });

    it('reports errors for invalid manifest', async () => {
      const res = await client.callTool({
        name: 'validate',
        arguments: {
          type: 'manifest',
          document: { manifest_version: '0.1.0' },
        },
      });
      const data = JSON.parse(res.content[0].text);
      assert.equal(data.valid, false);
      assert.ok(data.errors.length > 0);
    });
  });

  // -----------------------------------------------------------------------
  // compute_aggregation
  // -----------------------------------------------------------------------

  describe('compute_aggregation', () => {
    it('computes binary aggregation', async () => {
      const res = await client.callTool({
        name: 'compute_aggregation',
        arguments: {
          measurement_type: 'binary',
          samples: [
            { sample_id: 'r1', outcome: true, score: 1 },
            { sample_id: 'r2', outcome: false, score: 0 },
            { sample_id: 'r3', outcome: true, score: 1 },
          ],
        },
      });
      const data = JSON.parse(res.content[0].text);
      assert.equal(data.count, 3);
      assert.ok(Math.abs(data.pass_rate - 0.6667) < 0.01);
    });
  });

  // -----------------------------------------------------------------------
  // convert_to_manifest
  // -----------------------------------------------------------------------

  describe('convert_to_manifest', () => {
    it('converts a HarmBench behavior', async () => {
      const res = await client.callTool({
        name: 'convert_to_manifest',
        arguments: {
          source: 'harmbench',
          data: {
            Behavior: 'Test behavior',
            BehaviorID: 'test_id',
            FunctionalCategory: 'standard',
            SemanticCategory: 'harmful',
          },
        },
      });
      const data = JSON.parse(res.content[0].text);
      assert.equal(data.id, 'harmbench/test_id');
      assert.equal(data.interaction.pattern, 'single_turn');
    });

    it('converts an Inspect AI task', async () => {
      const res = await client.callTool({
        name: 'convert_to_manifest',
        arguments: {
          source: 'inspect',
          data: {
            name: 'cyber_ctf',
            description: 'Capture the flag',
            solver: { type: 'basic_agent', tools: ['bash', 'python'] },
            scorer: { type: 'exact' },
            message_limit: 20,
          },
        },
      });
      const data = JSON.parse(res.content[0].text);
      assert.equal(data.interaction.pattern, 'agentic');
      assert.ok(data.output.modalities.includes('tool_use'));
    });

    it('returns error for MACHIAVELLI without game_id', async () => {
      const res = await client.callTool({
        name: 'convert_to_manifest',
        arguments: {
          source: 'machiavelli',
          data: { title: 'Test', num_scenes: 100 },
        },
      });
      assert.equal(res.isError, true);
    });
  });

  // -----------------------------------------------------------------------
  // get_taxonomy
  // -----------------------------------------------------------------------

  describe('get_taxonomy', () => {
    it('returns all categories when no category specified', async () => {
      const res = await client.callTool({
        name: 'get_taxonomy',
        arguments: {},
      });
      const data = JSON.parse(res.content[0].text);
      assert.ok(data.input_modalities);
      assert.ok(data.output_modalities);
      assert.ok(data.safety_domains);
    });

    it('returns a specific category', async () => {
      const res = await client.callTool({
        name: 'get_taxonomy',
        arguments: { category: 'measurement_types' },
      });
      const data = JSON.parse(res.content[0].text);
      assert.ok(data.binary);
      assert.ok(data.scalar);
    });
  });

  // -----------------------------------------------------------------------
  // register_model
  // -----------------------------------------------------------------------

  describe('register_model', () => {
    it('registers a custom model and makes it available', async () => {
      const res = await client.callTool({
        name: 'register_model',
        arguments: {
          key: 'test/custom-model',
          capability: {
            manifest_version: '0.1.0',
            model_id: 'custom-model',
            provider: 'test',
            interaction: { patterns: ['single_turn'] },
            input: { modalities: ['text'] },
            output: { modalities: ['text'] },
          },
        },
      });
      const data = JSON.parse(res.content[0].text);
      assert.equal(data.registered, 'test/custom-model');

      // Verify it shows up in the model list
      const list = await client.callTool({
        name: 'get_model',
        arguments: { action: 'list' },
      });
      const models = JSON.parse(list.content[0].text);
      assert.ok(models.includes('test/custom-model'));
    });
  });

  // -----------------------------------------------------------------------
  // build_report
  // -----------------------------------------------------------------------

  describe('build_report', () => {
    it('builds a report with auto-aggregation', async () => {
      const res = await client.callTool({
        name: 'build_report',
        arguments: {
          manifest: {
            manifest_version: '0.1.0',
            id: 'test/report',
            interaction: { pattern: 'single_turn', timing: 'untimed' },
            input: { modalities: ['text'] },
            output: { modalities: ['text'] },
          },
          capability: {
            manifest_version: '0.1.0',
            model_id: 'claude-opus-4-6',
            provider: 'anthropic',
            interaction: { patterns: ['single_turn', 'multi_turn', 'agentic'] },
            input: { modalities: ['text', 'image'] },
            output: { modalities: ['text', 'tool_use', 'structured_json'] },
          },
          run: { runner: 'test-runner@1.0.0' },
          results: {
            measurement_type: 'binary',
            passed: true,
            primary_score: 0.8,
            samples: [
              { sample_id: 'r1', outcome: true, score: 1 },
              { sample_id: 'r2', outcome: false, score: 0 },
            ],
          },
        },
      });
      const data = JSON.parse(res.content[0].text);
      assert.equal(data.report_version, '0.1.0');
      assert.equal(data.compatibility.compatible, true);
      assert.ok(data.results.aggregation);
      assert.equal(data.results.aggregation.count, 2);
      assert.equal(data.results.aggregation.pass_rate, 0.5);
    });
  });
});
