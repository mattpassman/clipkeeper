import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import SearchService from '../src/SearchService.js';
import HistoryStore from '../src/HistoryStore.js';

describe('SearchService', () => {
  let store;
  let searchService;

  beforeEach(() => {
    store = new HistoryStore(':memory:');
    searchService = new SearchService(store);
  });

  describe('Constructor', () => {
    it('should create SearchService with HistoryStore', () => {
      assert.ok(searchService);
      assert.ok(searchService.historyStore);
    });

    it('should throw error if HistoryStore is not provided', () => {
      assert.throws(() => {
        new SearchService();
      }, /HistoryStore is required/);
    });
  });

  describe('_parseQuery()', () => {
    it('should split query into keywords', () => {
      const keywords = searchService._parseQuery('hello world');
      assert.deepStrictEqual(keywords, ['hello', 'world']);
    });

    it('should convert keywords to lowercase', () => {
      const keywords = searchService._parseQuery('HELLO World');
      assert.deepStrictEqual(keywords, ['hello', 'world']);
    });

    it('should remove empty strings', () => {
      const keywords = searchService._parseQuery('hello   world');
      assert.deepStrictEqual(keywords, ['hello', 'world']);
    });

    it('should handle single keyword', () => {
      const keywords = searchService._parseQuery('hello');
      assert.deepStrictEqual(keywords, ['hello']);
    });

    it('should return empty array for empty query', () => {
      const keywords = searchService._parseQuery('');
      assert.deepStrictEqual(keywords, []);
    });

    it('should return empty array for whitespace-only query', () => {
      const keywords = searchService._parseQuery('   ');
      assert.deepStrictEqual(keywords, []);
    });

    it('should return empty array for null query', () => {
      const keywords = searchService._parseQuery(null);
      assert.deepStrictEqual(keywords, []);
    });

    it('should return empty array for undefined query', () => {
      const keywords = searchService._parseQuery(undefined);
      assert.deepStrictEqual(keywords, []);
    });
  });

  describe('_formatEntry()', () => {
    it('should add preview for short content', () => {
      const entry = {
        id: 'test-id',
        content: 'Short content',
        contentType: 'text',
        timestamp: Date.now()
      };

      const formatted = searchService._formatEntry(entry);
      assert.strictEqual(formatted.preview, 'Short content');
    });

    it('should truncate long content with ellipsis', () => {
      const longContent = 'a'.repeat(150);
      const entry = {
        id: 'test-id',
        content: longContent,
        contentType: 'text',
        timestamp: Date.now()
      };

      const formatted = searchService._formatEntry(entry);
      assert.strictEqual(formatted.preview.length, 103); // 100 chars + '...'
      assert.ok(formatted.preview.endsWith('...'));
    });

    it('should add relativeTime field', () => {
      const entry = {
        id: 'test-id',
        content: 'Test content',
        contentType: 'text',
        timestamp: Date.now() - 3600000 // 1 hour ago
      };

      const formatted = searchService._formatEntry(entry);
      assert.ok(formatted.relativeTime);
      assert.ok(formatted.relativeTime.includes('hour'));
    });

    it('should preserve original entry fields', () => {
      const entry = {
        id: 'test-id',
        content: 'Test content',
        contentType: 'text',
        timestamp: Date.now(),
        sourceApp: 'VSCode'
      };

      const formatted = searchService._formatEntry(entry);
      assert.strictEqual(formatted.id, entry.id);
      assert.strictEqual(formatted.content, entry.content);
      assert.strictEqual(formatted.contentType, entry.contentType);
      assert.strictEqual(formatted.sourceApp, entry.sourceApp);
    });

    it('should handle empty content', () => {
      const entry = {
        id: 'test-id',
        content: '',
        contentType: 'text',
        timestamp: Date.now()
      };

      const formatted = searchService._formatEntry(entry);
      assert.strictEqual(formatted.preview, '');
    });

    it('should handle null content', () => {
      const entry = {
        id: 'test-id',
        content: null,
        contentType: 'text',
        timestamp: Date.now()
      };

      const formatted = searchService._formatEntry(entry);
      assert.strictEqual(formatted.preview, '');
    });
  });

  describe('_getRelativeTime()', () => {
    it('should return "just now" for recent timestamps', () => {
      const timestamp = Date.now() - 30000; // 30 seconds ago
      const relativeTime = searchService._getRelativeTime(timestamp);
      assert.strictEqual(relativeTime, 'just now');
    });

    it('should return minutes for timestamps within an hour', () => {
      const timestamp = Date.now() - 300000; // 5 minutes ago
      const relativeTime = searchService._getRelativeTime(timestamp);
      assert.ok(relativeTime.includes('minute'));
    });

    it('should return hours for timestamps within a day', () => {
      const timestamp = Date.now() - 7200000; // 2 hours ago
      const relativeTime = searchService._getRelativeTime(timestamp);
      assert.strictEqual(relativeTime, '2 hours ago');
    });

    it('should return days for timestamps within a week', () => {
      const timestamp = Date.now() - 172800000; // 2 days ago
      const relativeTime = searchService._getRelativeTime(timestamp);
      assert.strictEqual(relativeTime, '2 days ago');
    });

    it('should use singular form for 1 unit', () => {
      const timestamp = Date.now() - 3600000; // 1 hour ago
      const relativeTime = searchService._getRelativeTime(timestamp);
      assert.strictEqual(relativeTime, '1 hour ago');
    });

    it('should use plural form for multiple units', () => {
      const timestamp = Date.now() - 7200000; // 2 hours ago
      const relativeTime = searchService._getRelativeTime(timestamp);
      assert.strictEqual(relativeTime, '2 hours ago');
    });
  });

  describe('search()', () => {
    it('should return formatted results from HistoryStore', () => {
      const now = Date.now();
      store.save({ content: 'Hello world', contentType: 'text', timestamp: now });
      store.save({ content: 'Hello there', contentType: 'text', timestamp: now - 1000 });

      const results = searchService.search('hello');

      assert.strictEqual(results.length, 2);
      assert.ok(results[0].preview);
      assert.ok(results[0].relativeTime);
    });

    it('should return empty array for empty query', () => {
      store.save({ content: 'Hello world', contentType: 'text', timestamp: Date.now() });

      const results = searchService.search('');

      assert.deepStrictEqual(results, []);
    });

    it('should pass options to HistoryStore.search()', () => {
      const now = Date.now();
      store.save({ content: 'test content', contentType: 'text', timestamp: now });
      store.save({ content: 'test content', contentType: 'code', timestamp: now });

      const results = searchService.search('test', { contentType: 'code' });

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].contentType, 'code');
    });

    it('should respect limit option', () => {
      const now = Date.now();
      for (let i = 0; i < 10; i++) {
        store.save({ content: `test entry ${i}`, contentType: 'text', timestamp: now + i });
      }

      const results = searchService.search('test', { limit: 5 });

      assert.strictEqual(results.length, 5);
    });

    it('should format all results with preview and relativeTime', () => {
      const now = Date.now();
      store.save({ content: 'First test entry', contentType: 'text', timestamp: now });
      store.save({ content: 'Second test entry', contentType: 'text', timestamp: now - 1000 });

      const results = searchService.search('test');

      assert.strictEqual(results.length, 2);
      results.forEach(result => {
        assert.ok(result.preview !== undefined);
        assert.ok(result.relativeTime !== undefined);
      });
    });

    it('should handle search with multiple keywords', () => {
      const now = Date.now();
      store.save({ content: 'Hello world', contentType: 'text', timestamp: now });
      store.save({ content: 'Hello there', contentType: 'text', timestamp: now - 1000 });
      store.save({ content: 'world peace', contentType: 'text', timestamp: now - 2000 });

      const results = searchService.search('hello world');

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].content, 'Hello world');
    });

    it('should handle search with since option', () => {
      const now = Date.now();
      store.save({ content: 'old entry', contentType: 'text', timestamp: now - 10000 });
      store.save({ content: 'recent entry', contentType: 'text', timestamp: now - 1000 });

      const results = searchService.search('entry', { since: now - 5000 });

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].content, 'recent entry');
    });

    it('should return results ordered by timestamp DESC', () => {
      const now = Date.now();
      store.save({ content: 'test old', contentType: 'text', timestamp: now - 3000 });
      store.save({ content: 'test new', contentType: 'text', timestamp: now });
      store.save({ content: 'test middle', contentType: 'text', timestamp: now - 1000 });

      const results = searchService.search('test');

      assert.strictEqual(results.length, 3);
      assert.ok(results[0].timestamp >= results[1].timestamp);
      assert.ok(results[1].timestamp >= results[2].timestamp);
    });
  });
});
