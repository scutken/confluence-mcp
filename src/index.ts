#!/usr/bin/env bun
import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { ConfluenceApiService } from './services/confluence-api.js';
import { optimizeForAI, storageFormatToMarkdown } from './utils/content-cleaner.js';

declare module 'bun' {
  interface Env {
    CONFLUENCE_API_TOKEN: string;
    CONFLUENCE_BASE_URL: string;
    CONFLUENCE_READ_ONLY_MODE?: string;
  }
}

const CONFLUENCE_API_TOKEN = process.env.CONFLUENCE_API_TOKEN;
const CONFLUENCE_BASE_URL = process.env.CONFLUENCE_BASE_URL;
const CONFLUENCE_READ_ONLY_MODE = process.env.CONFLUENCE_READ_ONLY_MODE === 'true';

// 定义只读模式下允许的操作
const READ_ONLY_ALLOWED_TOOLS = [
  'get_page',
  'search_pages',
  'get_spaces',
  'get_comments',
  'get_attachments',
  'add_comment', // 只读模式下仍允许新增评论
];

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

    this.setupToolHandlers();

    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const allTools = [
        {
          name: 'get_page',
          description: '通过ID获取Confluence页面 / Retrieve a Confluence page by ID',
          inputSchema: {
            type: 'object',
            properties: {
              pageId: {
                type: 'string',
                description: '要获取的Confluence页面ID / ID of the Confluence page to retrieve',
              },
              format: {
                type: 'string',
                enum: ['text', 'markdown'],
                description:
                  '返回内容的格式（默认：text）/ Format to return the content in (default: text)',
              },
              includeMarkup: {
                type: 'boolean',
                description:
                  '是否在响应中包含原始的Confluence存储格式（XHTML）标记（默认：false）。当您想稍后更新页面以保留格式时很有用。 / Whether to include the original Confluence Storage Format (XHTML) markup in the response (default: false). Useful when you want to update the page later in order to preserve formatting.',
              },
            },
            required: ['pageId'],
          },
        },
        {
          name: 'search_pages',
          description:
            '使用CQL（Confluence查询语言）搜索Confluence页面 / Search for Confluence pages using CQL (Confluence Query Language): query := expression [operator expression]* expression := field | function() | function | "phrase" | term operator := AND | OR | NOT | space field := date | after | before | during | lastmodified | modifiedafter | modifiedbefore | creator | from | to | content | title | body | subject | filename function() := now() | today() | yesterday() | this_week() | last_week() | this_month() | last_month() | this_year() | last_year() function := has | is | is | is | label | type | in value := string | quoted_string | date_format date_format := YYYY-MM-DD | YYYY-MM | YYYY quoted_string := "string with spaces" term := alphanumeric_string',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'CQL搜索查询 / CQL search query',
              },
              limit: {
                type: 'number',
                description:
                  '返回结果的最大数量（默认：10）/ Maximum number of results to return (default: 10)',
              },
              format: {
                type: 'string',
                enum: ['text', 'markdown'],
                description:
                  '返回内容的格式（默认：text）/ Format to return the content in (default: text)',
              },
              includeMarkup: {
                type: 'boolean',
                description:
                  '是否在响应中包含原始的Confluence存储格式（XHTML）标记（默认：false）/ Whether to include the original Confluence Storage Format (XHTML) markup in the response (default: false)',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_spaces',
          description: '列出所有可用的Confluence空间 / List all available Confluence spaces',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description:
                  '返回空间的最大数量（默认：50）/ Maximum number of spaces to return (default: 50)',
              },
            },
          },
        },
        {
          name: 'create_page',
          description: '创建新的Confluence页面 / Create a new Confluence page',
          inputSchema: {
            type: 'object',
            properties: {
              spaceKey: {
                type: 'string',
                description: '将创建页面的空间键 / Key of the space where the page will be created',
              },
              title: {
                type: 'string',
                description: '新页面的标题 / Title of the new page',
              },
              content: {
                type: 'string',
                description:
                  '页面内容，使用Confluence存储格式（XHTML）/ Content of the page in Confluence Storage Format (XHTML)',
              },
              parentId: {
                type: 'string',
                description: '可选的父页面ID / Optional ID of the parent page',
              },
            },
            required: ['spaceKey', 'title', 'content'],
          },
        },
        {
          name: 'update_page',
          description: '更新现有的Confluence页面 / Update an existing Confluence page',
          inputSchema: {
            type: 'object',
            properties: {
              pageId: {
                type: 'string',
                description: '要更新的页面ID / ID of the page to update',
              },
              title: {
                type: 'string',
                description: '页面的新标题 / New title of the page',
              },
              content: {
                type: 'string',
                description:
                  '使用Confluence存储格式（XHTML）的新内容。重要：内容必须是有效的XHTML。提供纯文本或Markdown将导致标记被字面显示，而不是渲染为富文本。 / New content in Confluence Storage Format (XHTML). CRITICAL: Content MUST be valid XHTML. Providing plain text or Markdown will result in the markup being displayed literally, not rendered as rich text.',
              },
              version: {
                type: 'number',
                description: '页面的当前版本号 / Current version number of the page',
              },
            },
            required: ['pageId', 'title', 'content', 'version'],
          },
        },
        {
          name: 'get_comments',
          description:
            '获取特定Confluence页面的评论 / Retrieve comments for a specific Confluence page',
          inputSchema: {
            type: 'object',
            properties: {
              pageId: {
                type: 'string',
                description: '要获取评论的页面ID / ID of the page to retrieve comments for',
              },
              format: {
                type: 'string',
                enum: ['text', 'markdown'],
                description:
                  '返回评论内容的格式（默认：text）/ Format to return comment content in (default: text)',
              },
              limit: {
                type: 'number',
                description:
                  '返回评论的最大数量（默认：25）/ Maximum number of comments to return (default: 25)',
              },
            },
            required: ['pageId'],
          },
        },
        {
          name: 'add_comment',
          description: '向Confluence页面添加评论 / Add a comment to a Confluence page',
          inputSchema: {
            type: 'object',
            properties: {
              pageId: {
                type: 'string',
                description: '要添加评论的页面ID / ID of the page to add the comment to',
              },
              content: {
                type: 'string',
                description:
                  '使用Confluence存储格式（XHTML）的评论内容 / Comment content in Confluence Storage Format (XHTML)',
              },
              parentId: {
                type: 'string',
                description:
                  '用于线程化的可选父评论ID / Optional ID of the parent comment for threading',
              },
            },
            required: ['pageId', 'content'],
          },
        },
        {
          name: 'get_attachments',
          description:
            '获取特定Confluence页面的附件 / Retrieve attachments for a specific Confluence page',
          inputSchema: {
            type: 'object',
            properties: {
              pageId: {
                type: 'string',
                description: '要获取附件的页面ID / ID of the page to retrieve attachments for',
              },
              limit: {
                type: 'number',
                description:
                  '返回附件的最大数量（默认：25）/ Maximum number of attachments to return (default: 25)',
              },
            },
            required: ['pageId'],
          },
        },
        {
          name: 'add_attachment',
          description: '向Confluence页面添加附件 / Add an attachment to a Confluence page',
          inputSchema: {
            type: 'object',
            properties: {
              pageId: {
                type: 'string',
                description: '要附加文件的页面ID / ID of the page to attach the file to',
              },
              filename: {
                type: 'string',
                description: '附件的期望文件名 / Desired filename for the attachment',
              },
              fileContentBase64: {
                type: 'string',
                description: '文件的Base64编码内容 / Base64 encoded content of the file',
              },
              comment: {
                type: 'string',
                description: '附件版本的可选注释 / Optional comment for the attachment version',
              },
            },
            required: ['pageId', 'filename', 'fileContentBase64'],
          },
        },
      ];

      // 在只读模式下过滤工具
      const filteredTools = CONFLUENCE_READ_ONLY_MODE
        ? allTools.filter((tool) => READ_ONLY_ALLOWED_TOOLS.includes(tool.name))
        : allTools;

      return { tools: filteredTools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        // 检查只读模式权限
        if (CONFLUENCE_READ_ONLY_MODE && !READ_ONLY_ALLOWED_TOOLS.includes(request.params.name)) {
          return {
            content: [
              {
                type: 'text',
                text: `错误：当前处于只读模式，不允许执行 '${request.params.name}' 操作。只允许读取操作和新增评论。\nError: Currently in read-only mode, '${request.params.name}' operation is not allowed. Only read operations and adding comments are permitted.`,
              },
            ],
            isError: true,
          };
        }

        switch (request.params.name) {
          case 'get_page': {
            const {
              pageId,
              format = 'text',
              includeMarkup = false,
            } = request.params.arguments as {
              pageId: string;
              format?: 'text' | 'markdown';
              includeMarkup?: boolean;
            };

            try {
              const page = await this.confluenceApi.getPage(pageId);

              // Format the content based on the requested format
              let formattedContent = page.content;
              if (format === 'markdown' && page.content) {
                formattedContent = storageFormatToMarkdown(page.content);
              }

              // Content is no longer optimized/truncated for single page gets
              const finalContent = formattedContent;

              // Prepare the response object
              const responseObj: any = {
                id: page.id,
                title: page.title,
                spaceKey: page.spaceKey,
                content: finalContent, // Use the full formatted content
                url: page.links.webui,
                version: page.version,
                created: page.created,
                updated: page.updated,
                createdBy: page.createdBy.displayName,
                updatedBy: page.updatedBy.displayName,
              };

              // Include the original markup if requested
              if (includeMarkup && page.contentMarkup) {
                responseObj.contentMarkup = page.contentMarkup;
              }

              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(responseObj, null, 2),
                  },
                ],
              };
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Error retrieving page: ${error instanceof Error ? error.message : String(error)}`,
                  },
                ],
                isError: true,
              };
            }
          }

          case 'search_pages': {
            const {
              query,
              limit = 10,
              format = 'text',
              includeMarkup = false,
            } = request.params.arguments as {
              query: string;
              limit?: number;
              format?: 'text' | 'markdown';
              includeMarkup?: boolean;
            };

            try {
              const result = await this.confluenceApi.searchPages(query);

              // Limit the number of results and format content
              const limitedPages = result.pages.slice(0, limit).map((page) => {
                // Format content if needed
                let formattedContent = page.content;
                if (format === 'markdown' && page.content) {
                  formattedContent = storageFormatToMarkdown(page.content);
                }

                // Optimize for AI
                const optimizedContent = optimizeForAI(formattedContent);

                // Prepare the page object
                const pageObj: any = {
                  id: page.id,
                  title: page.title,
                  spaceKey: page.spaceKey,
                  content: optimizedContent,
                  url: page.links.webui,
                  version: page.version,
                  updated: page.updated,
                  updatedBy: page.updatedBy.displayName,
                };

                // Include the original markup if requested
                if (includeMarkup && page.contentMarkup) {
                  pageObj.contentMarkup = page.contentMarkup;
                }

                return pageObj;
              });

              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        total: result.total,
                        returned: limitedPages.length,
                        pages: limitedPages,
                      },
                      null,
                      2
                    ),
                  },
                ],
              };
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Error searching pages: ${error instanceof Error ? error.message : String(error)}`,
                  },
                ],
                isError: true,
              };
            }
          }

          case 'get_spaces': {
            const { limit = 50 } = request.params.arguments as {
              limit?: number;
            };

            try {
              const result = await this.confluenceApi.getSpaces();

              // Limit the number of results
              const limitedSpaces = result.spaces.slice(0, limit);

              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        total: result.total,
                        returned: limitedSpaces.length,
                        spaces: limitedSpaces,
                      },
                      null,
                      2
                    ),
                  },
                ],
              };
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Error retrieving spaces: ${error instanceof Error ? error.message : String(error)}`,
                  },
                ],
                isError: true,
              };
            }
          }

          case 'create_page': {
            const { spaceKey, title, content, parentId } = request.params.arguments as {
              spaceKey: string;
              title: string;
              content: string;
              parentId?: string;
            };

            try {
              const page = await this.confluenceApi.createPage(spaceKey, title, content, parentId);

              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        id: page.id,
                        title: page.title,
                        spaceKey: page.spaceKey,
                        version: page.version,
                        url: page.links.webui,
                        parentId: page.parentId,
                        updated: page.updated,
                        updatedBy: page.updatedBy.displayName,
                        message: 'Page created successfully',
                      },
                      null,
                      2
                    ),
                  },
                ],
              };
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Error creating page: ${error instanceof Error ? error.message : String(error)}`,
                  },
                ],
                isError: true,
              };
            }
          }

          case 'update_page': {
            const { pageId, title, content, version } = request.params.arguments as {
              pageId: string;
              title: string;
              content: string;
              version: number;
            };

            try {
              const page = await this.confluenceApi.updatePage(pageId, title, content, version);

              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        id: page.id,
                        title: page.title,
                        spaceKey: page.spaceKey,
                        version: page.version,
                        url: page.links.webui,
                        updated: page.updated,
                        updatedBy: page.updatedBy.displayName,
                        message: 'Page updated successfully',
                      },
                      null,
                      2
                    ),
                  },
                ],
              };
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Error updating page: ${error instanceof Error ? error.message : String(error)}`,
                  },
                ],
                isError: true,
              };
            }
          }

          case 'get_comments': {
            const {
              pageId,
              format = 'text',
              limit = 25,
            } = request.params.arguments as {
              pageId: string;
              format?: 'text' | 'markdown';
              limit?: number;
            };

            try {
              const result = await this.confluenceApi.getComments(pageId);

              // Limit and format comments
              const limitedComments = result.comments.slice(0, limit).map((comment) => {
                let formattedContent = comment.content;
                if (format === 'markdown' && comment.content) {
                  formattedContent = storageFormatToMarkdown(comment.content);
                }
                const optimizedContent = optimizeForAI(formattedContent);

                return {
                  ...comment,
                  content: optimizedContent,
                };
              });

              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        total: result.total,
                        returned: limitedComments.length,
                        comments: limitedComments,
                      },
                      null,
                      2
                    ),
                  },
                ],
              };
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Error retrieving comments: ${error instanceof Error ? error.message : String(error)}`,
                  },
                ],
                isError: true,
              };
            }
          }

          case 'add_comment': {
            const { pageId, content, parentId } = request.params.arguments as {
              pageId: string;
              content: string;
              parentId?: string;
            };

            try {
              const comment = await this.confluenceApi.addComment(pageId, content, parentId);

              // Optimize content for response
              const optimizedContent = optimizeForAI(comment.content);

              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        ...comment,
                        content: optimizedContent,
                        message: 'Comment added successfully',
                      },
                      null,
                      2
                    ),
                  },
                ],
              };
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Error adding comment: ${error instanceof Error ? error.message : String(error)}`,
                  },
                ],
                isError: true,
              };
            }
          }

          case 'get_attachments': {
            const { pageId, limit = 25 } = request.params.arguments as {
              pageId: string;
              limit?: number;
            };

            try {
              const result = await this.confluenceApi.getAttachments(pageId);

              // Limit attachments
              const limitedAttachments = result.attachments.slice(0, limit);

              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        total: result.total,
                        returned: limitedAttachments.length,
                        attachments: limitedAttachments,
                      },
                      null,
                      2
                    ),
                  },
                ],
              };
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Error retrieving attachments: ${error instanceof Error ? error.message : String(error)}`,
                  },
                ],
                isError: true,
              };
            }
          }

          case 'add_attachment': {
            const { pageId, filename, fileContentBase64, comment } = request.params.arguments as {
              pageId: string;
              filename: string;
              fileContentBase64: string;
              comment?: string;
            };

            try {
              // Decode base64 content
              const fileContent = Buffer.from(fileContentBase64, 'base64');

              const attachment = await this.confluenceApi.addAttachment(
                pageId,
                fileContent,
                filename,
                comment
              );

              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        ...attachment,
                        message: 'Attachment added successfully',
                      },
                      null,
                      2
                    ),
                  },
                ],
              };
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Error adding attachment: ${error instanceof Error ? error.message : String(error)}`,
                  },
                ],
                isError: true,
              };
            }
          }

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          error instanceof Error ? error.message : 'Unknown error occurred'
        );
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport(process.stdin, process.stdout);
    await this.server.connect(transport);
    console.error('Confluence MCP server running on stdio');
  }
}

const server = new ConfluenceServer();
server.run().catch(console.error);
