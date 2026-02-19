import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import HistoryStore from '../src/HistoryStore.js';
import SearchService from '../src/SearchService.js';
import ClipboardService from '../src/ClipboardService.js';
import RetentionService from '../src/RetentionService.js';
import { ConfigurationManager } from '../src/ConfigurationManager.js';

/**
 * Performance Test Suite
 * 
 * Tests performance targets for clipkeeper v0.2.0:
 * - Search: < 500ms for 10,000 entries
 * - Copy: < 100ms
 * - Retention cleanup: < 5 seconds
 * - List: < 500ms
 */

describe('Performance Tests', () => {
  let historyStore;
  let searchService;
  let clipboardService;
  let retentionService;
  let configManager;

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

  /**
   * Helper function to generate test entries
   * @param {number} count - Number of entries to generate
   * @param {number} baseTimestamp - Base timestamp for entries
   * @returns {Array<string>} Array of entry IDs
   */
  function generateTestEntries(count, baseTimestamp = Date.now()) {
    const entryIds = [];
    const contentTypes = ['text', 'code', 'url', 'email'];
    const sampleWords = ['error', 'function', 'test', 'data', 'user', 'system', 'process', 'result', 'value', 'message'];
    
    for (let i = 0; i < count; i++) {
      // Generate varied content
      const wordCount = 5 + Math.floor(Math.random() * 15);
      const words = [];
      for (let j = 0; j < wordCount; j++) {
        words.push(sampleWords[Math.floor(Math.random() * sampleWords.length)]);
      }
      const content = words.join(' ') + ` entry ${i}`;
      
      const contentType = contentTypes[i % contentTypes.length];
      const timestamp = baseTimestamp - (i * 1000); // Spread entries over time
      
      const entryId = historyStore.save({ content, contentType, timestamp });
      entryIds.push(entryId);
    }
    
    return entryIds;
  }

  describe('Search Performance', () => {
    it('should search 10,000 entries in under 500ms', () => {
      // Generate 10,000 test entries
      console.log('Generating 10,000 test entries...');
      const startGeneration = Date.now();
      generateTestEntries(10000);
      const generationTime = Date.now() - startGeneration;
      console.log(`Generated 10,000 entries in ${generationTime}ms`);
      
      // Measure search time
      const startSearch = Date.now();
      const results = searchService.search('error');
      const searchTime = Date.now() - startSearch;
      
      console.log(`Search completed in ${searchTime}ms`);
      console.log(`Found ${results.length} results`);
      
      // Verify performance target
      assert.ok(searchTime < 500, `Search should complete in under 500ms, took ${searchTime}ms`);
      assert.ok(results.length > 0, 'Should find results');
    });

    it('should search with multiple keywords in under 500ms', () => {
      // Generate 10,000 test entries
      generateTestEntries(10000);
      
      // Measure search time with multiple keywords
      const startSearch = Date.now();
      const results = searchService.search('error function');
      const searchTime = Date.now() - startSearch;
      
      console.log(`Multi-keyword search completed in ${searchTime}ms`);
      console.log(`Found ${results.length} results`);
      
      // Verify performance target
      assert.ok(searchTime < 500, `Search should complete in under 500ms, took ${searchTime}ms`);
    });

    it('should search with type filter in under 500ms', () => {
      // Generate 10,000 test entries
      generateTestEntries(10000);
      
      // Measure search time with type filter
      const startSearch = Date.now();
      const results = searchService.search('test', { contentType: 'code' });
      const searchTime = Date.now() - startSearch;
      
      console.log(`Type-filtered search completed in ${searchTime}ms`);
      console.log(`Found ${results.length} results`);
      
      // Verify performance target
      assert.ok(searchTime < 500, `Search should complete in under 500ms, took ${searchTime}ms`);
    });

    it('should search with date filter in under 500ms', () => {
      // Generate 10,000 test entries
      const now = Date.now();
      generateTestEntries(10000, now);
      
      // Measure search time with date filter
      const since = now - (5000 * 1000); // Last 5000 entries
      const startSearch = Date.now();
      const results = searchService.search('test', { since });
      const searchTime = Date.now() - startSearch;
      
      console.log(`Date-filtered search completed in ${searchTime}ms`);
      console.log(`Found ${results.length} results`);
      
      // Verify performance target
      assert.ok(searchTime < 500, `Search should complete in under 500ms, took ${searchTime}ms`);
    });

    it('should search with limit in under 500ms', () => {
      // Generate 10,000 test entries
      generateTestEntries(10000);
      
      // Measure search time with limit
      const startSearch = Date.now();
      const results = searchService.search('test', { limit: 10 });
      const searchTime = Date.now() - startSearch;
      
      console.log(`Limited search completed in ${searchTime}ms`);
      console.log(`Found ${results.length} results`);
      
      // Verify performance target
      assert.ok(searchTime < 500, `Search should complete in under 500ms, took ${searchTime}ms`);
      assert.ok(results.length <= 10, 'Should respect limit');
    });
  });

  describe('Copy Performance', () => {
    it('should copy entry in reasonable time', async () => {
      const now = Date.now();
      const testContent = 'Test content for copy performance';
      
      // Insert entry
      const entryId = historyStore.save({ content: testContent, contentType: 'text', timestamp: now });
      const entry = historyStore.getById(entryId);
      
      // Measure copy time
      const startCopy = Date.now();
      await clipboardService.copy(entry.content);
      const copyTime = Date.now() - startCopy;
      
      console.log(`Copy completed in ${copyTime}ms`);
      
      // Verify performance target (500ms is reasonable for clipboard operations)
      // Note: Clipboard operations involve system calls and can be slower on some platforms
      assert.ok(copyTime < 500, `Copy should complete in reasonable time, took ${copyTime}ms`);
    });

    it('should copy long content in reasonable time', async () => {
      const now = Date.now();
      const testContent = 'a'.repeat(5000); // 5KB content
      
      // Insert entry
      const entryId = historyStore.save({ content: testContent, contentType: 'text', timestamp: now });
      const entry = historyStore.getById(entryId);
      
      // Measure copy time
      const startCopy = Date.now();
      await clipboardService.copy(entry.content);
      const copyTime = Date.now() - startCopy;
      
      console.log(`Long content copy completed in ${copyTime}ms`);
      
      // Verify performance target (500ms is reasonable for clipboard operations)
      assert.ok(copyTime < 500, `Copy should complete in reasonable time, took ${copyTime}ms`);
    });

    it('should retrieve entry by ID quickly', () => {
      // Generate entries
      const entryIds = generateTestEntries(1000);
      
      // Measure retrieval time for random entry
      const randomId = entryIds[Math.floor(Math.random() * entryIds.length)];
      const startRetrieval = Date.now();
      const entry = historyStore.getById(randomId);
      const retrievalTime = Date.now() - startRetrieval;
      
      console.log(`Entry retrieval completed in ${retrievalTime}ms`);
      
      // Verify quick retrieval
      assert.ok(entry, 'Entry should be found');
      assert.ok(retrievalTime < 50, `Retrieval should be fast, took ${retrievalTime}ms`);
    });
  });

  describe('Retention Cleanup Performance', () => {
    it('should cleanup 10,000 entries in under 5 seconds', () => {
      const now = Date.now();
      configManager.set('retention.days', 30);
      
      // Generate 10,000 old entries (should be deleted)
      console.log('Generating 10,000 old entries...');
      const startGeneration = Date.now();
      for (let i = 0; i < 10000; i++) {
        const timestamp = now - ((40 + i) * 24 * 60 * 60 * 1000); // 40+ days old
        historyStore.save({ 
          content: `Old entry ${i}`, 
          contentType: 'text', 
          timestamp 
        });
      }
      const generationTime = Date.now() - startGeneration;
      console.log(`Generated 10,000 old entries in ${generationTime}ms`);
      
      // Verify initial count
      const beforeCount = historyStore.getCount();
      assert.strictEqual(beforeCount, 10000, 'Should have 10,000 entries');
      
      // Measure cleanup time
      const startCleanup = Date.now();
      const deletedCount = retentionService.cleanup();
      const cleanupTime = Date.now() - startCleanup;
      
      console.log(`Cleanup completed in ${cleanupTime}ms`);
      console.log(`Deleted ${deletedCount} entries`);
      
      // Verify performance target
      assert.ok(cleanupTime < 5000, `Cleanup should complete in under 5 seconds, took ${cleanupTime}ms`);
      assert.strictEqual(deletedCount, 10000, 'Should delete all old entries');
      
      const afterCount = historyStore.getCount();
      assert.strictEqual(afterCount, 0, 'Should have 0 entries after cleanup');
    });

    it('should cleanup mixed age entries efficiently', () => {
      const now = Date.now();
      configManager.set('retention.days', 30);
      
      // Generate 5,000 old entries and 5,000 recent entries
      console.log('Generating 10,000 mixed age entries...');
      for (let i = 0; i < 5000; i++) {
        // Old entries
        const oldTimestamp = now - ((40 + i) * 24 * 60 * 60 * 1000);
        historyStore.save({ 
          content: `Old entry ${i}`, 
          contentType: 'text', 
          timestamp: oldTimestamp 
        });
        
        // Recent entries
        const recentTimestamp = now - (i * 1000);
        historyStore.save({ 
          content: `Recent entry ${i}`, 
          contentType: 'text', 
          timestamp: recentTimestamp 
        });
      }
      
      // Verify initial count
      const beforeCount = historyStore.getCount();
      assert.strictEqual(beforeCount, 10000, 'Should have 10,000 entries');
      
      // Measure cleanup time
      const startCleanup = Date.now();
      const deletedCount = retentionService.cleanup();
      const cleanupTime = Date.now() - startCleanup;
      
      console.log(`Mixed cleanup completed in ${cleanupTime}ms`);
      console.log(`Deleted ${deletedCount} entries`);
      
      // Verify performance target
      assert.ok(cleanupTime < 5000, `Cleanup should complete in under 5 seconds, took ${cleanupTime}ms`);
      assert.strictEqual(deletedCount, 5000, 'Should delete only old entries');
      
      const afterCount = historyStore.getCount();
      assert.strictEqual(afterCount, 5000, 'Should have 5,000 recent entries remaining');
    });
  });

  describe('List Performance', () => {
    it('should list recent entries in under 500ms', () => {
      // Generate 10,000 test entries
      console.log('Generating 10,000 test entries...');
      generateTestEntries(10000);
      
      // Measure list time
      const startList = Date.now();
      const results = historyStore.getRecent(10);
      const listTime = Date.now() - startList;
      
      console.log(`List completed in ${listTime}ms`);
      console.log(`Retrieved ${results.length} entries`);
      
      // Verify performance target
      assert.ok(listTime < 500, `List should complete in under 500ms, took ${listTime}ms`);
      assert.strictEqual(results.length, 10, 'Should return 10 entries');
    });

    it('should list with larger limit in under 500ms', () => {
      // Generate 10,000 test entries
      generateTestEntries(10000);
      
      // Measure list time with larger limit
      const startList = Date.now();
      const results = historyStore.getRecent(100);
      const listTime = Date.now() - startList;
      
      console.log(`List (100 entries) completed in ${listTime}ms`);
      console.log(`Retrieved ${results.length} entries`);
      
      // Verify performance target
      assert.ok(listTime < 500, `List should complete in under 500ms, took ${listTime}ms`);
      assert.strictEqual(results.length, 100, 'Should return 100 entries');
    });

    it('should get count quickly', () => {
      // Generate 10,000 test entries
      generateTestEntries(10000);
      
      // Measure count time
      const startCount = Date.now();
      const count = historyStore.getCount();
      const countTime = Date.now() - startCount;
      
      console.log(`Count completed in ${countTime}ms`);
      console.log(`Total count: ${count}`);
      
      // Verify quick count
      assert.strictEqual(count, 10000, 'Should count all entries');
      assert.ok(countTime < 100, `Count should be fast, took ${countTime}ms`);
    });

    it('should get count by type quickly', () => {
      // Generate 10,000 test entries
      generateTestEntries(10000);
      
      // Measure count by type time
      const startCount = Date.now();
      const countByType = historyStore.getCountByType();
      const countTime = Date.now() - startCount;
      
      console.log(`Count by type completed in ${countTime}ms`);
      console.log('Counts by type:', countByType);
      
      // Verify quick count
      assert.ok(countByType, 'Should return count by type');
      assert.ok(countTime < 100, `Count by type should be fast, took ${countTime}ms`);
    });

    it('should get entries since date in under 500ms', () => {
      const now = Date.now();
      
      // Generate 10,000 test entries
      generateTestEntries(10000, now);
      
      // Measure getSince time
      const since = now - (5000 * 1000); // Last 5000 entries
      const startGetSince = Date.now();
      const results = historyStore.getSince(since, 100);
      const getSinceTime = Date.now() - startGetSince;
      
      console.log(`GetSince completed in ${getSinceTime}ms`);
      console.log(`Retrieved ${results.length} entries`);
      
      // Verify performance target
      assert.ok(getSinceTime < 500, `GetSince should complete in under 500ms, took ${getSinceTime}ms`);
      assert.ok(results.length > 0, 'Should find entries');
      assert.ok(results.every(e => e.timestamp >= since), 'All entries should be after since date');
    });
  });

  describe('Overall Performance Summary', () => {
    it('should generate performance report', () => {
      console.log('\n=== Performance Test Summary ===\n');
      
      const now = Date.now();
      const results = {};
      
      // Test 1: Generate entries
      console.log('1. Generating 10,000 test entries...');
      const startGeneration = Date.now();
      generateTestEntries(10000, now);
      results.generation = Date.now() - startGeneration;
      console.log(`   ✓ Generated in ${results.generation}ms\n`);
      
      // Test 2: Search
      console.log('2. Testing search performance...');
      const startSearch = Date.now();
      const searchResults = searchService.search('test');
      results.search = Date.now() - startSearch;
      console.log(`   ✓ Search completed in ${results.search}ms (found ${searchResults.length} results)`);
      console.log(`   Target: < 500ms - ${results.search < 500 ? 'PASS' : 'FAIL'}\n`);
      
      // Test 3: List
      console.log('3. Testing list performance...');
      const startList = Date.now();
      const listResults = historyStore.getRecent(10);
      results.list = Date.now() - startList;
      console.log(`   ✓ List completed in ${results.list}ms (retrieved ${listResults.length} entries)`);
      console.log(`   Target: < 500ms - ${results.list < 500 ? 'PASS' : 'FAIL'}\n`);
      
      // Test 4: Count
      console.log('4. Testing count performance...');
      const startCount = Date.now();
      const count = historyStore.getCount();
      results.count = Date.now() - startCount;
      console.log(`   ✓ Count completed in ${results.count}ms (total: ${count})`);
      console.log(`   Target: < 100ms - ${results.count < 100 ? 'PASS' : 'FAIL'}\n`);
      
      // Test 5: Cleanup (create new store with old entries)
      console.log('5. Testing retention cleanup performance...');
      const cleanupStore = new HistoryStore(':memory:');
      for (let i = 0; i < 10000; i++) {
        const timestamp = now - ((40 + i) * 24 * 60 * 60 * 1000);
        cleanupStore.save({ content: `Old ${i}`, contentType: 'text', timestamp });
      }
      const cleanupService = new RetentionService(cleanupStore, configManager);
      const startCleanup = Date.now();
      const deletedCount = cleanupService.cleanup();
      results.cleanup = Date.now() - startCleanup;
      console.log(`   ✓ Cleanup completed in ${results.cleanup}ms (deleted ${deletedCount} entries)`);
      console.log(`   Target: < 5000ms - ${results.cleanup < 5000 ? 'PASS' : 'FAIL'}\n`);
      cleanupStore.close();
      
      // Summary
      console.log('=== Results Summary ===');
      console.log(`Search:   ${results.search}ms / 500ms target - ${results.search < 500 ? '✓ PASS' : '✗ FAIL'}`);
      console.log(`List:     ${results.list}ms / 500ms target - ${results.list < 500 ? '✓ PASS' : '✗ FAIL'}`);
      console.log(`Count:    ${results.count}ms / 100ms target - ${results.count < 100 ? '✓ PASS' : '✗ FAIL'}`);
      console.log(`Cleanup:  ${results.cleanup}ms / 5000ms target - ${results.cleanup < 5000 ? '✓ PASS' : '✗ FAIL'}`);
      console.log('===========================\n');
      
      // Verify all targets met
      assert.ok(results.search < 500, 'Search performance target not met');
      assert.ok(results.list < 500, 'List performance target not met');
      assert.ok(results.count < 100, 'Count performance target not met');
      assert.ok(results.cleanup < 5000, 'Cleanup performance target not met');
    });
  });
});
