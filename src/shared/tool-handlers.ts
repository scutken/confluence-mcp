import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { ConfluenceApiService } from '../services/confluence-api.js';
import { optimizeForAI, storageFormatToMarkdown } from '../utils/content-cleaner.js';

export function setupToolHandlers(server: Server, confluenceApi: ConfluenceApiService) {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
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
              description: '是否包含原始标记 / Whether to include original markup',
            },
          },
          required: ['pageId'],
        },
      },
      {
        name: 'search_pages',
        description: '使用CQL搜索Confluence页面 / Search Confluence pages using CQL',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'CQL查询字符串 / CQL query string',
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
              description: '是否包含原始标记 / Whether to include original markup',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_spaces',
        description: '获取所有可用的Confluence空间 / Get all available Confluence spaces',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description:
                '返回结果的最大数量（默认：50）/ Maximum number of results to return (default: 50)',
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
              description: '空间键 / Space key',
            },
            title: {
              type: 'string',
              description: '页面标题 / Page title',
            },
            content: {
              type: 'string',
              description:
                '页面内容（Confluence存储格式）/ Page content (Confluence storage format)',
            },
            parentId: {
              type: 'string',
              description: '父页面ID（可选）/ Parent page ID (optional)',
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
              description: '新的页面标题 / New page title',
            },
            content: {
              type: 'string',
              description:
                '新的页面内容（Confluence存储格式）/ New page content (Confluence storage format)',
            },
            version: {
              type: 'number',
              description: '当前页面版本号 / Current page version number',
            },
          },
          required: ['pageId', 'title', 'content', 'version'],
        },
      },
      {
        name: 'get_comments',
        description: '获取页面评论 / Get page comments',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: {
              type: 'string',
              description: '页面ID / Page ID',
            },
          },
          required: ['pageId'],
        },
      },
      {
        name: 'add_comment',
        description: '添加页面评论 / Add a page comment',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: {
              type: 'string',
              description: '页面ID / Page ID',
            },
            content: {
              type: 'string',
              description: '评论内容（HTML格式）/ Comment content (HTML format)',
            },
            parentCommentId: {
              type: 'string',
              description: '父评论ID（用于回复，可选）/ Parent comment ID (for replies, optional)',
            },
          },
          required: ['pageId', 'content'],
        },
      },
      {
        name: 'get_attachments',
        description: '获取页面附件 / Get page attachments',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: {
              type: 'string',
              description: '页面ID / Page ID',
            },
          },
          required: ['pageId'],
        },
      },
      {
        name: 'add_attachment',
        description: '添加页面附件 / Add a page attachment',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: {
              type: 'string',
              description: '页面ID / Page ID',
            },
            filename: {
              type: 'string',
              description: '文件名 / Filename',
            },
            fileContentBase64: {
              type: 'string',
              description: '文件内容（Base64编码）/ File content (Base64 encoded)',
            },
            comment: {
              type: 'string',
              description: '附件注释（可选）/ Attachment comment (optional)',
            },
          },
          required: ['pageId', 'filename', 'fileContentBase64'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
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
            const page = await confluenceApi.getPage(pageId);

            // Format the content based on the requested format
            let formattedContent = page.content;
            if (format === 'markdown' && page.content) {
              formattedContent = storageFormatToMarkdown(page.content);
            }

            const responseObj: any = {
              id: page.id,
              title: page.title,
              spaceKey: page.spaceKey,
              content: formattedContent,
              url: page.links.webui,
              version: page.version,
              created: page.created,
              updated: page.updated,
              createdBy: page.createdBy.displayName,
              updatedBy: page.updatedBy.displayName,
            };

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
            const result = await confluenceApi.searchPages(query);

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
            const result = await confluenceApi.getSpaces();

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
            const page = await confluenceApi.createPage(spaceKey, title, content, parentId);

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
            const page = await confluenceApi.updatePage(pageId, title, content, version);

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
          const { pageId } = request.params.arguments as {
            pageId: string;
          };

          try {
            const result = await confluenceApi.getComments(pageId);

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      total: result.total,
                      comments: result.comments,
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
          const { pageId, content, parentCommentId } = request.params.arguments as {
            pageId: string;
            content: string;
            parentCommentId?: string;
          };

          try {
            const comment = await confluenceApi.addComment(pageId, content, parentCommentId);

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      ...comment,
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
          const { pageId } = request.params.arguments as {
            pageId: string;
          };

          try {
            const result = await confluenceApi.getAttachments(pageId);

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      total: result.total,
                      attachments: result.attachments,
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

            const attachment = await confluenceApi.addAttachment(
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
