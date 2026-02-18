import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import ClipboardMonitor from '../src/ClipboardMonitor.js';
import clipboardy from 'clipboardy';

describe('ClipboardMonitor', () => {
  let monitor;
  let originalRead;
  let mockLogger;

  beforeEach(() => {
    // Create a mock logger
    mockLogger = {
      error: mock.fn(() => {}),
      warn: mock.fn(() => {}),
      info: mock.fn(() => {})
    };
    
    monitor = new ClipboardMonitor(100, mockLogger); // Use shorter interval for tests
    originalRead = clipboardy.read;
  });

  afterEach(() => {
    if (monitor.isRunning) {
      monitor.stop();
    }
    clipboardy.read = originalRead;
  });

  describe('constructor', () => {
    it('should initialize with default poll interval', () => {
      const defaultMonitor = new ClipboardMonitor();
      assert.strictEqual(defaultMonitor.pollInterval, 500);
      assert.strictEqual(defaultMonitor.isRunning, false);
      assert.strictEqual(defaultMonitor.lastContentHash, null);
    });

    it('should initialize with custom poll interval', () => {
      const customMonitor = new ClipboardMonitor(1000);
      assert.strictEqual(customMonitor.pollInterval, 1000);
    });
  });

  describe('start', () => {
    it('should start monitoring', () => {
      monitor.start();
      assert.strictEqual(monitor.isRunning, true);
      assert.notStrictEqual(monitor.intervalId, null);
    });

    it('should not start multiple times', () => {
      monitor.start();
      const firstIntervalId = monitor.intervalId;
      monitor.start();
      assert.strictEqual(monitor.intervalId, firstIntervalId);
    });

    it('should perform initial clipboard check', async () => {
      let changeEmitted = false;
      clipboardy.read = mock.fn(async () => 'test content');

      monitor.on('change', () => {
        changeEmitted = true;
      });

      monitor.start();
      
      // Wait for initial check
      await new Promise(resolve => setTimeout(resolve, 50));
      
      assert.strictEqual(changeEmitted, true);
    });
  });

  describe('stop', () => {
    it('should stop monitoring', () => {
      monitor.start();
      monitor.stop();
      assert.strictEqual(monitor.isRunning, false);
      assert.strictEqual(monitor.intervalId, null);
      assert.strictEqual(monitor.lastContentHash, null);
    });

    it('should handle stop when not running', () => {
      monitor.stop();
      assert.strictEqual(monitor.isRunning, false);
    });
  });

  describe('change detection', () => {
    it('should emit change event when clipboard content changes', async () => {
      let changeCount = 0;
      let lastContent = null;

      clipboardy.read = mock.fn(async () => {
        changeCount++;
        return changeCount === 1 ? 'first content' : 'second content';
      });

      const changes = [];
      monitor.on('change', (content) => {
        changes.push(content);
      });

      monitor.start();

      // Wait for multiple polls
      await new Promise(resolve => setTimeout(resolve, 250));

      assert.ok(changes.length >= 2, 'Should detect at least 2 changes');
      assert.strictEqual(changes[0].text, 'first content');
      assert.strictEqual(changes[1].text, 'second content');
    });

    it('should not emit change event when content is unchanged', async () => {
      clipboardy.read = mock.fn(async () => 'same content');

      const changes = [];
      monitor.on('change', (content) => {
        changes.push(content);
      });

      monitor.start();

      // Wait for multiple polls
      await new Promise(resolve => setTimeout(resolve, 250));

      assert.strictEqual(changes.length, 1, 'Should only emit one change for same content');
    });

    it('should include timestamp in change event', async () => {
      clipboardy.read = mock.fn(async () => 'test content');

      let changeData = null;
      monitor.on('change', (data) => {
        changeData = data;
      });

      monitor.start();

      await new Promise(resolve => setTimeout(resolve, 50));

      assert.ok(changeData, 'Change event should be emitted');
      assert.ok(changeData.timestamp, 'Should include timestamp');
      assert.ok(typeof changeData.timestamp === 'number', 'Timestamp should be a number');
      assert.ok(changeData.timestamp > 0, 'Timestamp should be positive');
    });
  });

  describe('error handling', () => {
    it('should emit error event on clipboard read failure', async () => {
      const testError = new Error('Clipboard access denied');
      clipboardy.read = mock.fn(async () => {
        throw testError;
      });

      let errorEmitted = null;
      monitor.on('error', (error) => {
        errorEmitted = error;
      });

      monitor.start();

      await new Promise(resolve => setTimeout(resolve, 50));

      assert.ok(errorEmitted, 'Error event should be emitted');
      assert.strictEqual(errorEmitted.message, 'Failed to read clipboard');
      assert.strictEqual(errorEmitted.error, testError);
      assert.ok(errorEmitted.timestamp, 'Error should include timestamp');
    });

    it('should log error when clipboard read fails', async () => {
      const testError = new Error('Permission denied');
      testError.code = 'EACCES';
      clipboardy.read = mock.fn(async () => {
        throw testError;
      });

      // Add error handler to prevent unhandled error
      monitor.on('error', () => {
        // Error is expected, just consume it
      });

      monitor.start();

      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify logger.error was called
      assert.strictEqual(mockLogger.error.mock.calls.length >= 1, true, 'Logger error should be called');
      
      const logCall = mockLogger.error.mock.calls[0];
      assert.strictEqual(logCall.arguments[0], 'ClipboardMonitor', 'Should log component name');
      assert.strictEqual(logCall.arguments[1], 'Failed to read clipboard', 'Should log error message');
      
      const context = logCall.arguments[2];
      assert.ok(context.error, 'Should include error in context');
      assert.strictEqual(context.error.name, 'Error', 'Should log error name');
      assert.strictEqual(context.error.message, 'Permission denied', 'Should log error message');
      assert.strictEqual(context.error.code, 'EACCES', 'Should log error code');
      assert.strictEqual(context.isRunning, true, 'Should log running state');
    });

    it('should continue monitoring after error', async () => {
      let callCount = 0;
      clipboardy.read = mock.fn(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('First call fails');
        }
        return 'success content';
      });

      let changeEmitted = false;
      let errorEmitted = false;

      monitor.on('change', () => {
        changeEmitted = true;
      });

      monitor.on('error', () => {
        errorEmitted = true;
      });

      monitor.start();

      // Wait for multiple polls
      await new Promise(resolve => setTimeout(resolve, 250));

      assert.strictEqual(errorEmitted, true, 'Error should be emitted');
      assert.strictEqual(changeEmitted, true, 'Should continue and emit change after error');
      assert.strictEqual(monitor.isRunning, true, 'Should still be running after error');
    });

    it('should handle permission denied gracefully', async () => {
      const permissionError = new Error('Permission denied');
      permissionError.code = 'EACCES';
      clipboardy.read = mock.fn(async () => {
        throw permissionError;
      });

      let errorEmitted = null;
      monitor.on('error', (error) => {
        errorEmitted = error;
      });

      monitor.start();

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should emit error but continue running
      assert.ok(errorEmitted, 'Error should be emitted');
      assert.strictEqual(monitor.isRunning, true, 'Should continue running after permission error');
      
      // Should log the error
      assert.strictEqual(mockLogger.error.mock.calls.length >= 1, true, 'Should log permission error');
    });
  });

  describe('hash calculation', () => {
    it('should generate consistent hashes for same content', () => {
      const content = 'test content';
      const hash1 = monitor._hashContent(content);
      const hash2 = monitor._hashContent(content);
      assert.strictEqual(hash1, hash2);
    });

    it('should generate different hashes for different content', () => {
      const hash1 = monitor._hashContent('content 1');
      const hash2 = monitor._hashContent('content 2');
      assert.notStrictEqual(hash1, hash2);
    });

    it('should handle empty strings', () => {
      const hash = monitor._hashContent('');
      assert.ok(hash);
      assert.strictEqual(typeof hash, 'string');
    });

    it('should handle unicode content', () => {
      const hash = monitor._hashContent('Hello 世界 🌍');
      assert.ok(hash);
      assert.strictEqual(typeof hash, 'string');
    });
  });
});

