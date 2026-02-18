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

