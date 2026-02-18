import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Logger, getLogger } from '../src/Logger.js';

describe('Logger', () => {
  let testLogPath;
  let testLogDir;

  beforeEach(() => {
    // Create a temporary log directory for testing
    testLogDir = path.join(os.tmpdir(), `clipkeeper-test-${Date.now()}`);
    testLogPath = path.join(testLogDir, 'test.log');
  });

  afterEach(() => {
    // Clean up test log files
    if (fs.existsSync(testLogPath)) {
      fs.unlinkSync(testLogPath);
    }
    if (fs.existsSync(testLogDir)) {
      fs.rmdirSync(testLogDir, { recursive: true });
    }
  });

  describe('Constructor', () => {
    it('should create logger with custom log path', () => {
      const logger = new Logger(testLogPath);
      assert.strictEqual(logger.logPath, testLogPath);
    });

    it('should create log directory if it does not exist', () => {
      const logger = new Logger(testLogPath);
      assert.strictEqual(fs.existsSync(testLogDir), true);
    });

    it('should use default log path when none provided', () => {
      const logger = new Logger();
      assert.ok(logger.logPath.includes('clipkeeper'));
    });
  });

  describe('Log Writing', () => {
    it('should write log entry to file', () => {
      const logger = new Logger(testLogPath);
      logger.log('info', 'TestComponent', 'Test message', { key: 'value' });

      const logContent = fs.readFileSync(testLogPath, 'utf8');
      const logEntry = JSON.parse(logContent.trim());

      assert.strictEqual(logEntry.level, 'info');
      assert.strictEqual(logEntry.component, 'TestComponent');
      assert.strictEqual(logEntry.message, 'Test message');
      assert.strictEqual(logEntry.context.key, 'value');
      assert.ok(logEntry.timestamp);
    });

    it('should append multiple log entries', () => {
      const logger = new Logger(testLogPath);
      logger.log('info', 'Component1', 'Message 1');
      logger.log('warn', 'Component2', 'Message 2');

      const logContent = fs.readFileSync(testLogPath, 'utf8');
      const lines = logContent.trim().split('\n');

      assert.strictEqual(lines.length, 2);
      
      const entry1 = JSON.parse(lines[0]);
      const entry2 = JSON.parse(lines[1]);

      assert.strictEqual(entry1.message, 'Message 1');
      assert.strictEqual(entry2.message, 'Message 2');
    });

    it('should handle empty context', () => {
      const logger = new Logger(testLogPath);
      logger.log('info', 'TestComponent', 'Test message');

      const logContent = fs.readFileSync(testLogPath, 'utf8');
      const logEntry = JSON.parse(logContent.trim());

      assert.deepStrictEqual(logEntry.context, {});
    });
  });

  describe('Log Levels', () => {
    it('should log info messages', () => {
      const logger = new Logger(testLogPath);
      logger.info('TestComponent', 'Info message', { data: 'test' });

      const logContent = fs.readFileSync(testLogPath, 'utf8');
      const lines = logContent.trim().split('\n');
      const logEntry = JSON.parse(lines[lines.length - 1]);

      assert.strictEqual(logEntry.level, 'info');
      assert.strictEqual(logEntry.message, 'Info message');
    });

    it('should log warning messages', () => {
      const logger = new Logger(testLogPath);
      logger.warn('TestComponent', 'Warning message');

      const logContent = fs.readFileSync(testLogPath, 'utf8');
      const lines = logContent.trim().split('\n');
      const logEntry = JSON.parse(lines[lines.length - 1]);

      assert.strictEqual(logEntry.level, 'warn');
      assert.strictEqual(logEntry.message, 'Warning message');
    });

    it('should log error messages', () => {
      const logger = new Logger(testLogPath);
      logger.error('TestComponent', 'Error message', { error: 'details' });

      const logContent = fs.readFileSync(testLogPath, 'utf8');
      const logEntry = JSON.parse(logContent.trim());

      assert.strictEqual(logEntry.level, 'error');
      assert.strictEqual(logEntry.message, 'Error message');
      assert.strictEqual(logEntry.context.error, 'details');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const logger1 = getLogger(testLogPath);
      const logger2 = getLogger();

      assert.strictEqual(logger1, logger2);
    });
  });

  describe('Platform-Specific Paths', () => {
    it('should use platform-appropriate data directory', () => {
      const logger = new Logger();
      const platform = os.platform();

      if (platform === 'win32') {
        assert.ok(logger.logPath.includes('AppData'));
      } else if (platform === 'darwin') {
        assert.ok(logger.logPath.includes('Library'));
      } else {
        assert.ok(logger.logPath.includes('.local'));
      }
    });
  });
});

