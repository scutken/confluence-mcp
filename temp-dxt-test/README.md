# Confluence MCP

> 本项目Fork自[confluence-mcp](https://github.com/cosmix/confluence-mcp)，由[Dimosthenis Kaponis](https://github.com/cosmix)创建。

<!-- markdownlint-disable MD033 -->
<div align="center">
  <a href="README_EN.md">🇺🇸 English</a> | <strong>🇨🇳 中文</strong>
</div>

一个用于 Confluence 的模型上下文协议 (MCP) 服务器，使 AI 助手能够通过标准化接口与 Confluence 内容进行交互。

## 目录

- [功能特性](#功能特性)
- [前置要求](#前置要求)
- [安装](#安装)
- [配置](#配置)
- [DXT 扩展打包](#dxt-扩展打包)
- [开发](#开发)
- [可用工具](#可用工具)
- [许可证](#许可证)

## 功能特性

- 使用个人 API 令牌对 Confluence 进行身份验证
- 检索和搜索 Confluence 页面和空间
- 创建和更新 Confluence 内容
- 检索和添加页面评论
- 检索和添加页面附件
- 清理和转换 Confluence 内容以供 AI 使用
- 处理 API 通信、错误处理和数据转换
- 基本的速率限制以防止 API 滥用

## 前置要求

- [Bun](https://bun.sh) (v1.0.0 或更高版本)
- 具有 API 访问权限的 Confluence 账户
- 基于 Atlassian Confluence 7.13.8 测试

## 安装

```bash
# 克隆仓库
git clone https://github.com/scutken/confluence-mcp.git
cd confluence-mcp

# 安装依赖
bun install

# 构建项目 windows
bun run build
# linux or macOS
bun run build-unix
```

## 配置

### 传输方式

本项目支持多种 MCP 传输方式：

1. **stdio** - 标准输入输出（默认）
2. **sse** - Server-Sent Events + HTTP POST
3. **streamable-http** - Streamable HTTP（推荐用于 Web 部署）

### 鉴权方式

本项目使用 **Bearer Token** 鉴权方式访问 Confluence Cloud REST API，这是一种安全且简单的鉴权方法。

#### 获取 API Token

1. confluence进入：用户信息-设置-个人访问令牌
2. 创建令牌
3. **重要**：请妥善保存此 token，它只会显示一次

#### 环境变量配置

要使用此 MCP 服务器，您需要设置以下环境变量。

##### 方法 1：使用 .env 文件（推荐）

1. 复制示例配置文件：

   ```bash
   cp .env.example .env
   ```

2. 编辑 `.env` 文件，填入您的配置：

```env
# 必需的配置
CONFLUENCE_API_TOKEN=your_api_token
CONFLUENCE_BASE_URL=your_confluence_instance_url  # 例如：https://your-domain.atlassian.net/wiki

# 传输方式配置（可选）
MCP_TRANSPORT=stdio  # 可选值：stdio（默认）、sse、streamable-http
MCP_PORT=3000        # HTTP 服务端口（仅用于 sse 和 streamable-http）
MCP_HOST=localhost   # HTTP 服务主机（仅用于 sse 和 streamable-http）
```

##### 方法 2：直接设置环境变量

您也可以直接在命令行中设置环境变量：

```bash
export CONFLUENCE_API_TOKEN=your_api_token
export CONFLUENCE_BASE_URL=https://your-domain.atlassian.net/wiki
export MCP_TRANSPORT=stdio
```

**参数说明：**

- `CONFLUENCE_API_TOKEN`: 从 Atlassian 账户生成的 API token
- `CONFLUENCE_BASE_URL`: 您的 Confluence 实例 URL，必须包含 `/wiki` 路径
- `MCP_TRANSPORT`: 传输方式，默认为 `stdio`
- `MCP_PORT`: HTTP 服务端口，默认为 `3000`
- `MCP_HOST`: HTTP 服务主机，默认为 `localhost`

### 部署方式

#### 1. Stdio 模式（默认）

适用于本地集成和命令行工具：

```bash
# 使用原始版本（仅 stdio）
bun dist/index.js

# 使用多传输版本（默认 stdio）
bun dist/index-multi.js
```

**Claude Desktop / Cline 配置：**

```json
{
  "mcpServers": {
    "confluence": {
      "command": "bun",
      "args": ["/absolute/path/to/confluence-mcp/dist/index.js"],
      "env": {
        "CONFLUENCE_API_TOKEN": "your_api_token",
        "CONFLUENCE_BASE_URL": "https://your-domain.atlassian.net/wiki"
      }
    }
  }
}
```

#### 2. SSE 模式

适用于需要 HTTP 接口但保持简单的场景：

```bash
# 启动 SSE 服务器
MCP_TRANSPORT=sse MCP_PORT=3000 bun dist/index-multi.js
```

服务器将在以下端点提供服务：

- `GET /sse` - 建立 SSE 连接
- `POST /messages` - 发送 JSON-RPC 消息

#### 3. Streamable HTTP 模式（推荐）

适用于 Web 部署和生产环境：

```bash
# 启动 Streamable HTTP 服务器
MCP_TRANSPORT=streamable-http MCP_PORT=3000 bun dist/index-multi.js
```

服务器将在以下端点提供服务：

- `GET /mcp` - 建立 SSE 流
- `POST /mcp` - 发送 JSON-RPC 消息
- `DELETE /mcp` - 终止会话（需要会话 ID）

**特性：**

- 支持会话管理
- 支持连接恢复
- 支持事件重放
- 更好的错误处理

### 快速启动脚本

项目提供了便捷的启动脚本：

```bash
# Stdio 模式（默认）
bun run start        # 使用原始版本
bun run start:multi  # 使用多传输版本

# SSE 模式
bun run start:sse

# Streamable HTTP 模式
bun run start:http
```

### 使用示例

#### 测试 Streamable HTTP 服务器

```bash
# 启动服务器
MCP_TRANSPORT=streamable-http MCP_PORT=3000 \
CONFLUENCE_API_TOKEN=your_token \
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net/wiki \
bun dist/index-multi.js

# 测试工具列表
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'
```

#### 测试 SSE 服务器

```bash
# 启动服务器
MCP_TRANSPORT=sse MCP_PORT=3000 \
CONFLUENCE_API_TOKEN=your_token \
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net/wiki \
bun dist/index-multi.js

# 建立 SSE 连接
curl http://localhost:3000/sse

# 发送消息（在另一个终端）
curl -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'
```

## DXT 扩展打包

本项目支持打包成 DXT (Desktop Extension) 格式，以便在支持 MCP 的桌面应用程序中一键安装。

### 什么是 DXT？

DXT 是由 Anthropic 开发的扩展格式，类似于 Chrome 扩展或 VS Code 扩展，让用户可以轻松安装和配置本地 MCP 服务器。

### 构建 DXT 扩展

```bash
# 构建项目并创建 DXT 文件
npm run build:dxt
```

这将创建一个 `confluence-mcp.dxt` 文件，用户可以直接在 Claude Desktop 等应用中安装。

### 安装 DXT 扩展

1. 双击 `confluence-mcp.dxt` 文件
2. 在安装向导中配置：
   - **Confluence API Token**: 您的个人访问令牌
   - **Confluence Base URL**: 您的 Confluence 实例 URL
3. 完成安装后即可在 AI 助手中使用

### 详细说明

更多关于 DXT 构建和分发的详细信息，请参阅 [DXT_BUILD.md](DXT_BUILD.md)。

## 开发

```bash
# 以开发模式运行（stdio）
bun run dev

# 以开发模式运行（多传输）
bun run dev:multi

# 运行测试
bun test
```

## 可用工具

Confluence MCP 服务器提供以下工具：

### get_page

通过 ID 检索 Confluence 页面。format 参数指定内容的返回格式，可以是 `text` 或 `markdown`。`includeMarkup` 参数允许检索原始的 Confluence 存储格式 (XHTML) 标记，这对于在保持格式的同时更新页面很有用。

```json
{
  "pageId": "123456",
  "format": "text",
  "includeMarkup": true
}
```

### search_pages

使用 CQL（Confluence 查询语言）搜索 Confluence 页面。format 参数指定内容的返回格式，可以是 `text` 或 `markdown`。`includeMarkup` 参数允许为每个页面检索原始的 Confluence 存储格式 (XHTML) 标记。

```json
{
  "query": "space = DEV and label = documentation",
  "limit": 10,
  "format": "text",
  "includeMarkup": true
}
```

### get_spaces

列出所有可用的 Confluence 空间。

```json
{
  "limit": 50
}
```

### create_page

创建新的 Confluence 页面。`parentId` 是可选的，可用于在现有页面下创建子页面。

```json
{
  "spaceKey": "DEV",
  "title": "新页面标题",
  "content": "<p>Confluence 存储格式 (XHTML) 的页面内容</p>",
  "parentId": "123456"
}
```

### update_page

更新现有的 Confluence 页面。

```json
{
  "pageId": "123456",
  "title": "更新的页面标题",
  "content": "<p>Confluence 存储格式 (XHTML) 的更新内容</p>",
  "version": 1
}
```

### get_comments

检索特定 Confluence 页面的评论。format 参数指定内容的返回格式，可以是 `text` 或 `markdown`。

```json
{
  "pageId": "123456",
  "limit": 25,
  "format": "text"
}
```

### add_comment

向 Confluence 页面添加评论。`parentId` 是可选的，用于创建线程回复。

```json
{
  "pageId": "123456",
  "content": "<p>这是一条新评论。</p>",
  "parentId": "789012"
}
```

### get_attachments

检索特定 Confluence 页面的附件。

```json
{
  "pageId": "123456",
  "limit": 25
}
```

### add_attachment

向 Confluence 页面添加附件。`fileContentBase64` 应该是文件内容的 base64 编码字符串。

```json
{
  "pageId": "123456",
  "filename": "document.pdf",
  "fileContentBase64": "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+P...",
  "comment": "上传了文档的新版本"
}
```

## 许可证

本项目采用 MIT 许可证 - 详情请参阅 [LICENCE](LICENCE) 文件。
