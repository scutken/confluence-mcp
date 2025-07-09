# Confluence MCP

> > This project is a fork of [confluence-mcp](https://github.com/cosmix/confluence-mcp) created by [Dimosthenis Kaponis](https://github.com/cosmix).

<!-- markdownlint-disable MD033 -->
<div align="center">
  <strong>🇨🇳 中文</strong> | <a href="README_EN.md">🇺🇸 English</a>
</div>

A Model Context Protocol (MCP) server for Confluence, enabling AI assistants to interact with Confluence content through a standardized interface.

## Table of Contents

- [Confluence MCP](#confluence-mcp)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
    - [Transport Methods](#transport-methods)
    - [Authentication Method](#authentication-method)
      - [Getting an API Token](#getting-an-api-token)
      - [Environment Variables](#environment-variables)
        - [Method 1: Using .env file (Recommended)](#method-1-using-env-file-recommended)
        - [Method 2: Direct Environment Variables](#method-2-direct-environment-variables)
    - [Deployment Methods](#deployment-methods)
      - [1. Stdio Mode (Default)](#1-stdio-mode-default)
      - [2. SSE Mode](#2-sse-mode)
      - [3. Streamable HTTP Mode (Recommended)](#3-streamable-http-mode-recommended)
  - [Development](#development)
  - [Available Tools](#available-tools)
    - [get_page](#get_page)
    - [search_pages](#search_pages)
    - [get_spaces](#get_spaces)
    - [create_page](#create_page)
    - [update_page](#update_page)
    - [get_comments](#get_comments)
    - [add_comment](#add_comment)
    - [get_attachments](#get_attachments)
    - [add_attachment](#add_attachment)
  - [Read-Only Mode](#read-only-mode)
    - [Allowed Operations](#allowed-operations)
    - [Blocked Operations](#blocked-operations)
    - [Read-Only Mode Usage Example](#read-only-mode-usage-example)
  - [License](#license)

## Features

- Authenticate to Confluence using a personal API token
- Retrieve and search Confluence pages and spaces
- Create and update Confluence content
- Retrieve and add comments to pages
- Retrieve and add attachments to pages
- Clean and transform Confluence content for AI consumption
- Handle API communication, error handling, and data transformation
- Basic rate limiting to prevent API abuse

## Prerequisites

- [Bun](https://bun.sh) (v1.0.0 or higher)
- Confluence account with API access
- Tested based on Atlassian Confluence 7.13.8

## Installation

```bash
# Clone the repository
git clone https://github.com/cosmix/confluence-mcp.git
cd confluence-mcp

# Install dependencies
bun install

# Build the project windows
bun run build
# linux or macOS
bun run build-unix
```

## Configuration

### Transport Methods

This project supports multiple MCP transport methods:

1. **stdio** - Standard Input/Output (default)
2. **sse** - Server-Sent Events + HTTP POST
3. **streamable-http** - Streamable HTTP (recommended for web deployment)

### Authentication Method

This project uses **Bearer Token** authentication to access the Confluence Cloud REST API, which is a secure and simple authentication method.

#### Getting an API Token

1. Visit the [Atlassian API Tokens management page](https://id.atlassian.com/manage/api-tokens)
2. Click "Create API token"
3. Enter a descriptive label (e.g., "Confluence MCP Server")
4. Click "Create" and copy the generated token
5. **Important**: Please save this token securely, it will only be displayed once

#### Environment Variables

To use this MCP server, you need to set the following environment variables.

##### Method 1: Using .env file (Recommended)

1. Copy the example configuration file:

   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file with your configuration:

```env
# Required configuration
CONFLUENCE_API_TOKEN=your_api_token
CONFLUENCE_BASE_URL=your_confluence_instance_url  # e.g., https://your-domain.atlassian.net/wiki

# Permission control configuration (optional)
CONFLUENCE_READ_ONLY_MODE=false  # Read-only mode (default: false)

# Transport configuration (optional)
MCP_TRANSPORT=stdio  # Options: stdio (default), sse, streamable-http
MCP_PORT=3000        # HTTP server port (for sse and streamable-http only)
MCP_HOST=localhost   # HTTP server host (for sse and streamable-http only)
```

##### Method 2: Direct Environment Variables

You can also set environment variables directly in the command line:

```bash
export CONFLUENCE_API_TOKEN=your_api_token
export CONFLUENCE_BASE_URL=https://your-domain.atlassian.net/wiki
export CONFLUENCE_READ_ONLY_MODE=false
export MCP_TRANSPORT=stdio
```

**Parameter Description:**

- `CONFLUENCE_API_TOKEN`: API token generated from your Atlassian account
- `CONFLUENCE_BASE_URL`: Your Confluence instance URL, must include the `/wiki` path
- `CONFLUENCE_READ_ONLY_MODE`: Read-only mode toggle, when set to `true` only allows read operations and adding comments, blocks create/update pages and add attachments
- `MCP_TRANSPORT`: Transport method, defaults to `stdio`
- `MCP_PORT`: HTTP server port, defaults to `3000`
- `MCP_HOST`: HTTP server host, defaults to `localhost`

### Deployment Methods

#### 1. Stdio Mode (Default)

Suitable for local integrations and command-line tools:

```bash
# Using original version (stdio only)
bun dist/index.js

# Using multi-transport version (defaults to stdio)
bun dist/index-multi.js
```

**Claude Desktop / Cline Configuration:**

```json
{
  "mcpServers": {
    "confluence": {
      "command": "bun",
      "args": ["/absolute/path/to/confluence-mcp/dist/index.js"],
      "env": {
        "CONFLUENCE_API_TOKEN": "your_api_token",
        "CONFLUENCE_BASE_URL": "your_confluence_instance_url/wiki"
      }
    }
  }
}
```

#### 2. SSE Mode

Suitable for scenarios requiring HTTP interface while keeping it simple:

```bash
# Start SSE server
MCP_TRANSPORT=sse MCP_PORT=3000 bun dist/index-multi.js
```

The server will provide services at the following endpoints:

- `GET /sse` - Establish SSE connection
- `POST /messages` - Send JSON-RPC messages

#### 3. Streamable HTTP Mode (Recommended)

Suitable for web deployment and production environments:

```bash
# Start Streamable HTTP server
MCP_TRANSPORT=streamable-http MCP_PORT=3000 bun dist/index-multi.js
```

The server will provide services at the following endpoints:

- `GET /mcp` - Establish SSE stream
- `POST /mcp` - Send JSON-RPC messages
- `DELETE /mcp` - Terminate session (requires session ID)

**Features:**

- Session management support
- Connection resumability
- Event replay
- Better error handling

## Development

```bash
# Run in development mode
bun run dev

# Run tests
bun test
```

## Available Tools

The Confluence MCP server exposes the following tools:

### get_page

Retrieve a Confluence page by ID. Format refers to the return format of the content and can be `text` or `markdown`. The `includeMarkup` parameter allows retrieving the original Confluence Storage Format (XHTML) markup, which is useful for updating pages while preserving formatting.

```json
{
  "pageId": "123456",
  "format": "text",
  "includeMarkup": true
}
```

### search_pages

Search for Confluence pages using CQL (Confluence Query Language). Format refers to the return format of the content and can be `text` or `markdown`. The `includeMarkup` parameter allows retrieving the original Confluence Storage Format (XHTML) markup for each page.

```json
{
  "query": "space = DEV and label = documentation",
  "limit": 10,
  "format": "text",
  "includeMarkup": true
}
```

### get_spaces

List all available Confluence spaces.

```json
{
  "limit": 50
}
```

### create_page

Create a new Confluence page. The `parentId` is optional and can be used to create a child page under an existing page.

```json
{
  "spaceKey": "DEV",
  "title": "New Page Title",
  "content": "<p>Page content in Confluence Storage Format (XHTML)</p>",
  "parentId": "123456"
}
```

### update_page

Update an existing Confluence page.

```json
{
  "pageId": "123456",
  "title": "Updated Page Title",
  "content": "<p>Updated content in Confluence Storage Format (XHTML)</p>",
  "version": 1
}
```

### get_comments

Retrieve comments for a specific Confluence page. Format refers to the return format of the content and can be `text` or `markdown`.

```json
{
  "pageId": "123456",
  "limit": 25,
  "format": "text"
}
```

### add_comment

Add a comment to a Confluence page. The `parentId` is optional for creating threaded replies.

```json
{
  "pageId": "123456",
  "content": "<p>This is a new comment.</p>",
  "parentId": "789012"
}
```

### get_attachments

Retrieve attachments for a specific Confluence page.

```json
{
  "pageId": "123456",
  "limit": 25
}
```

### add_attachment

Add an attachment to a Confluence page. The `fileContentBase64` should be the base64 encoded string of the file content.

```json
{
  "pageId": "123456",
  "filename": "document.pdf",
  "fileContentBase64": "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+P...",
  "comment": "Uploaded new version of the document"
}
```

## Read-Only Mode

By setting the `CONFLUENCE_READ_ONLY_MODE=true` environment variable, you can enable read-only mode. In this mode:

### Allowed Operations

- `get_page` - Retrieve page content
- `search_pages` - Search pages
- `get_spaces` - Get space list
- `get_comments` - Get comments
- `get_attachments` - Get attachment list
- `add_comment` - Add comments

### Blocked Operations

- `create_page` - Create pages
- `update_page` - Update pages
- `add_attachment` - Add attachments

### Read-Only Mode Usage Example

```bash
# Enable read-only mode
export CONFLUENCE_READ_ONLY_MODE=true
bun dist/index.js
```

Or set in `.env` file:

```env
CONFLUENCE_READ_ONLY_MODE=true
```

When attempting to perform blocked operations, the system will return an error message:

```text
Error: Currently in read-only mode, 'create_page' operation is not allowed. Only read operations and adding comments are permitted.
```

## License

This project is licensed under the MIT License - see the [LICENCE](LICENCE) file for details.
