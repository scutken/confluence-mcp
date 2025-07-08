# Confluence MCP

> > This project is a fork of [confluence-mcp](https://github.com/cosmix/confluence-mcp) created by [Dimosthenis Kaponis](https://github.com/cosmix).

<!-- markdownlint-disable MD033 -->
<div align="center">
  <strong>🇺🇸 English</strong> | <a href="README.md">🇨🇳 中文</a>
</div>

A Model Context Protocol (MCP) server for Confluence, enabling AI assistants to interact with Confluence content through a standardized interface.

## Table of Contents

- [Confluence MCP](#confluence-mcp)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
    - [Authentication Method](#authentication-method)
      - [Getting an API Token](#getting-an-api-token)
      - [Environment Variables](#environment-variables)
    - [Claude Desktop / Cline Configuration](#claude-desktop--cline-configuration)
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

### Authentication Method

This project uses **Bearer Token** authentication to access the Confluence Cloud REST API, which is a secure and simple authentication method.

#### Getting an API Token

1. Visit the [Atlassian API Tokens management page](https://id.atlassian.com/manage/api-tokens)
2. Click "Create API token"
3. Enter a descriptive label (e.g., "Confluence MCP Server")
4. Click "Create" and copy the generated token
5. **Important**: Please save this token securely, it will only be displayed once

#### Environment Variables

To use this MCP server, you need to set the following environment variables:

```env
CONFLUENCE_API_TOKEN=your_api_token
CONFLUENCE_BASE_URL=your_confluence_instance_url  # e.g., https://your-domain.atlassian.net/wiki
```

### Claude Desktop / Cline Configuration

Add this configuration to your settings file:

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

## License

This project is licensed under the MIT License - see the [LICENCE](LICENCE) file for details.
