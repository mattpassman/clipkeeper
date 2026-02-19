/**
 * Tests for CLI class
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import CLI from '../src/cli.js';

describe('CLI', () => {
  it('should create a CLI instance', () => {
    const cli = new CLI();
    assert.ok(cli instanceof CLI);
    assert.ok(cli.program);
  });

  it('should have all required commands', () => {
    const cli = new CLI();
    const commands = cli.program.commands.map(cmd => cmd.name());
    
    // Service management commands
    assert.ok(commands.includes('start'));
    assert.ok(commands.includes('stop'));
    assert.ok(commands.includes('status'));
    
    // History commands
    assert.ok(commands.includes('search'));
    assert.ok(commands.includes('list'));
    assert.ok(commands.includes('copy'));
    assert.ok(commands.includes('clear'));
    
    // Configuration commands
    assert.ok(commands.includes('config'));
  });

  it('should have correct program metadata', () => {
    const cli = new CLI();
    assert.strictEqual(cli.program.name(), 'clipkeeper');
    assert.strictEqual(cli.program.version(), '0.1.0');
  });

  it('should have list command with correct options', () => {
    const cli = new CLI();
    const listCommand = cli.program.commands.find(cmd => cmd.name() === 'list');
    
    assert.ok(listCommand);
    const options = listCommand.options.map(opt => opt.long);
    assert.ok(options.includes('--limit'));
    assert.ok(options.includes('--type'));
  });

  it('should have clear command with confirm option', () => {
    const cli = new CLI();
    const clearCommand = cli.program.commands.find(cmd => cmd.name() === 'clear');
    
    assert.ok(clearCommand);
    const options = clearCommand.options.map(opt => opt.long);
    assert.ok(options.includes('--confirm'));
  });

  it('should have config subcommands', () => {
    const cli = new CLI();
    const configCommand = cli.program.commands.find(cmd => cmd.name() === 'config');
    
    assert.ok(configCommand);
    const subcommands = configCommand.commands.map(cmd => cmd.name());
    assert.ok(subcommands.includes('set'));
    assert.ok(subcommands.includes('show'));
    assert.ok(subcommands.includes('get'));
  });

  it('should have handler methods', () => {
    const cli = new CLI();
    
    assert.strictEqual(typeof cli.handleStart, 'function');
    assert.strictEqual(typeof cli.handleStop, 'function');
    assert.strictEqual(typeof cli.handleStatus, 'function');
    assert.strictEqual(typeof cli.handleSearch, 'function');
    assert.strictEqual(typeof cli.handleList, 'function');
    assert.strictEqual(typeof cli.handleCopy, 'function');
    assert.strictEqual(typeof cli.handleClear, 'function');
    assert.strictEqual(typeof cli.handleConfigSet, 'function');
    assert.strictEqual(typeof cli.handleConfigShow, 'function');
    assert.strictEqual(typeof cli.handleConfigGet, 'function');
  });
});

describe('CLI - List Command', () => {
  it('should display entries in table format', async () => {
    const { default: HistoryStore } = await import('../src/HistoryStore.js');
    const store = new HistoryStore(':memory:');
    
    // Add test entries
    const entries = [
      {
        content: 'Hello World',
        contentType: 'text',
        timestamp: Date.now() - 1000
      },
      {
        content: 'https://example.com',
        contentType: 'url',
        timestamp: Date.now() - 2000
      },
      {
        content: 'function test() { return true; }',
        contentType: 'code',
        timestamp: Date.now() - 3000
      }
    ];
    
    for (const entry of entries) {
      store.save(entry);
    }
    
    // Retrieve entries
    const retrieved = store.getRecent(10);
    assert.strictEqual(retrieved.length, 3);
    
    // Verify order (most recent first)
    assert.strictEqual(retrieved[0].content, 'Hello World');
    assert.strictEqual(retrieved[1].content, 'https://example.com');
    assert.strictEqual(retrieved[2].content, 'function test() { return true; }');
    
    store.close();
  });

  it('should filter entries by type', async () => {
    const { default: HistoryStore } = await import('../src/HistoryStore.js');
    const store = new HistoryStore(':memory:');
    
    // Add test entries with different types
    store.save({ content: 'Hello', contentType: 'text', timestamp: Date.now() });
    store.save({ content: 'https://example.com', contentType: 'url', timestamp: Date.now() });
    store.save({ content: 'function test() {}', contentType: 'code', timestamp: Date.now() });
    store.save({ content: 'Another text', contentType: 'text', timestamp: Date.now() });
    
    // Filter by type
    const codeEntries = store.getRecentByType(10, 'code');
    assert.strictEqual(codeEntries.length, 1);
    assert.strictEqual(codeEntries[0].contentType, 'code');
    
    const textEntries = store.getRecentByType(10, 'text');
    assert.strictEqual(textEntries.length, 2);
    assert.strictEqual(textEntries[0].contentType, 'text');
    assert.strictEqual(textEntries[1].contentType, 'text');
    
    store.close();
  });

  it('should respect limit parameter', async () => {
    const { default: HistoryStore } = await import('../src/HistoryStore.js');
    const store = new HistoryStore(':memory:');
    
    // Add 20 entries
    for (let i = 0; i < 20; i++) {
      store.save({
        content: `Entry ${i}`,
        contentType: 'text',
        timestamp: Date.now() + i
      });
    }
    
    // Test different limits
    const limit5 = store.getRecent(5);
    assert.strictEqual(limit5.length, 5);
    
    const limit10 = store.getRecent(10);
    assert.strictEqual(limit10.length, 10);
    
    const limit15 = store.getRecent(15);
    assert.strictEqual(limit15.length, 15);
    
    store.close();
  });

  it('should handle empty database', async () => {
    const { default: HistoryStore } = await import('../src/HistoryStore.js');
    const store = new HistoryStore(':memory:');
    
    const entries = store.getRecent(10);
    assert.strictEqual(entries.length, 0);
    
    store.close();
  });

  it('should format timestamps correctly', () => {
    const cli = new CLI();
    
    const now = new Date();
    const oneMinAgo = new Date(now - 60000);
    const oneHourAgo = new Date(now - 3600000);
    const oneDayAgo = new Date(now - 86400000);
    const oneWeekAgo = new Date(now - 7 * 86400000);
    
    // Test relative time
    assert.match(cli._formatTimestamp(oneMinAgo), /1 min ago/);
    assert.match(cli._formatTimestamp(oneHourAgo), /1 hour ago/);
    assert.match(cli._formatTimestamp(oneDayAgo), /1 day ago/);
    
    // Test absolute time for older entries
    const formatted = cli._formatTimestamp(oneWeekAgo);
    assert.match(formatted, /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
  });

  it('should format preview correctly', () => {
    const cli = new CLI();
    
    // Test normal text
    const shortText = 'Hello World';
    assert.strictEqual(cli._formatPreview(shortText, 60), 'Hello World');
    
    // Test truncation
    const longText = 'a'.repeat(100);
    const preview = cli._formatPreview(longText, 60);
    assert.strictEqual(preview.length, 60);
    assert.ok(preview.endsWith('...'));
    
    // Test newline replacement
    const multiline = 'Line 1\nLine 2\nLine 3';
    const formatted = cli._formatPreview(multiline, 60);
    assert.ok(!formatted.includes('\n'));
    assert.strictEqual(formatted, 'Line 1 Line 2 Line 3');
  });
});

describe('CLI - Clear Command', () => {
  it('should clear all entries from database', async () => {
    const { default: HistoryStore } = await import('../src/HistoryStore.js');
    const store = new HistoryStore(':memory:');
    
    // Add test entries
    for (let i = 0; i < 10; i++) {
      store.save({
        content: `Entry ${i}`,
        contentType: 'text',
        timestamp: Date.now() + i
      });
    }
    
    // Verify entries exist
    let entries = store.getRecent(100);
    assert.strictEqual(entries.length, 10);
    
    // Clear all entries
    const deletedCount = store.clear();
    assert.strictEqual(deletedCount, 10);
    
    // Verify database is empty
    entries = store.getRecent(100);
    assert.strictEqual(entries.length, 0);
    
    store.close();
  });

  it('should return count of deleted entries', async () => {
    const { default: HistoryStore } = await import('../src/HistoryStore.js');
    const store = new HistoryStore(':memory:');
    
    // Add 5 entries
    for (let i = 0; i < 5; i++) {
      store.save({
        content: `Entry ${i}`,
        contentType: 'text',
        timestamp: Date.now()
      });
    }
    
    // Clear and check count
    const deletedCount = store.clear();
    assert.strictEqual(deletedCount, 5);
    
    store.close();
  });

  it('should return 0 when clearing empty database', async () => {
    const { default: HistoryStore } = await import('../src/HistoryStore.js');
    const store = new HistoryStore(':memory:');
    
    // Clear empty database
    const deletedCount = store.clear();
    assert.strictEqual(deletedCount, 0);
    
    store.close();
  });

  it('should handle multiple clear operations', async () => {
    const { default: HistoryStore } = await import('../src/HistoryStore.js');
    const store = new HistoryStore(':memory:');
    
    // Add entries
    for (let i = 0; i < 3; i++) {
      store.save({
        content: `Entry ${i}`,
        contentType: 'text',
        timestamp: Date.now()
      });
    }
    
    // First clear
    let deletedCount = store.clear();
    assert.strictEqual(deletedCount, 3);
    
    // Second clear (should be 0)
    deletedCount = store.clear();
    assert.strictEqual(deletedCount, 0);
    
    // Add more entries
    for (let i = 0; i < 2; i++) {
      store.save({
        content: `New Entry ${i}`,
        contentType: 'text',
        timestamp: Date.now()
      });
    }
    
    // Third clear
    deletedCount = store.clear();
    assert.strictEqual(deletedCount, 2);
    
    store.close();
  });

  it('should have _promptConfirmation method', () => {
    const cli = new CLI();
    assert.strictEqual(typeof cli._promptConfirmation, 'function');
  });
});


describe('CLI - Search Command', () => {
  it('should have search command with correct options', () => {
    const cli = new CLI();
    const searchCommand = cli.program.commands.find(cmd => cmd.name() === 'search');
    
    assert.ok(searchCommand);
    const options = searchCommand.options.map(opt => opt.long);
    assert.ok(options.includes('--limit'));
    assert.ok(options.includes('--type'));
    assert.ok(options.includes('--since'));
  });

  it('should parse ISO date format (YYYY-MM-DD)', () => {
    const cli = new CLI();
    
    const date = cli._parseDate('2024-01-15');
    assert.ok(date instanceof Date);
    assert.strictEqual(date.getFullYear(), 2024);
    assert.strictEqual(date.getMonth(), 0); // January (0-indexed)
    assert.strictEqual(date.getDate(), 15);
  });

  it('should parse "today" relative term', () => {
    const cli = new CLI();
    
    const date = cli._parseDate('today');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    assert.ok(date instanceof Date);
    assert.strictEqual(date.getFullYear(), today.getFullYear());
    assert.strictEqual(date.getMonth(), today.getMonth());
    assert.strictEqual(date.getDate(), today.getDate());
    assert.strictEqual(date.getHours(), 0);
    assert.strictEqual(date.getMinutes(), 0);
  });

  it('should parse "yesterday" relative term', () => {
    const cli = new CLI();
    
    const date = cli._parseDate('yesterday');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    assert.ok(date instanceof Date);
    assert.strictEqual(date.getFullYear(), yesterday.getFullYear());
    assert.strictEqual(date.getMonth(), yesterday.getMonth());
    assert.strictEqual(date.getDate(), yesterday.getDate());
  });

  it('should parse relative offsets (N days ago)', () => {
    const cli = new CLI();
    
    const date = cli._parseDate('7 days ago');
    const expected = new Date();
    expected.setDate(expected.getDate() - 7);
    expected.setHours(0, 0, 0, 0);
    
    assert.ok(date instanceof Date);
    assert.strictEqual(date.getFullYear(), expected.getFullYear());
    assert.strictEqual(date.getMonth(), expected.getMonth());
    assert.strictEqual(date.getDate(), expected.getDate());
  });

  it('should parse relative offsets (N weeks ago)', () => {
    const cli = new CLI();
    
    const date = cli._parseDate('2 weeks ago');
    const expected = new Date();
    expected.setDate(expected.getDate() - 14);
    expected.setHours(0, 0, 0, 0);
    
    assert.ok(date instanceof Date);
    assert.strictEqual(date.getFullYear(), expected.getFullYear());
    assert.strictEqual(date.getMonth(), expected.getMonth());
    assert.strictEqual(date.getDate(), expected.getDate());
  });

  it('should parse relative offsets (N months ago)', () => {
    const cli = new CLI();
    
    const date = cli._parseDate('3 months ago');
    const expected = new Date();
    expected.setMonth(expected.getMonth() - 3);
    expected.setHours(0, 0, 0, 0);
    
    assert.ok(date instanceof Date);
    assert.strictEqual(date.getFullYear(), expected.getFullYear());
    assert.strictEqual(date.getMonth(), expected.getMonth());
  });

  it('should throw error for invalid date format', () => {
    const cli = new CLI();
    
    assert.throws(() => {
      cli._parseDate('invalid-date');
    }, /Invalid date format/);
    
    assert.throws(() => {
      cli._parseDate('2024-13-01'); // Invalid month
    }, /Invalid date/);
    
    assert.throws(() => {
      cli._parseDate('2024-02-30'); // Invalid day
    }, /Invalid date/);
  });

  it('should throw error for empty or null date string', () => {
    const cli = new CLI();
    
    assert.throws(() => {
      cli._parseDate('');
    }, /Invalid date format/);
    
    assert.throws(() => {
      cli._parseDate(null);
    }, /Invalid date format/);
  });

  it('should have _displaySearchResultsTable method', () => {
    const cli = new CLI();
    assert.strictEqual(typeof cli._displaySearchResultsTable, 'function');
  });

  it('should format search results with IDs', async () => {
    const { default: HistoryStore } = await import('../src/HistoryStore.js');
    const { default: SearchService } = await import('../src/SearchService.js');
    
    const store = new HistoryStore(':memory:');
    
    // Add test entries
    store.save({
      content: 'Hello World error message',
      contentType: 'text',
      timestamp: Date.now()
    });
    store.save({
      content: 'Another error occurred',
      contentType: 'text',
      timestamp: Date.now() - 1000
    });
    store.save({
      content: 'No match here',
      contentType: 'text',
      timestamp: Date.now() - 2000
    });
    
    const searchService = new SearchService(store);
    const results = searchService.search('error');
    
    // Verify results have required fields
    assert.strictEqual(results.length, 2);
    assert.ok(results[0].id);
    assert.ok(results[0].preview);
    assert.ok(results[0].relativeTime);
    assert.ok(results[0].contentType || results[0].content_type);
    
    store.close();
  });

  it('should handle search with type filter', async () => {
    const { default: HistoryStore } = await import('../src/HistoryStore.js');
    const { default: SearchService } = await import('../src/SearchService.js');
    
    const store = new HistoryStore(':memory:');
    
    // Add test entries with different types
    store.save({
      content: 'function test() { return error; }',
      contentType: 'code',
      timestamp: Date.now()
    });
    store.save({
      content: 'Error message in text',
      contentType: 'text',
      timestamp: Date.now() - 1000
    });
    
    const searchService = new SearchService(store);
    const results = searchService.search('error', { contentType: 'code' });
    
    // Should only return code entries
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].contentType, 'code');
    
    store.close();
  });

  it('should handle search with limit', async () => {
    const { default: HistoryStore } = await import('../src/HistoryStore.js');
    const { default: SearchService } = await import('../src/SearchService.js');
    
    const store = new HistoryStore(':memory:');
    
    // Add 10 entries with "test"
    for (let i = 0; i < 10; i++) {
      store.save({
        content: `Test entry ${i}`,
        contentType: 'text',
        timestamp: Date.now() + i
      });
    }
    
    const searchService = new SearchService(store);
    const results = searchService.search('test', { limit: 5 });
    
    // Should only return 5 results
    assert.strictEqual(results.length, 5);
    
    store.close();
  });

  it('should handle search with since filter', async () => {
    const { default: HistoryStore } = await import('../src/HistoryStore.js');
    const { default: SearchService } = await import('../src/SearchService.js');
    
    const store = new HistoryStore(':memory:');
    
    const now = Date.now();
    const twoDaysAgo = now - (2 * 24 * 60 * 60 * 1000);
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    
    // Add entries at different times
    store.save({
      content: 'Old test entry',
      contentType: 'text',
      timestamp: twoDaysAgo
    });
    store.save({
      content: 'Recent test entry',
      contentType: 'text',
      timestamp: oneDayAgo
    });
    store.save({
      content: 'Very recent test entry',
      contentType: 'text',
      timestamp: now
    });
    
    const searchService = new SearchService(store);
    const cutoffDate = new Date(oneDayAgo - 1000); // Just before oneDayAgo
    const results = searchService.search('test', { since: cutoffDate });
    
    // Should only return entries after cutoff
    assert.strictEqual(results.length, 2);
    assert.ok(results.every(r => r.timestamp >= cutoffDate.getTime()));
    
    store.close();
  });

  it('should handle empty search results', async () => {
    const { default: HistoryStore } = await import('../src/HistoryStore.js');
    const { default: SearchService } = await import('../src/SearchService.js');
    
    const store = new HistoryStore(':memory:');
    
    // Add entries that won't match
    store.save({
      content: 'Hello World',
      contentType: 'text',
      timestamp: Date.now()
    });
    
    const searchService = new SearchService(store);
    const results = searchService.search('nonexistent');
    
    // Should return empty array
    assert.strictEqual(results.length, 0);
    
    store.close();
  });

  it('should handle case-insensitive search', async () => {
    const { default: HistoryStore } = await import('../src/HistoryStore.js');
    const { default: SearchService } = await import('../src/SearchService.js');
    
    const store = new HistoryStore(':memory:');
    
    store.save({
      content: 'ERROR Message',
      contentType: 'text',
      timestamp: Date.now()
    });
    
    const searchService = new SearchService(store);
    
    // Search with lowercase
    const results1 = searchService.search('error');
    assert.strictEqual(results1.length, 1);
    
    // Search with uppercase
    const results2 = searchService.search('ERROR');
    assert.strictEqual(results2.length, 1);
    
    // Search with mixed case
    const results3 = searchService.search('ErRoR');
    assert.strictEqual(results3.length, 1);
    
    store.close();
  });

  it('should handle multiple keyword search (AND logic)', async () => {
    const { default: HistoryStore } = await import('../src/HistoryStore.js');
    const { default: SearchService } = await import('../src/SearchService.js');
    
    const store = new HistoryStore(':memory:');
    
    store.save({
      content: 'Error message from database',
      contentType: 'text',
      timestamp: Date.now()
    });
    store.save({
      content: 'Error in application',
      contentType: 'text',
      timestamp: Date.now() - 1000
    });
    store.save({
      content: 'Database connection successful',
      contentType: 'text',
      timestamp: Date.now() - 2000
    });
    
    const searchService = new SearchService(store);
    const results = searchService.search('error database');
    
    // Should only return entry with both keywords
    assert.strictEqual(results.length, 1);
    assert.ok(results[0].content.toLowerCase().includes('error'));
    assert.ok(results[0].content.toLowerCase().includes('database'));
    
    store.close();
  });
});


describe('CLI - Copy Command', () => {
  it('should have copy command', () => {
    const cli = new CLI();
    const commands = cli.program.commands.map(cmd => cmd.name());
    assert.ok(commands.includes('copy'));
  });

  it('should have handleCopy method', () => {
    const cli = new CLI();
    assert.strictEqual(typeof cli.handleCopy, 'function');
  });

  it('should retrieve entry by ID successfully', async () => {
    const { default: HistoryStore } = await import('../src/HistoryStore.js');
    
    const store = new HistoryStore(':memory:');
    
    // Add test entry
    const testContent = 'Test clipboard content for copy test';
    const entryId = store.save({
      content: testContent,
      contentType: 'text',
      timestamp: Date.now()
    });
    
    // Get entry by ID (this is what handleCopy does)
    const entry = store.getById(entryId);
    assert.ok(entry);
    assert.strictEqual(entry.content, testContent);
    assert.strictEqual(entry.id, entryId);
    
    store.close();
  });

  it('should preserve content exactly in database', async () => {
    const { default: HistoryStore } = await import('../src/HistoryStore.js');
    
    const store = new HistoryStore(':memory:');
    
    // Test with content that has special characters
    const testContent = 'Text with\nnewlines\nand\ttabs for preservation test';
    
    const entryId = store.save({
      content: testContent,
      contentType: 'text',
      timestamp: Date.now()
    });
    
    const entry = store.getById(entryId);
    assert.strictEqual(entry.content, testContent);
    
    store.close();
  });

  it('should return null for non-existent entry ID', async () => {
    const { default: HistoryStore } = await import('../src/HistoryStore.js');
    const store = new HistoryStore(':memory:');
    
    const entry = store.getById('non-existent-id');
    assert.strictEqual(entry, null);
    
    store.close();
  });

  it('should handle error when copying fails', async () => {
    const { default: ClipboardService } = await import('../src/ClipboardService.js');
    const clipboardService = new ClipboardService();
    
    // Test with invalid content (null)
    try {
      await clipboardService.copy(null);
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok(error.message.includes('Failed to copy to clipboard'));
    }
  });
});

describe('CLI - Enhanced List Command', () => {
  it('should have new options for list command', () => {
    const cli = new CLI();
    const listCommand = cli.program.commands.find(cmd => cmd.name() === 'list');
    
    assert.ok(listCommand);
    const options = listCommand.options.map(opt => opt.long);
    assert.ok(options.includes('--limit'));
    assert.ok(options.includes('--type'));
    assert.ok(options.includes('--search'));
    assert.ok(options.includes('--since'));
    assert.ok(options.includes('--format'));
  });

  it('should format entries as JSON', async () => {
    const { default: HistoryStore } = await import('../src/HistoryStore.js');
    const store = new HistoryStore(':memory:');
    
    const now = Date.now();
    
    // Add test entries with different timestamps
    const entry1 = store.save({
      content: 'Hello World',
      contentType: 'text',
      timestamp: now - 1000
    });
    
    const entry2 = store.save({
      content: 'https://example.com',
      contentType: 'url',
      timestamp: now
    });
    
    const entries = store.getRecent(10);
    
    // Test JSON formatting
    const cli = new CLI();
    const originalLog = console.log;
    let output = '';
    console.log = (msg) => { output += msg; };
    
    cli._formatJSON(entries);
    
    console.log = originalLog;
    
    // Verify JSON is valid
    const parsed = JSON.parse(output);
    assert.ok(Array.isArray(parsed));
    assert.strictEqual(parsed.length, 2);
    assert.strictEqual(parsed[0].content, 'https://example.com'); // Most recent first
    assert.strictEqual(parsed[1].content, 'Hello World');
    
    store.close();
  });

  it('should format entries as CSV', async () => {
    const { default: HistoryStore } = await import('../src/HistoryStore.js');
    const store = new HistoryStore(':memory:');
    
    // Add test entries
    store.save({
      content: 'Hello World',
      contentType: 'text',
      timestamp: 1234567890
    });
    
    store.save({
      content: 'Text with "quotes"',
      contentType: 'text',
      timestamp: 1234567891
    });
    
    const entries = store.getRecent(10);
    
    // Test CSV formatting
    const cli = new CLI();
    const originalLog = console.log;
    const output = [];
    console.log = (msg) => { output.push(msg); };
    
    cli._formatCSV(entries);
    
    console.log = originalLog;
    
    // Verify CSV format
    assert.strictEqual(output[0], 'id,timestamp,contentType,content');
    assert.ok(output[1].includes('text'));
    assert.ok(output[1].includes('1234567891'));
    assert.ok(output[2].includes('text'));
    assert.ok(output[2].includes('1234567890'));
    
    // Verify quotes are escaped
    assert.ok(output[1].includes('""quotes""'));
    
    store.close();
  });

  it('should handle CSV escaping for special characters', () => {
    const cli = new CLI();
    const originalLog = console.log;
    const output = [];
    console.log = (msg) => { output.push(msg); };
    
    const entries = [
      {
        id: 'test1',
        content: 'Text with "quotes" and newlines\nLine 2',
        contentType: 'text',
        timestamp: 1234567890
      },
      {
        id: 'test2',
        content: 'Text with, commas',
        contentType: 'text',
        timestamp: 1234567891
      }
    ];
    
    cli._formatCSV(entries);
    
    console.log = originalLog;
    
    // Verify header
    assert.strictEqual(output[0], 'id,timestamp,contentType,content');
    
    // Verify quotes are escaped and newlines replaced
    assert.ok(output[1].includes('""quotes""'));
    assert.ok(!output[1].includes('\n'));
    assert.ok(output[1].includes('Line 2'));
    
    // Verify commas are handled (content should be quoted)
    assert.ok(output[2].includes('"Text with, commas"'));
  });

  it('should integrate search with list command', async () => {
    const { default: HistoryStore } = await import('../src/HistoryStore.js');
    const { default: SearchService } = await import('../src/SearchService.js');
    const store = new HistoryStore(':memory:');
    
    // Add test entries
    store.save({
      content: 'Hello World',
      contentType: 'text',
      timestamp: Date.now()
    });
    
    store.save({
      content: 'Goodbye World',
      contentType: 'text',
      timestamp: Date.now()
    });
    
    store.save({
      content: 'Hello Universe',
      contentType: 'text',
      timestamp: Date.now()
    });
    
    // Test search integration
    const searchService = new SearchService(store);
    const results = searchService.search('Hello', { limit: 10 });
    
    assert.strictEqual(results.length, 2);
    assert.ok(results[0].content.includes('Hello'));
    assert.ok(results[1].content.includes('Hello'));
    
    store.close();
  });

  it('should filter by date with since option', async () => {
    const { default: HistoryStore } = await import('../src/HistoryStore.js');
    const store = new HistoryStore(':memory:');
    
    const now = Date.now();
    const yesterday = now - 86400000;
    const twoDaysAgo = now - 2 * 86400000;
    
    // Add test entries with different timestamps
    store.save({
      content: 'Recent entry',
      contentType: 'text',
      timestamp: now
    });
    
    store.save({
      content: 'Yesterday entry',
      contentType: 'text',
      timestamp: yesterday
    });
    
    store.save({
      content: 'Old entry',
      contentType: 'text',
      timestamp: twoDaysAgo
    });
    
    // Test getSince method
    const recentEntries = store.getSince(yesterday, 10);
    assert.strictEqual(recentEntries.length, 2);
    assert.ok(recentEntries.every(e => e.timestamp >= yesterday));
    
    store.close();
  });

  it('should show total count in list output', async () => {
    const { default: HistoryStore } = await import('../src/HistoryStore.js');
    const store = new HistoryStore(':memory:');
    
    // Add 20 entries
    for (let i = 0; i < 20; i++) {
      store.save({
        content: `Entry ${i}`,
        contentType: 'text',
        timestamp: Date.now() + i
      });
    }
    
    // Test getCount method
    const totalCount = store.getCount();
    assert.strictEqual(totalCount, 20);
    
    // Test getCountByType method
    const countByType = store.getCountByType();
    assert.strictEqual(countByType.text, 20);
    
    store.close();
  });

  it('should handle multiple format options', () => {
    const cli = new CLI();
    const listCommand = cli.program.commands.find(cmd => cmd.name() === 'list');
    
    const formatOption = listCommand.options.find(opt => opt.long === '--format');
    assert.ok(formatOption);
    assert.strictEqual(formatOption.defaultValue, 'table');
  });
});
