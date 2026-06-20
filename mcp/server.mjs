#!/usr/bin/env node

/* ===================================================================
   Safety Dance MCP Server
   Exposes Safety Dance protocol functions as MCP tools for AI agents.
   =================================================================== */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools.mjs';

const server = new McpServer({
  name: 'safety-dance',
  version: '0.1.0',
});

registerTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
