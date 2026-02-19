import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import RetentionService from '../src/RetentionService.js';
import HistoryStore from '../src/HistoryStore.js';
import { ConfigurationManager } from '../src/ConfigurationManager.js';

describe('RetentionService', () => {
  let retentionService;
  let historyStore;
  let configManager;

  beforeEach(() => {
    // Use in-memory database for tests
    historyStore = new HistoryStore(':memory:');
    
    // Create a mock ConfigurationManager with test config
    configManager = new ConfigurationManager();
    configManager.set('retention.days', 30); // Default 30 days
  });

  afterEach(() => {
    // Stop the service if running
    if (retentionService) {
      retentionService.stop();
    }
    
    // Close database
    if (historyStore && historyStore.isOpen()) {
      historyStore.close();
    }
  });

  describe('Constructor', () => {
    it('should create RetentionService with HistoryStore and ConfigurationManager', () => {
      retentionService = new RetentionService(historyStore, configManager);
      
      assert.ok(retentionService, 'RetentionService should be created');
      assert.strictEqual(retentionService.historyStore, historyStore);
      assert.strictEqual(retentionService.configManager, configManager);
      assert.strictEqual(retentionService.cleanupInterval, null);
    });
  });

  describe('start()', () => {
    it('should run initial cleanup immediately', () => {
      const now = Date.now();
      
      // Add old entries that should be deleted
      historyStore.save({ content: 'Old entry 1', contentType: 'text', timestamp: now - (40 * 24 * 60 * 60 * 1000) });
      historyStore.save({ content: 'Old entry 2', contentType: 'text', timestamp: now - (35 * 24 * 60 * 60 * 1000) });
      historyStore.save({ content: 'Recent entry', contentType: 'text', timestamp: now });
      
      retentionService = new RetentionService(historyStore, configManager);
      retentionService.start();
      
      // Check that old entries were deleted
      const remaining = historyStore.getRecent(10);
      assert.strictEqual(remaining.length, 1);
      assert.strictEqual(remaining[0].content, 'Recent entry');
    });

    it('should schedule cleanup interval', (t, done) => {
      retentionService = new RetentionService(historyStore, configManager);
      retentionService.start();
      
      assert.ok(retentionService.cleanupInterval !== null, 'Cleanup interval should be set');
      
      done();
    });
  });

  describe('stop()', () => {
    it('should clear cleanup interval', () => {
      retentionService = new RetentionService(historyStore, configManager);
      retentionService.start();
      
      assert.ok(retentionService.cleanupInterval !== null, 'Interval should be set after start');
      
      retentionService.stop();
      
      assert.strictEqual(retentionService.cleanupInterval, null, 'Interval should be cleared after stop');
    });

    it('should handle stop when not started', () => {
      retentionService = new RetentionService(historyStore, configManager);
      
      // Should not throw
      retentionService.stop();
      
      assert.strictEqual(retentionService.cleanupInterval, null);
    });

    it('should handle multiple stop calls', () => {
      retentionService = new RetentionService(historyStore, configManager);
      retentionService.start();
      
      retentionService.stop();
      retentionService.stop(); // Should not throw
      
      assert.strictEqual(retentionService.cleanupInterval, null);
    });
  });

  describe('cleanup()', () => {
    it('should delete entries older than retention period', () => {
      const now = Date.now();
      configManager.set('retention.days', 30);
      
      // Add entries with various ages
      historyStore.save({ content: 'Old 1', contentType: 'text', timestamp: now - (40 * 24 * 60 * 60 * 1000) }); // 40 days old
      historyStore.save({ content: 'Old 2', contentType: 'text', timestamp: now - (35 * 24 * 60 * 60 * 1000) }); // 35 days old
      historyStore.save({ content: 'Recent 1', contentType: 'text', timestamp: now - (20 * 24 * 60 * 60 * 1000) }); // 20 days old
      historyStore.save({ content: 'Recent 2', contentType: 'text', timestamp: now }); // Now
      
      retentionService = new RetentionService(historyStore, configManager);
      const deletedCount = retentionService.cleanup();
      
      assert.strictEqual(deletedCount, 2, 'Should delete 2 old entries');
      
      const remaining = historyStore.getRecent(10);
      assert.strictEqual(remaining.length, 2, 'Should have 2 remaining entries');
      assert.ok(remaining.every(e => e.content.startsWith('Recent')), 'Only recent entries should remain');
    });

    it('should skip cleanup when retention.days is 0', () => {
      const now = Date.now();
      configManager.set('retention.days', 0); // Unlimited retention
      
      // Add old entries
      historyStore.save({ content: 'Very old', contentType: 'text', timestamp: now - (365 * 24 * 60 * 60 * 1000) }); // 1 year old
      historyStore.save({ content: 'Recent', contentType: 'text', timestamp: now });
      
      retentionService = new RetentionService(historyStore, configManager);
      const deletedCount = retentionService.cleanup();
      
      assert.strictEqual(deletedCount, 0, 'Should not delete any entries when retention is 0');
      
      const remaining = historyStore.getRecent(10);
      assert.strictEqual(remaining.length, 2, 'All entries should remain');
    });

    it('should return 0 when no entries match', () => {
      const now = Date.now();
      configManager.set('retention.days', 30);
      
      // Add only recent entries
      historyStore.save({ content: 'Recent 1', contentType: 'text', timestamp: now - (10 * 24 * 60 * 60 * 1000) });
      historyStore.save({ content: 'Recent 2', contentType: 'text', timestamp: now });
      
      retentionService = new RetentionService(historyStore, configManager);
      const deletedCount = retentionService.cleanup();
      
      assert.strictEqual(deletedCount, 0, 'Should not delete any entries');
      
      const remaining = historyStore.getRecent(10);
      assert.strictEqual(remaining.length, 2, 'All entries should remain');
    });

    it('should handle various retention periods', () => {
      const now = Date.now();
      
      // Test with 7 days retention
      configManager.set('retention.days', 7);
      
      historyStore.save({ content: 'Old', contentType: 'text', timestamp: now - (10 * 24 * 60 * 60 * 1000) }); // 10 days old
      historyStore.save({ content: 'Recent', contentType: 'text', timestamp: now - (5 * 24 * 60 * 60 * 1000) }); // 5 days old
      
      retentionService = new RetentionService(historyStore, configManager);
      const deletedCount = retentionService.cleanup();
      
      assert.strictEqual(deletedCount, 1, 'Should delete 1 entry older than 7 days');
      
      const remaining = historyStore.getRecent(10);
      assert.strictEqual(remaining.length, 1);
      assert.strictEqual(remaining[0].content, 'Recent');
    });

    it('should log deleted count when entries are deleted', () => {
      const now = Date.now();
      configManager.set('retention.days', 30);
      
      // Capture console.log output
      const originalLog = console.log;
      let logOutput = '';
      console.log = (message) => {
        logOutput += message;
      };
      
      try {
        // Add old entries
        historyStore.save({ content: 'Old 1', contentType: 'text', timestamp: now - (40 * 24 * 60 * 60 * 1000) });
        historyStore.save({ content: 'Old 2', contentType: 'text', timestamp: now - (35 * 24 * 60 * 60 * 1000) });
        
        retentionService = new RetentionService(historyStore, configManager);
        retentionService.cleanup();
        
        assert.ok(logOutput.includes('Retention cleanup'), 'Should log cleanup message');
        assert.ok(logOutput.includes('deleted 2 entries'), 'Should log deleted count');
        assert.ok(logOutput.includes('30 days'), 'Should log retention period');
      } finally {
        console.log = originalLog;
      }
    });

    it('should not log when no entries are deleted', () => {
      const now = Date.now();
      configManager.set('retention.days', 30);
      
      // Capture console.log output
      const originalLog = console.log;
      let logOutput = '';
      console.log = (message) => {
        logOutput += message;
      };
      
      try {
        // Add only recent entries
        historyStore.save({ content: 'Recent', contentType: 'text', timestamp: now });
        
        retentionService = new RetentionService(historyStore, configManager);
        retentionService.cleanup();
        
        assert.strictEqual(logOutput, '', 'Should not log when no entries deleted');
      } finally {
        console.log = originalLog;
      }
    });

    it('should handle errors gracefully', () => {
      // Create a service with a closed database to trigger an error
      historyStore.close();
      
      retentionService = new RetentionService(historyStore, configManager);
      
      // Capture console.error output
      const originalError = console.error;
      let errorOutput = '';
      console.error = (...args) => {
        errorOutput += args.join(' ');
      };
      
      try {
        const deletedCount = retentionService.cleanup();
        
        assert.strictEqual(deletedCount, 0, 'Should return 0 on error');
        assert.ok(errorOutput.includes('Retention cleanup failed'), 'Should log error message');
      } finally {
        console.error = originalError;
      }
    });
  });

  describe('Integration Tests', () => {
    it('should work with real ConfigurationManager', () => {
      const now = Date.now();
      
      // Use real ConfigurationManager
      const realConfigManager = new ConfigurationManager();
      realConfigManager.set('retention.days', 15);
      
      historyStore.save({ content: 'Old', contentType: 'text', timestamp: now - (20 * 24 * 60 * 60 * 1000) });
      historyStore.save({ content: 'Recent', contentType: 'text', timestamp: now });
      
      retentionService = new RetentionService(historyStore, realConfigManager);
      const deletedCount = retentionService.cleanup();
      
      assert.strictEqual(deletedCount, 1);
      
      const remaining = historyStore.getRecent(10);
      assert.strictEqual(remaining.length, 1);
      assert.strictEqual(remaining[0].content, 'Recent');
    });

    it('should handle edge case at exact retention boundary', () => {
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
      
      retentionService = new RetentionService(historyStore, configManager);
      const deletedCount = retentionService.cleanup();
      
      assert.strictEqual(deletedCount, 1, 'Should delete entry with timestamp < cutoff');
      
      const remaining = historyStore.getRecent(10);
      assert.strictEqual(remaining.length, 1);
      assert.strictEqual(remaining[0].content, 'After cutoff');
    });
  });
});
