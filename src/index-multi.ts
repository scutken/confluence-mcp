#!/usr/bin/env bun
import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { randomUUID } from 'crypto';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { ConfluenceApiService } from './services/confluence-api.js';
import { setupToolHandlers } from './shared/tool-handlers.js';

declare module 'bun' {
  interface Env {
    CONFLUENCE_API_TOKEN: string;
    CONFLUENCE_BASE_URL: string;
    MCP_TRANSPORT?: 'stdio' | 'sse' | 'streamable-http';
    MCP_PORT?: string;
    MCP_HOST?: string;
  }
}

const CONFLUENCE_API_TOKEN = process.env.CONFLUENCE_API_TOKEN;
const CONFLUENCE_BASE_URL = process.env.CONFLUENCE_BASE_URL;
const MCP_TRANSPORT = process.env.MCP_TRANSPORT || 'stdio';
const MCP_PORT = parseInt(process.env.MCP_PORT || '3000');
const MCP_HOST = process.env.MCP_HOST || 'localhost';

if (!CONFLUENCE_API_TOKEN || !CONFLUENCE_BASE_URL) {
  throw new Error(
    'CONFLUENCE_API_TOKEN and CONFLUENCE_BASE_URL environment variables are required'
  );
}

class ConfluenceServer {
  private server: Server;
  private confluenceApi: ConfluenceApiService;

  constructor() {
    this.server = new Server(
      {
        name: 'confluence-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.confluenceApi = new ConfluenceApiService(CONFLUENCE_BASE_URL, CONFLUENCE_API_TOKEN);

    setupToolHandlers(this.server, this.confluenceApi);

    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async runStdio() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Confluence MCP server running on stdio');
  }

  async runSSE() {
    const app = express();
    app.use(express.json());

    let transport: SSEServerTransport | null = null;

    // SSE endpoint for establishing the connection
    app.get('/sse', (req, res) => {
      transport = new SSEServerTransport('/messages', res);
      this.server.connect(transport);
      console.error(`Confluence MCP server running on SSE at http://${MCP_HOST}:${MCP_PORT}/sse`);
    });

    // POST endpoint for receiving messages
    app.post('/messages', async (req, res) => {
      if (transport) {
        await transport.handlePostMessage(req, res, req.body);
      } else {
        res.status(400).json({ error: 'SSE connection not established' });
      }
    });

    app.listen(MCP_PORT, MCP_HOST, () => {
      console.error(`HTTP server listening on http://${MCP_HOST}:${MCP_PORT}`);
      console.error('Connect to SSE endpoint: GET /sse');
      console.error('Send messages to: POST /messages');
    });
  }

  async runStreamableHTTP() {
    const app = express();
    app.use(express.json());

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        console.error(`New session initialized: ${sessionId}`);
      },
    });

    await this.server.connect(transport);

    // Single endpoint for all MCP communication
    app.all('/mcp', async (req, res) => {
      await transport.handleRequest(req, res, req.body);
    });

    app.listen(MCP_PORT, MCP_HOST, () => {
      console.error(
        `Confluence MCP server running on Streamable HTTP at http://${MCP_HOST}:${MCP_PORT}/mcp`
      );
      console.error('Supports both GET (SSE) and POST (JSON-RPC) requests');
    });
  }

  async run() {
    console.error(`Starting Confluence MCP server with transport: ${MCP_TRANSPORT}`);

    switch (MCP_TRANSPORT) {
      case 'stdio':
        await this.runStdio();
        break;
      case 'sse':
        await this.runSSE();
        break;
      case 'streamable-http':
        await this.runStreamableHTTP();
        break;
      default:
        throw new Error(`Unsupported transport: ${MCP_TRANSPORT}`);
    }
  }
}

const server = new ConfluenceServer();
server.run().catch(console.error);
