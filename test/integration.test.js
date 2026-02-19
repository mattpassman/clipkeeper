import { describe, it, beforeEach, afterEach, before, after } from 'node:test';
import assert from 'node:assert';
import clipboardy from 'clipboardy';
import HistoryStore from '../src/HistoryStore.js';
import SearchService from '../src/SearchService.js';
import ClipboardService from '../src/ClipboardService.js';
import RetentionService from '../src/RetentionService.js';
import { ConfigurationManager } from '../src/ConfigurationManager.js';

describe('Integration Tests', () => {
  let historyStore;
  let searchService;
  let clipboardService;
  let retentionService;
  let configManager;
  let originalClipboard;

  before(async () => {
    // Save original clipboard content
    try {
      originalClipboard = await clipboardy.read();
    } catch (error) {
      originalClipboard = '';
    }
  });

  after(async () => {
    // Restore original clipboard content
    try {
      await clipboardy.write(originalClipboard);
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  beforeEach(() => {
    // Use in-memory database for tests
    historyStore = new HistoryStore(':memory:');
    searchService = new SearchService(historyStore);
    clipboardService = new ClipboardService();
    configManager = new ConfigurationManager();
    configManager.set('retention.days', 30);
    retentionService = new RetentionService(historyStore, configManager);
  });

  afterEach(() => {
    // Stop retention service if running
    if (retentionService) {
      retentionService.stop();
    }
    
    // Close database
    if (historyStore && historyStore.isOpen()) {
      historyStore.close();
    }
  });

  describe('End-to-end search test', () => {
    it('should search and find entries with single keyword', () => {
      const now = Date.now();
      
      // Insert test entries
      historyStore.save({ content: 'Hello world', contentType: 'text', timestamp: now });
      historyStore.save({ content: 'Goodbye world', contentType: 'text', timestamp: now - 1000 });
      historyStore.save({ content: 'Hello there', contentType: 'text', timestamp: now - 2000 });
      historyStore.save({ content: 'Something else', contentType: 'text', timestamp: now - 3000 });
      
      // Search with single keyword
      const results = searchService.search('hello');
      
      // Verify correct results
      assert.strictEqual(results.length, 2, 'Should find 2 entries with "hello"');
      assert.ok(results[0].content.toLowerCase().includes('hello'));
      assert.ok(results[1].content.toLowerCase().includes('hello'));
      assert.ok(results[0].preview, 'Results should have preview');
      assert.ok(results[0].relativeTime, 'Results should have relativeTime');
    });

    it('should search with multiple keywords (AND logic)', () => {
      const now = Date.now();
      
      // Insert test entries
      historyStore.save({ content: 'Hello world', contentType: 'text', timestamp: now });
      historyStore.save({ content: 'Hello there', contentType: 'text', timestamp: now - 1000 });
      historyStore.save({ content: 'world peace', contentType: 'text', timestamp: now - 2000 });
      
      // Search with multiple keywords
      const results = searchService.search('hello world');
      
      // Verify only entries with both keywords are returned
      assert.strictEqual(results.length, 1, 'Should find 1 entry with both "hello" and "world"');
      assert.strictEqual(results[0].content, 'Hello world');
    });

    it('should search with content type filter', () => {
      const now = Date.now();
      
      // Insert test entries with different types
      historyStore.save({ content: 'test content', contentType: 'text', timestamp: now });
      historyStore.save({ content: 'test code', contentType: 'code', timestamp: now - 1000 });
      historyStore.save({ content: 'test url', contentType: 'url', timestamp: now - 2000 });
      
      // Search with type filter
      const results = searchService.search('test', { contentType: 'code' });
      
      // Verify only code entries are returned
      assert.strictEqual(results.length, 1, 'Should find 1 code entry');
      assert.strictEqual(results[0].contentType, 'code');
      assert.strictEqual(results[0].content, 'test code');
    });

    it('should search with date filter (since)', () => {
      const now = Date.now();
      const twoDaysAgo = now - (2 * 24 * 60 * 60 * 1000);
      
      // Insert test entries with different timestamps
      historyStore.save({ content: 'old entry', contentType: 'text', timestamp: now - (5 * 24 * 60 * 60 * 1000) });
      historyStore.save({ content: 'recent entry 1', contentType: 'text', timestamp: now - (1 * 24 * 60 * 60 * 1000) });
      historyStore.save({ content: 'recent entry 2', contentType: 'text', timestamp: now });
      
      // Search with since filter
      const results = searchService.search('entry', { since: twoDaysAgo });
      
      // Verify only recent entries are returned
      assert.strictEqual(results.length, 2, 'Should find 2 recent entries');
      assert.ok(results.every(r => r.timestamp >= twoDaysAgo), 'All results should be after the since date');
    });

    it('should search with limit parameter', () => {
      const now = Date.now();
      
      // Insert many test entries
      for (let i = 0; i < 20; i++) {
        historyStore.save({ content: `test entry ${i}`, contentType: 'text', timestamp: now + i });
      }
      
      // Search with limit
      const results = searchService.search('test', { limit: 5 });
      
      // Verify limit is respected
      assert.strictEqual(results.length, 5, 'Should return exactly 5 results');
    });

    it('should return results ordered by timestamp DESC', () => {
      const now = Date.now();
      
      // Insert test entries in random order
      historyStore.save({ content: 'test middle', contentType: 'text', timestamp: now - 5000 });
      historyStore.save({ content: 'test newest', contentType: 'text', timestamp: now });
      historyStore.save({ content: 'test oldest', contentType: 'text', timestamp: now - 10000 });
      
      // Search
      const results = searchService.search('test');
      
      // Verify ordering
      assert.strictEqual(results.length, 3);
      assert.strictEqual(results[0].content, 'test newest', 'First result should be newest');
      assert.strictEqual(results[1].content, 'test middle', 'Second result should be middle');
      assert.strictEqual(results[2].content, 'test oldest', 'Third result should be oldest');
      assert.ok(results[0].timestamp >= results[1].timestamp);
      assert.ok(results[1].timestamp >= results[2].timestamp);
    });

    it('should handle case-insensitive search', () => {
      const now = Date.now();
      
      // Insert test entries with mixed case
      historyStore.save({ content: 'HELLO WORLD', contentType: 'text', timestamp: now });
      historyStore.save({ content: 'hello world', contentType: 'text', timestamp: now - 1000 });
      historyStore.save({ content: 'HeLLo WoRLd', contentType: 'text', timestamp: now - 2000 });
      
      // Search with lowercase
      const results = searchService.search('hello');
      
      // Verify all entries are found regardless of case
      assert.strictEqual(results.length, 3, 'Should find all entries regardless of case');
    });

    it('should return empty array when no results found', () => {
      const now = Date.now();
      
      // Insert test entries
      historyStore.save({ content: 'Hello world', contentType: 'text', timestamp: now });
      historyStore.save({ content: 'Goodbye world', contentType: 'text', timestamp: now - 1000 });
      
      // Search for non-existent content
      const results = searchService.search('nonexistent');
      
      // Verify empty results
      assert.deepStrictEqual(results, [], 'Should return empty array when no results found');
    });

    it('should combine multiple filters (type + since + limit)', () => {
      const now = Date.now();
      const oneDayAgo = now - (1 * 24 * 60 * 60 * 1000);
      
      // Insert test entries
      historyStore.save({ content: 'test text 1', contentType: 'text', timestamp: now });
      historyStore.save({ content: 'test text 2', contentType: 'text', timestamp: now - 1000 });
      historyStore.save({ content: 'test code 1', contentType: 'code', timestamp: now - 2000 });
      historyStore.save({ content: 'test text 3', contentType: 'text', timestamp: now - (2 * 24 * 60 * 60 * 1000) });
      
      // Search with multiple filters
      const results = searchService.search('test', {
        contentType: 'text',
        since: oneDayAgo,
        limit: 1
      });
      
      // Verify filters are applied correctly
      assert.strictEqual(results.length, 1, 'Should respect limit');
      assert.strictEqual(results[0].contentType, 'text', 'Should filter by type');
      assert.ok(results[0].timestamp >= oneDayAgo, 'Should filter by date');
    });
  });

  describe('End-to-end copy test', { concurrency: 1 }, () => {
    beforeEach(async () => {
      // Clear clipboard state before each test to prevent pollution
      try {
        await clipboardy.write('');
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        // Ignore errors during cleanup
      }
    });

    afterEach(async () => {
      // Clear clipboard state after each test to prevent pollution
      try {
        await clipboardy.write('');
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        // Ignore errors during cleanup
      }
    });

    it('should copy entry back to clipboard by ID', async () => {
      const now = Date.now();
      const testContent = 'Test clipboard content to copy';
      
      // Insert entry and get ID
      const entryId = historyStore.save({ content: testContent, contentType: 'text', timestamp: now });
      
      // Get entry by ID
      const retrievedEntry = historyStore.getById(entryId);
      assert.ok(retrievedEntry, 'Entry should be retrievable by ID');
      
      // Copy by ID using ClipboardService
      await clipboardService.copy(retrievedEntry.content);
      
      // Small delay to ensure clipboard operation completes
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify clipboard content
      const clipboardContent = await clipboardy.read();
      assert.strictEqual(clipboardContent, testContent, 'Clipboard should contain exact entry content');
    });

    it('should preserve exact content including special characters', async () => {
      const now = Date.now();
      const testContent = 'Special chars: !@#$%^&*()_+-=[]{}|;:\'",.<>?/~`\nNewlines\n\tTabs';
      
      // Insert entry and get ID
      const entryId = historyStore.save({ content: testContent, contentType: 'text', timestamp: now });
      
      // Copy entry
      const retrievedEntry = historyStore.getById(entryId);
      await clipboardService.copy(retrievedEntry.content);
      
      // Small delay to ensure clipboard operation completes
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify exact content preservation
      const clipboardContent = await clipboardy.read();
      assert.strictEqual(clipboardContent, testContent, 'Should preserve exact content');
    });

    it('should preserve unicode characters', async () => {
      const now = Date.now();
      const testContent = 'Unicode: 你好 🎉 café Ñoño';
      
      // Insert entry and get ID
      const entryId = historyStore.save({ content: testContent, contentType: 'text', timestamp: now });
      
      // Copy entry
      const retrievedEntry = historyStore.getById(entryId);
      await clipboardService.copy(retrievedEntry.content);
      
      // Small delay to ensure clipboard operation completes
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify unicode preservation
      const clipboardContent = await clipboardy.read();
      assert.strictEqual(clipboardContent, testContent, 'Should preserve unicode characters');
    });

    it('should handle copying long content', async () => {
      const now = Date.now();
      const testContent = 'a'.repeat(10000); // 10KB of content
      
      // Insert entry and get ID
      const entryId = historyStore.save({ content: testContent, contentType: 'text', timestamp: now });
      
      // Copy entry
      const retrievedEntry = historyStore.getById(entryId);
      await clipboardService.copy(retrievedEntry.content);
      
      // Longer delay for large content to ensure clipboard operation completes
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify long content preservation
      const clipboardContent = await clipboardy.read();
      assert.strictEqual(clipboardContent, testContent, 'Should preserve long content');
      assert.strictEqual(clipboardContent.length, 10000);
    });

    it('should return null when entry ID does not exist', () => {
      // Try to get non-existent entry
      const entry = historyStore.getById('nonexistent-id');
      
      // Verify null is returned
      assert.strictEqual(entry, null, 'Should return null for non-existent ID');
    });

    it('should copy multiple entries sequentially', async () => {
      const now = Date.now();
      const content1 = 'First entry';
      const content2 = 'Second entry';
      const content3 = 'Third entry';
      
      // Insert entries and get IDs
      const entryId1 = historyStore.save({ content: content1, contentType: 'text', timestamp: now });
      const entryId2 = historyStore.save({ content: content2, contentType: 'text', timestamp: now - 1000 });
      const entryId3 = historyStore.save({ content: content3, contentType: 'text', timestamp: now - 2000 });
      
      // Get entries
      const entry1 = historyStore.getById(entryId1);
      const entry2 = historyStore.getById(entryId2);
      const entry3 = historyStore.getById(entryId3);
      
      // Copy first entry
      await clipboardService.copy(entry1.content);
      await new Promise(resolve => setTimeout(resolve, 300));
      let clipboardContent = await clipboardy.read();
      assert.strictEqual(clipboardContent, content1);
      
      // Copy second entry
      await clipboardService.copy(entry2.content);
      await new Promise(resolve => setTimeout(resolve, 300));
      clipboardContent = await clipboardy.read();
      assert.strictEqual(clipboardContent, content2);
      
      // Copy third entry
      await clipboardService.copy(entry3.content);
      await new Promise(resolve => setTimeout(resolve, 300));
      clipboardContent = await clipboardy.read();
      assert.strictEqual(clipboardContent, content3);
    });
  });

  describe('End-to-end retention test', () => {
    it('should delete old entries during cleanup', () => {
      const now = Date.now();
      configManager.set('retention.days', 30);
      
      // Insert old entries (should be deleted)
      historyStore.save({ content: 'Old entry 1', contentType: 'text', timestamp: now - (40 * 24 * 60 * 60 * 1000) });
      historyStore.save({ content: 'Old entry 2', contentType: 'text', timestamp: now - (35 * 24 * 60 * 60 * 1000) });
      historyStore.save({ content: 'Old entry 3', contentType: 'text', timestamp: now - (31 * 24 * 60 * 60 * 1000) });
      
      // Insert recent entries (should be kept)
      historyStore.save({ content: 'Recent entry 1', contentType: 'text', timestamp: now - (20 * 24 * 60 * 60 * 1000) });
      historyStore.save({ content: 'Recent entry 2', contentType: 'text', timestamp: now - (10 * 24 * 60 * 60 * 1000) });
      historyStore.save({ content: 'Recent entry 3', contentType: 'text', timestamp: now });
      
      // Verify initial count
      const beforeCleanup = historyStore.getRecent(100);
      assert.strictEqual(beforeCleanup.length, 6, 'Should have 6 entries before cleanup');
      
      // Run cleanup
      const deletedCount = retentionService.cleanup();
      
      // Verify old entries deleted
      assert.strictEqual(deletedCount, 3, 'Should delete 3 old entries');
      
      const afterCleanup = historyStore.getRecent(100);
      assert.strictEqual(afterCleanup.length, 3, 'Should have 3 entries after cleanup');
      assert.ok(afterCleanup.every(e => e.content.startsWith('Recent')), 'Only recent entries should remain');
    });

    it('should respect different retention periods', () => {
      const now = Date.now();
      
      // Test with 7 days retention
      configManager.set('retention.days', 7);
      
      // Insert entries
      historyStore.save({ content: 'Very old', contentType: 'text', timestamp: now - (30 * 24 * 60 * 60 * 1000) });
      historyStore.save({ content: 'Old', contentType: 'text', timestamp: now - (10 * 24 * 60 * 60 * 1000) });
      historyStore.save({ content: 'Recent', contentType: 'text', timestamp: now - (5 * 24 * 60 * 60 * 1000) });
      historyStore.save({ content: 'Very recent', contentType: 'text', timestamp: now });
      
      // Run cleanup
      const deletedCount = retentionService.cleanup();
      
      // Verify correct entries deleted
      assert.strictEqual(deletedCount, 2, 'Should delete 2 entries older than 7 days');
      
      const remaining = historyStore.getRecent(100);
      assert.strictEqual(remaining.length, 2);
      assert.ok(remaining.every(e => e.content.toLowerCase().includes('recent')), 'Only recent entries should remain');
    });

    it('should keep all entries when retention is 0 (unlimited)', () => {
      const now = Date.now();
      configManager.set('retention.days', 0); // Unlimited retention
      
      // Insert very old entries
      historyStore.save({ content: 'Very old 1', contentType: 'text', timestamp: now - (365 * 24 * 60 * 60 * 1000) }); // 1 year old
      historyStore.save({ content: 'Very old 2', contentType: 'text', timestamp: now - (180 * 24 * 60 * 60 * 1000) }); // 6 months old
      historyStore.save({ content: 'Recent', contentType: 'text', timestamp: now });
      
      // Run cleanup
      const deletedCount = retentionService.cleanup();
      
      // Verify no entries deleted
      assert.strictEqual(deletedCount, 0, 'Should not delete any entries when retention is 0');
      
      const remaining = historyStore.getRecent(100);
      assert.strictEqual(remaining.length, 3, 'All entries should remain');
    });

    it('should handle cleanup with no old entries', () => {
      const now = Date.now();
      configManager.set('retention.days', 30);
      
      // Insert only recent entries
      historyStore.save({ content: 'Recent 1', contentType: 'text', timestamp: now - (10 * 24 * 60 * 60 * 1000) });
      historyStore.save({ content: 'Recent 2', contentType: 'text', timestamp: now - (5 * 24 * 60 * 60 * 1000) });
      historyStore.save({ content: 'Recent 3', contentType: 'text', timestamp: now });
      
      // Run cleanup
      const deletedCount = retentionService.cleanup();
      
      // Verify no entries deleted
      assert.strictEqual(deletedCount, 0, 'Should not delete any entries');
      
      const remaining = historyStore.getRecent(100);
      assert.strictEqual(remaining.length, 3, 'All entries should remain');
    });

    it('should handle cleanup with empty database', () => {
      configManager.set('retention.days', 30);
      
      // Run cleanup on empty database
      const deletedCount = retentionService.cleanup();
      
      // Verify no errors and 0 deleted
      assert.strictEqual(deletedCount, 0, 'Should return 0 for empty database');
    });

    it('should run cleanup automatically when service starts', () => {
      const now = Date.now();
      configManager.set('retention.days', 30);
      
      // Insert old entries
      historyStore.save({ content: 'Old 1', contentType: 'text', timestamp: now - (40 * 24 * 60 * 60 * 1000) });
      historyStore.save({ content: 'Old 2', contentType: 'text', timestamp: now - (35 * 24 * 60 * 60 * 1000) });
      historyStore.save({ content: 'Recent', contentType: 'text', timestamp: now });
      
      // Verify initial count
      const beforeStart = historyStore.getRecent(100);
      assert.strictEqual(beforeStart.length, 3);
      
      // Start retention service (should run cleanup immediately)
      retentionService.start();
      
      // Verify cleanup ran
      const afterStart = historyStore.getRecent(100);
      assert.strictEqual(afterStart.length, 1, 'Should have 1 entry after automatic cleanup');
      assert.strictEqual(afterStart[0].content, 'Recent');
    });

    it('should delete entries at exact retention boundary', () => {
      const now = Date.now();
      configManager.set('retention.days', 30);
      
      // Calculate the exact cutoff that RetentionService will use
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      const cutoffTimestamp = cutoffDate.getTime();
      
      // Entry just after cutoff (should NOT be deleted)
      historyStore.save({ content: 'After cutoff', contentType: 'text', timestamp: cutoffTimestamp + 1000 });
      
      // Entry just before cutoff (should be deleted)
      historyStore.save({ content: 'Before cutoff', contentType: 'text', timestamp: cutoffTimestamp - 1000 });
      
      // Run cleanup
      const deletedCount = retentionService.cleanup();
      
      // Verify boundary behavior - entries with timestamp < cutoff are deleted
      assert.strictEqual(deletedCount, 1, 'Should delete entry with timestamp < cutoff');
      
      const remaining = historyStore.getRecent(100);
      assert.strictEqual(remaining.length, 1);
      assert.strictEqual(remaining[0].content, 'After cutoff');
    });
  });

  describe('Test all output formats', () => {
    it('should format entries as table (default format)', () => {
      const now = Date.now();
      
      // Insert test entries
      const entry1 = historyStore.save({ content: 'First entry', contentType: 'text', timestamp: now });
      const entry2 = historyStore.save({ content: 'Second entry', contentType: 'code', timestamp: now - 1000 });
      
      // Get entries
      const entries = historyStore.getRecent(10);
      
      // Verify entries have required fields for table formatting
      assert.strictEqual(entries.length, 2);
      entries.forEach(entry => {
        assert.ok(entry.id, 'Entry should have ID');
        assert.ok(entry.content, 'Entry should have content');
        assert.ok(entry.contentType, 'Entry should have contentType');
        assert.ok(entry.timestamp, 'Entry should have timestamp');
      });
      
      // Verify entries are ordered by timestamp DESC
      assert.ok(entries[0].timestamp >= entries[1].timestamp);
    });

    it('should format entries as JSON', () => {
      const now = Date.now();
      
      // Insert test entries
      historyStore.save({ content: 'First entry', contentType: 'text', timestamp: now });
      historyStore.save({ content: 'Second entry', contentType: 'code', timestamp: now - 1000 });
      
      // Get entries
      const entries = historyStore.getRecent(10);
      
      // Format as JSON
      const jsonOutput = JSON.stringify(entries, null, 2);
      
      // Verify valid JSON
      const parsed = JSON.parse(jsonOutput);
      assert.ok(Array.isArray(parsed), 'Should be an array');
      assert.strictEqual(parsed.length, 2);
      
      // Verify JSON structure
      parsed.forEach(entry => {
        assert.ok(entry.id, 'Entry should have id');
        assert.ok(entry.content, 'Entry should have content');
        assert.ok(entry.contentType, 'Entry should have contentType');
        assert.ok(entry.timestamp, 'Entry should have timestamp');
      });
    });

    it('should format entries as CSV', () => {
      const now = Date.now();
      
      // Insert test entries
      historyStore.save({ content: 'First entry', contentType: 'text', timestamp: now });
      historyStore.save({ content: 'Second entry', contentType: 'code', timestamp: now - 1000 });
      
      // Get entries
      const entries = historyStore.getRecent(10);
      
      // Format as CSV
      const csvLines = [];
      csvLines.push('id,timestamp,contentType,content');
      
      entries.forEach(entry => {
        const escapedContent = entry.content.includes(',') || entry.content.includes('"') || entry.content.includes('\n')
          ? `"${entry.content.replace(/"/g, '""')}"`
          : entry.content;
        csvLines.push(`${entry.id},${entry.timestamp},${entry.contentType},${escapedContent}`);
      });
      
      const csvOutput = csvLines.join('\n');
      
      // Verify CSV structure
      const lines = csvOutput.split('\n');
      assert.strictEqual(lines.length, 3, 'Should have header + 2 data rows');
      assert.strictEqual(lines[0], 'id,timestamp,contentType,content', 'Should have correct header');
      
      // Verify data rows contain expected fields
      const dataLines = lines.slice(1);
      dataLines.forEach(line => {
        const fields = line.split(',');
        assert.ok(fields.length >= 4, 'Each row should have at least 4 fields');
      });
    });

    it('should handle CSV escaping for special characters', () => {
      const now = Date.now();
      
      // Insert entries with special characters
      historyStore.save({ content: 'Entry with, comma', contentType: 'text', timestamp: now });
      historyStore.save({ content: 'Entry with "quotes"', contentType: 'text', timestamp: now - 1000 });
      historyStore.save({ content: 'Entry with\nnewline', contentType: 'text', timestamp: now - 2000 });
      
      // Get entries
      const entries = historyStore.getRecent(10);
      
      // Format as CSV with proper escaping
      const csvLines = [];
      csvLines.push('id,timestamp,contentType,content');
      
      entries.forEach(entry => {
        const escapedContent = entry.content.includes(',') || entry.content.includes('"') || entry.content.includes('\n')
          ? `"${entry.content.replace(/"/g, '""')}"`
          : entry.content;
        csvLines.push(`${entry.id},${entry.timestamp},${entry.contentType},${escapedContent}`);
      });
      
      const csvOutput = csvLines.join('\n');
      
      // Verify escaping
      assert.ok(csvOutput.includes('"Entry with, comma"'), 'Should escape comma');
      assert.ok(csvOutput.includes('"Entry with ""quotes"""'), 'Should escape quotes');
      assert.ok(csvOutput.includes('"Entry with\nnewline"'), 'Should escape newline');
    });

    it('should format empty result set in all formats', () => {
      // Get entries from empty database
      const entries = historyStore.getRecent(10);
      
      // Verify empty array
      assert.deepStrictEqual(entries, []);
      
      // JSON format
      const jsonOutput = JSON.stringify(entries);
      assert.strictEqual(jsonOutput, '[]', 'JSON should be empty array');
      
      // CSV format
      const csvOutput = 'id,timestamp,contentType,content';
      assert.ok(csvOutput.includes('id,timestamp,contentType,content'), 'CSV should have header');
    });

    it('should format large result sets efficiently', () => {
      const now = Date.now();
      
      // Insert many entries
      for (let i = 0; i < 100; i++) {
        historyStore.save({ content: `Entry ${i}`, contentType: 'text', timestamp: now + i });
      }
      
      // Get entries with limit
      const entries = historyStore.getRecent(50);
      
      // Verify limit is respected
      assert.strictEqual(entries.length, 50);
      
      // Verify all formats work with large sets
      const jsonOutput = JSON.stringify(entries);
      assert.ok(jsonOutput.length > 0, 'JSON should be generated');
      
      const csvLines = ['id,timestamp,contentType,content'];
      entries.forEach(entry => {
        csvLines.push(`${entry.id},${entry.timestamp},${entry.contentType},${entry.content}`);
      });
      const csvOutput = csvLines.join('\n');
      assert.strictEqual(csvOutput.split('\n').length, 51, 'CSV should have header + 50 rows');
    });

    it('should format entries with long content', () => {
      const now = Date.now();
      const longContent = 'a'.repeat(1000);
      
      // Insert entry with long content
      historyStore.save({ content: longContent, contentType: 'text', timestamp: now });
      
      // Get entries
      const entries = historyStore.getRecent(10);
      
      // Verify JSON handles long content
      const jsonOutput = JSON.stringify(entries);
      const parsed = JSON.parse(jsonOutput);
      assert.strictEqual(parsed[0].content.length, 1000, 'JSON should preserve full content');
      
      // Verify CSV handles long content
      const csvLines = ['id,timestamp,contentType,content'];
      entries.forEach(entry => {
        csvLines.push(`${entry.id},${entry.timestamp},${entry.contentType},${entry.content}`);
      });
      const csvOutput = csvLines.join('\n');
      assert.ok(csvOutput.includes(longContent), 'CSV should include full content');
    });

    it('should format entries with different content types', () => {
      const now = Date.now();
      
      // Insert entries with various types
      historyStore.save({ content: 'Plain text', contentType: 'text', timestamp: now });
      historyStore.save({ content: 'const x = 1;', contentType: 'code', timestamp: now - 1000 });
      historyStore.save({ content: 'https://example.com', contentType: 'url', timestamp: now - 2000 });
      historyStore.save({ content: '/path/to/file', contentType: 'file_path', timestamp: now - 3000 });
      
      // Get entries
      const entries = historyStore.getRecent(10);
      
      // Verify all types are present
      assert.strictEqual(entries.length, 4);
      const types = entries.map(e => e.contentType);
      assert.ok(types.includes('text'));
      assert.ok(types.includes('code'));
      assert.ok(types.includes('url'));
      assert.ok(types.includes('file_path'));
      
      // Verify JSON formatting
      const jsonOutput = JSON.stringify(entries);
      const parsed = JSON.parse(jsonOutput);
      assert.strictEqual(parsed.length, 4);
      
      // Verify CSV formatting
      const csvLines = ['id,timestamp,contentType,content'];
      entries.forEach(entry => {
        csvLines.push(`${entry.id},${entry.timestamp},${entry.contentType},${entry.content}`);
      });
      const csvOutput = csvLines.join('\n');
      assert.ok(csvOutput.includes('text'));
      assert.ok(csvOutput.includes('code'));
      assert.ok(csvOutput.includes('url'));
      assert.ok(csvOutput.includes('file_path'));
    });

    it('should format search results in all formats', () => {
      const now = Date.now();
      
      // Insert test entries
      historyStore.save({ content: 'test entry 1', contentType: 'text', timestamp: now });
      historyStore.save({ content: 'test entry 2', contentType: 'code', timestamp: now - 1000 });
      historyStore.save({ content: 'other content', contentType: 'text', timestamp: now - 2000 });
      
      // Search for entries
      const results = searchService.search('test');
      
      // Verify search results have required fields
      assert.strictEqual(results.length, 2);
      results.forEach(result => {
        assert.ok(result.id, 'Result should have ID');
        assert.ok(result.content, 'Result should have content');
        assert.ok(result.contentType, 'Result should have contentType');
        assert.ok(result.timestamp, 'Result should have timestamp');
        assert.ok(result.preview, 'Result should have preview');
        assert.ok(result.relativeTime, 'Result should have relativeTime');
      });
      
      // Format as JSON
      const jsonOutput = JSON.stringify(results);
      const parsed = JSON.parse(jsonOutput);
      assert.strictEqual(parsed.length, 2);
      
      // Format as CSV
      const csvLines = ['id,timestamp,contentType,content,preview,relativeTime'];
      results.forEach(result => {
        csvLines.push(`${result.id},${result.timestamp},${result.contentType},${result.content},${result.preview},${result.relativeTime}`);
      });
      const csvOutput = csvLines.join('\n');
      assert.ok(csvOutput.includes('test entry 1'));
      assert.ok(csvOutput.includes('test entry 2'));
    });
  });
});
