import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { ConfluenceApiService } from '../confluence-api.js';
import { ConfluenceAttachment } from '../../types/confluence.js'; // Assuming this type is needed

// Mock global fetch and FormData
const originalFetch = global.fetch;
const originalFormData = global.FormData;

// --- Mock Data ---
const mockAttachmentResponse = {
  id: 'att123',
  title: 'test-file.txt',
  status: 'current',
  // pageId is not typically in the direct attachment response, it's inferred
  metadata: {
    // Correct structure for mediaType
    mediaType: 'text/plain',
    comment: 'Initial upload', // Comment might be here too in some API versions
  },
  extensions: {
    // fileSize is often here
    fileSize: 1024,
  },
  version: {
    number: 1,
    message: 'Initial upload',
    when: '2023-01-04T10:00:00.000Z',
    by: {
      accountId: 'user-123',
      displayName: 'Test User',
      email: 'user@example.com',
    },
  },
  _links: {
    webui: '/display/SPACE/PageName?preview=/download/attachments/123/test-file.txt',
    download: '/download/attachments/123/test-file.txt',
  },
};

const mockGetAttachmentsResponse = {
  results: [mockAttachmentResponse],
  size: 1,
};

// --- Test Suite ---

describe('ConfluenceApiService - Attachments', () => {
  let apiService: ConfluenceApiService;
  const mockBaseUrl = 'https://example.atlassian.net/wiki';
  const mockApiToken = 'api-token-123';

  beforeEach(() => {
    // Reset the global fetch before each test
    global.fetch = mock(() => {
      return Promise.resolve(
        new Response(JSON.stringify({}), {
          status: 200,
          statusText: 'OK',
          headers: new Headers({
            'Content-Type': 'application/json',
          }),
        })
      );
    }) as any;

    // Mock FormData
    global.FormData = mock(function () {
      const data = new Map<string, any>();
      return {
        append: (key: string, value: any) => {
          data.set(key, value);
        },
        get: (key: string) => data.get(key),
        _data: data, // Expose data for inspection in tests
      };
    }) as any;

    apiService = new ConfluenceApiService(mockBaseUrl, mockApiToken);
  });

  afterEach(() => {
    // Restore the original fetch and FormData after each test
    global.fetch = originalFetch;
    global.FormData = originalFormData;
  });

  describe('getAttachments', () => {
    test('should fetch and clean attachments for a page', async () => {
      global.fetch = mock(() => {
        return Promise.resolve(
          new Response(JSON.stringify(mockGetAttachmentsResponse), {
            status: 200,
            headers: new Headers({ 'Content-Type': 'application/json' }),
          })
        );
      }) as any;

      const pageId = 'page-123';
      const result = await apiService.getAttachments(pageId);

      expect(result).toBeObject();
      expect(result.total).toBe(1);
      expect(result.attachments).toHaveLength(1);

      const attachment = result.attachments[0];
      expect(attachment.id).toBe(mockAttachmentResponse.id);
      expect(attachment.title).toBe(mockAttachmentResponse.title);
      // Assert against the nested properties in the mock data
      expect(attachment.mediaType).toBe(mockAttachmentResponse.metadata.mediaType);
      expect(attachment.fileSize).toBe(mockAttachmentResponse.extensions.fileSize);
      // cleanAttachment uses version.message for the comment
      expect(attachment.comment).toBe(mockAttachmentResponse.version.message);
      expect(attachment.version).toBe(mockAttachmentResponse.version.number);
      expect(attachment.createdBy.displayName).toBe(mockAttachmentResponse.version.by.displayName);
      expect(attachment.created).toBe(mockAttachmentResponse.version.when);
      expect(attachment.pageId).toBe(pageId); // Check against the passed pageId
      // Expect the full URL including the base URL, as generated by cleanAttachment
      expect(attachment.links.download).toBe(mockBaseUrl + mockAttachmentResponse._links.download);
      expect(attachment.links.webui).toBe(mockAttachmentResponse._links.webui);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const fetchCall = (global.fetch as any).mock.calls[0];
      // Correct the expected expand parameters to match the implementation (version,history,metadata)
      expect(fetchCall[0]).toBe(
        `${mockBaseUrl}/rest/api/content/${pageId}/child/attachment?expand=version%2Chistory%2Cmetadata&limit=100`
      );
    });

    test('should handle pages with no attachments', async () => {
      global.fetch = mock(() => {
        return Promise.resolve(
          new Response(JSON.stringify({ results: [], size: 0 }), {
            status: 200,
            headers: new Headers({ 'Content-Type': 'application/json' }),
          })
        );
      }) as any;

      const pageId = 'page-no-attachments';
      const result = await apiService.getAttachments(pageId);

      expect(result.total).toBe(0);
      expect(result.attachments).toHaveLength(0);
    });

    // Note: Error handling tests for getAttachments are in error.test.ts
  });

  describe('addAttachment', () => {
    test('should add an attachment with comment and return cleaned result', async () => {
      const mockCreatedAttachment = {
        ...mockAttachmentResponse,
        id: 'new-att-456',
        title: 'new-upload.pdf',
        comment: 'Upload comment',
        version: {
          ...mockAttachmentResponse.version,
          number: 1,
          message: 'Upload comment',
        },
      };

      // Mock POST for upload
      const postMock = mock(() => {
        // The actual API returns the attachment details directly on POST success
        return Promise.resolve(
          new Response(JSON.stringify({ results: [mockCreatedAttachment] }), {
            status: 200,
            headers: new Headers({ 'Content-Type': 'application/json' }),
          })
        );
      });

      global.fetch = postMock as any;

      const pageId = 'page-123';
      const fileContent = Buffer.from('This is a test file content.');
      const filename = 'new-upload.pdf';
      const comment = 'Upload comment';

      const attachment = await apiService.addAttachment(pageId, fileContent, filename, comment);

      expect(attachment).toBeObject();
      expect(attachment.id).toBe('new-att-456');
      expect(attachment.title).toBe(filename);
      expect(attachment.comment).toBe(comment);
      expect(attachment.pageId).toBe(pageId);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const fetchCall = (global.fetch as any).mock.calls[0];
      const url = fetchCall[0];
      const options = fetchCall[1];

      expect(url).toBe(`${mockBaseUrl}/rest/api/content/${pageId}/child/attachment`);
      expect(options.method).toBe('POST');
      expect(options.headers.get('X-Atlassian-Token')).toBe('no-check');
      // Check the internal structure of the mock FormData
      expect(options.body._data).toBeInstanceOf(Map);

      // Inspect the mocked FormData
      const formData = options.body;
      expect(formData._data.get('file')).toBeInstanceOf(Blob); // Bun automatically converts Buffer to Blob for FormData
      expect(formData._data.get('comment')).toBe(comment);
      // The code doesn't add minorEdit, so it should be undefined in the FormData
      expect(formData._data.get('minorEdit')).toBeUndefined();
    });

    test('should add an attachment without comment', async () => {
      const mockCreatedAttachment = {
        ...mockAttachmentResponse,
        id: 'new-att-789',
        title: 'no-comment.txt',
        comment: '', // Expect empty comment
        version: { ...mockAttachmentResponse.version, number: 1, message: '' }, // Expect empty message
      };

      // Mock POST for upload
      const postMock = mock(() => {
        return Promise.resolve(
          new Response(JSON.stringify({ results: [mockCreatedAttachment] }), {
            status: 200,
            headers: new Headers({ 'Content-Type': 'application/json' }),
          })
        );
      });

      global.fetch = postMock as any;

      const pageId = 'page-456';
      const fileContent = Buffer.from('Another test.');
      const filename = 'no-comment.txt';

      const attachment = await apiService.addAttachment(pageId, fileContent, filename); // No comment passed

      expect(attachment).toBeObject();
      expect(attachment.id).toBe('new-att-789');
      expect(attachment.title).toBe(filename);
      expect(attachment.comment).toBe(''); // Verify empty comment
      expect(attachment.pageId).toBe(pageId);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const fetchCall = (global.fetch as any).mock.calls[0];
      const options = fetchCall[1];
      const formData = options.body;

      expect(formData._data.get('file')).toBeInstanceOf(Blob);
      expect(formData._data.get('comment')).toBeUndefined(); // Comment should not be appended if undefined
      // The code doesn't add minorEdit, so it should be undefined in the FormData
      expect(formData._data.get('minorEdit')).toBeUndefined();
    });

    // Note: Error handling tests for addAttachment are in error.test.ts
  });
});
