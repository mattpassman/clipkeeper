import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { Application } from '../src/Application.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Application', () => {
  let app;
  let testDataDir;

  beforeEach(() => {
    // Create a temporary directory for test data
    testDataDir = path.join(os.tmpdir(), `clipkeeper-test-${Date.now()}`);
    fs.mkdirSync(testDataDir, { recursive: true });
    
    // Create a test config file
    const testConfigPath = path.join(testDataDir, 'config.json');
    const testConfig = {
      version: '1.0',
      embedding: {
        provider: 'openai',
        model: 'text-embedding-3-small',
        apiKey: null
      },
      privacy: {
        enabled: true,
        patterns: []
      },
      retention: {
        days: 30
      },
      monitoring: {
        pollInterval: 500,
        autoStart: false,
        enabled: true
      },
      storage: {
        dataDir: testDataDir,
        dbPath: path.join(testDataDir, 'test.db')
      },
      search: {
        defaultLimit: 10,
        minScore: 0.7,
        cacheSize: 1000
      }
    };
    fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));
    
    app = new Application(testConfigPath);
  });

  afterEach(() => {
    // Stop the application if running
    if (app && app.isRunning) {
      app.stop();
    }
    
    // Ensure database is closed
    if (app && app.historyStore && app.historyStore.isOpen()) {
      app.historyStore.close();
    }
    
    // Clean up test directory
    if (testDataDir && fs.existsSync(testDataDir)) {
      // Add a small delay to ensure file handles are released on Windows
      const maxRetries = 3;
      let retries = 0;
      while (retries < maxRetries) {
        try {
          fs.rmSync(testDataDir, { recursive: true, force: true });
          break;
        } catch (error) {
          if (error.code === 'EBUSY' && retries < maxRetries - 1) {
            retries++;
            // Wait a bit before retrying
            const start = Date.now();
            while (Date.now() - start < 100) {
              // Busy wait
            }
          } else if (retries === maxRetries - 1) {
            // Last retry failed, just log and continue
            console.warn(`Failed to clean up test directory: ${error.message}`);
            break;
          }
        }
      }
    }
  });

  describe('initialization', () => {
    it('should initialize all components', async () => {
      await app.initialize();
      
      assert.ok(app.configManager, 'ConfigurationManager should be initialized');
      assert.ok(app.historyStore, 'HistoryStore should be initialized');
      assert.ok(app.clipboardMonitor, 'ClipboardMonitor should be initialized');
      assert.ok(app.privacyFilter, 'PrivacyFilter should be initialized');
      assert.ok(app.contentClassifier, 'ContentClassifier should be initialized');
    });

    it('should use platform-appropriate data directory', async () => {
      await app.initialize();
      
      const dataDir = app.configManager.get('storage.dataDir');
      assert.ok(dataDir, 'Data directory should be set');
      assert.strictEqual(dataDir, testDataDir, 'Should use test data directory');
    });

    it('should initialize HistoryStore with correct database path', async () => {
      await app.initialize();
      
      const expectedDbPath = path.join(testDataDir, 'test.db');
      assert.strictEqual(app.historyStore.dbPath, expectedDbPath);
      assert.ok(app.historyStore.isOpen(), 'Database should be open');
    });

    it('should initialize PrivacyFilter with config', async () => {
      await app.initialize();
      
      assert.ok(app.privacyFilter, 'PrivacyFilter should be initialized');
      assert.strictEqual(app.privacyFilter.enabled, true);
    });

    it('should initialize ClipboardMonitor with poll interval', async () => {
      await app.initialize();
      
      assert.ok(app.clipboardMonitor, 'ClipboardMonitor should be initialized');
      assert.strictEqual(app.clipboardMonitor.pollInterval, 500);
    });
  });

  describe('lifecycle', () => {
    it('should start and stop successfully', async () => {
      await app.initialize();
      
      assert.strictEqual(app.isRunning, false, 'Should not be running initially');
      
      app.start();
      assert.strictEqual(app.isRunning, true, 'Should be running after start');
      
      app.stop();
      assert.strictEqual(app.isRunning, false, 'Should not be running after stop');
    });

    it('should not start if not initialized', () => {
      assert.throws(() => {
        app.start();
      }, /not initialized/);
    });

    it('should handle multiple start calls gracefully', async () => {
      await app.initialize();
      
      app.start();
      assert.strictEqual(app.isRunning, true);
      
      // Second start should not throw
      app.start();
      assert.strictEqual(app.isRunning, true);
    });

    it('should handle multiple stop calls gracefully', async () => {
      await app.initialize();
      app.start();
      
      app.stop();
      assert.strictEqual(app.isRunning, false);
      
      // Second stop should not throw
      app.stop();
      assert.strictEqual(app.isRunning, false);
    });
  });

  describe('clipboard change handling', () => {
    it('should store clipboard content when not filtered', async () => {
      await app.initialize();
      app.start();
      
      // Verify database is open
      assert.ok(app.historyStore.isOpen(), 'Database should be open before storing');
      
      // Simulate clipboard change
      const clipboardContent = {
        text: 'Hello, world!',
        timestamp: Date.now()
      };
      
      // Call the handler directly (it's synchronous)
      app._handleClipboardChange(clipboardContent);
      
      // Verify database is still open
      assert.ok(app.historyStore.isOpen(), 'Database should still be open after storing');
      
      // Verify entry was stored
      const recentEntries = app.historyStore.getRecent(1);
      assert.strictEqual(recentEntries.length, 1, `Expected 1 entry, got ${recentEntries.length}`);
      assert.strictEqual(recentEntries[0].content, 'Hello, world!');
      assert.strictEqual(recentEntries[0].contentType, 'text');
    });

    it('should filter sensitive content', async () => {
      await app.initialize();
      app.start();
      
      // Simulate clipboard change with password-like content
      const clipboardContent = {
        text: 'MyP@ssw0rd123!',
        timestamp: Date.now()
      };
      
      // Call the handler directly (it's synchronous)
      app._handleClipboardChange(clipboardContent);
      
      // Verify entry was NOT stored
      const recentEntries = app.historyStore.getRecent(1);
      assert.strictEqual(recentEntries.length, 0, 'Sensitive content should not be stored');
    });

    it('should classify content correctly', async () => {
      await app.initialize();
      app.start();
      
      // Clear any existing entries
      app.historyStore.clear();
      
      // Test URL classification
      const urlContent = {
        text: 'https://example.com',
        timestamp: Date.now()
      };
      
      // Call the handler directly (it's synchronous)
      app._handleClipboardChange(urlContent);
      
      const recentEntries = app.historyStore.getRecent(1);
      assert.strictEqual(recentEntries.length, 1);
      assert.strictEqual(recentEntries[0].contentType, 'url');
    });

    it('should include metadata in stored entries', async () => {
      await app.initialize();
      app.start();
      
      // Clear any existing entries
      app.historyStore.clear();
      
      const clipboardContent = {
        text: 'function test() { return 42; }',
        timestamp: Date.now()
      };
      
      // Call the handler directly (it's synchronous)
      app._handleClipboardChange(clipboardContent);
      
      const recentEntries = app.historyStore.getRecent(1);
      assert.strictEqual(recentEntries.length, 1);
      assert.ok(recentEntries[0].metadata, 'Entry should have metadata');
      assert.ok(recentEntries[0].metadata.characterCount > 0);
      assert.ok(recentEntries[0].metadata.wordCount > 0);
    });

    it('should handle errors gracefully', async () => {
      await app.initialize();
      app.start();
      
      // Simulate error by passing invalid content
      const invalidContent = {
        text: null,
        timestamp: Date.now()
      };
      
      // Should not throw
      assert.doesNotThrow(() => {
        app._handleClipboardChange(invalidContent);
      });
    });
  });

  describe('status', () => {
    it('should return correct status when not initialized', () => {
      const status = app.getStatus();
      
      assert.strictEqual(status.running, false);
      assert.strictEqual(status.components.configManager, false);
      assert.strictEqual(status.components.historyStore, false);
      assert.strictEqual(status.components.clipboardMonitor, false);
    });

    it('should return correct status when initialized', async () => {
      await app.initialize();
      
      const status = app.getStatus();
      
      assert.strictEqual(status.running, false);
      assert.strictEqual(status.components.configManager, true);
      assert.strictEqual(status.components.historyStore, true);
      assert.strictEqual(status.components.clipboardMonitor, true);
      assert.strictEqual(status.components.privacyFilter, true);
      assert.strictEqual(status.components.contentClassifier, true);
    });

    it('should return correct status when running', async () => {
      await app.initialize();
      app.start();
      
      const status = app.getStatus();
      
      assert.strictEqual(status.running, true);
      assert.ok(status.config.dataDir);
      assert.strictEqual(status.config.pollInterval, 500);
      assert.strictEqual(status.config.privacyEnabled, true);
    });
  });
});

