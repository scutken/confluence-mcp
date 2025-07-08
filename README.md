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

### 鉴权方式

本项目使用 **Bearer Token** 鉴权方式访问 Confluence Cloud REST API，这是一种安全且简单的鉴权方法。

#### 获取 API Token

1. confluence进入：用户信息-设置-个人访问令牌
2. 创建令牌
3. **重要**：请妥善保存此 token，它只会显示一次

#### 环境变量配置

要使用此 MCP 服务器，您需要设置以下环境变量：

```env
CONFLUENCE_API_TOKEN=your_api_token
CONFLUENCE_BASE_URL=your_confluence_instance_url  # 例如：https://wiki.firstshare.cn/
```

### Claude Desktop / Cline 配置

将此配置添加到您的设置文件中：

```json
{
  "mcpServers": {
    "confluence": {
      "command": "bun",
      "args": ["/absolute/path/to/confluence-mcp/dist/index.js"],
      "env": {
        "CONFLUENCE_API_TOKEN": "your_api_token",
        "CONFLUENCE_BASE_URL": "https://wiki.firstshare.cn"
      }
    }
  }
}
```

## 开发

```bash
# 以开发模式运行
bun run dev

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
