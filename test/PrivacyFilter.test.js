import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { PrivacyFilter } from '../src/PrivacyFilter.js';
import { Logger } from '../src/Logger.js';

describe('PrivacyFilter', () => {
  describe('Constructor', () => {
    it('should initialize with default enabled state', () => {
      const filter = new PrivacyFilter();
      assert.strictEqual(filter.enabled, true);
    });

    it('should respect enabled config', () => {
      const filter = new PrivacyFilter({ enabled: false });
      assert.strictEqual(filter.enabled, false);
    });

    it('should initialize with custom patterns', () => {
      const customPatterns = [
        { name: 'test', regex: 'test', description: 'Test pattern' }
      ];
      const filter = new PrivacyFilter({ patterns: customPatterns });
      assert.strictEqual(filter.customPatterns.length, 1);
    });
  });

  describe('Password Pattern', () => {
    it('should filter strong passwords', () => {
      const filter = new PrivacyFilter();
      const result = filter.shouldFilter('MyP@ssw0rd123');
      assert.strictEqual(result.filtered, true);
      assert.strictEqual(result.matchedPattern, 'password');
    });

    it('should filter passwords with mixed case, numbers, and symbols', () => {
      const filter = new PrivacyFilter();
      const passwords = [
        'Abcd123!',
        'P@ssW0rd',
        'Secure#123Pass',
        'MyStr0ng!Pass'
      ];
      
      for (const password of passwords) {
        const result = filter.shouldFilter(password);
        assert.strictEqual(result.filtered, true, `Failed to filter: ${password}`);
        assert.strictEqual(result.matchedPattern, 'password');
      }
    });

    it('should not filter weak passwords without all requirements', () => {
      const filter = new PrivacyFilter();
      const weakPasswords = [
        'password',      // No uppercase, numbers, or symbols
        'PASSWORD',      // No lowercase, numbers, or symbols
        '12345678',      // No letters or symbols
        'Password',      // No numbers or symbols
        'Password1'      // No symbols
      ];
      
      for (const password of weakPasswords) {
        const result = filter.shouldFilter(password);
        assert.strictEqual(result.filtered, false, `Incorrectly filtered: ${password}`);
      }
    });
  });

  describe('Credit Card Pattern', () => {
    it('should filter valid credit card numbers', () => {
      const filter = new PrivacyFilter();
      // Valid Visa test card
      const result = filter.shouldFilter('4532015112830366');
      assert.strictEqual(result.filtered, true);
      assert.strictEqual(result.matchedPattern, 'credit_card');
    });

    it('should filter various valid credit card numbers', () => {
      const filter = new PrivacyFilter();
      const validCards = [
        '4532015112830366',  // Visa
        '5425233430109903',  // Mastercard
        '374245455400126',   // Amex
        '6011000991300009'   // Discover
      ];
      
      for (const card of validCards) {
        const result = filter.shouldFilter(card);
        assert.strictEqual(result.filtered, true, `Failed to filter: ${card}`);
        assert.strictEqual(result.matchedPattern, 'credit_card');
      }
    });

    it('should not filter invalid credit card numbers (Luhn check)', () => {
      const filter = new PrivacyFilter();
      const invalidCards = [
        '1234567890123456',  // Invalid Luhn
        '1111111111111111',  // Invalid Luhn
        '9999999999999999'   // Invalid Luhn
      ];
      
      for (const card of invalidCards) {
        const result = filter.shouldFilter(card);
        assert.strictEqual(result.filtered, false, `Incorrectly filtered: ${card}`);
      }
    });

    it('should handle credit cards with spaces or dashes', () => {
      const filter = new PrivacyFilter();
      // The regex looks for continuous digits, so spaced cards won't match
      // This is intentional - we only filter unformatted card numbers
      const result = filter.shouldFilter('4532 0151 1283 0366');
      assert.strictEqual(result.filtered, false);
    });
  });

  describe('API Key Patterns', () => {
    it('should filter Bearer tokens', () => {
      const filter = new PrivacyFilter();
      const result = filter.shouldFilter('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      assert.strictEqual(result.filtered, true);
      assert.strictEqual(result.matchedPattern, 'api_key_bearer');
    });

    it('should filter sk- prefixed API keys', () => {
      const filter = new PrivacyFilter();
      const result = filter.shouldFilter('sk-1234567890abcdefghijklmnopqrstuvwxyz');
      assert.strictEqual(result.filtered, true);
      assert.strictEqual(result.matchedPattern, 'api_key_sk');
    });

    it('should filter various API key formats', () => {
      const filter = new PrivacyFilter();
      const apiKeys = [
        'Bearer abc123def456',
        'sk-proj-abcdefghijklmnopqrstuvwxyz123456',
        'Bearer token_with_underscores_and-dashes'
      ];
      
      for (const key of apiKeys) {
        const result = filter.shouldFilter(key);
        assert.strictEqual(result.filtered, true, `Failed to filter: ${key}`);
      }
    });

    it('should not filter short sk- strings', () => {
      const filter = new PrivacyFilter();
      const result = filter.shouldFilter('sk-short');
      assert.strictEqual(result.filtered, false);
    });
  });

  describe('Private Key Patterns', () => {
    it('should filter PEM private keys', () => {
      const filter = new PrivacyFilter();
      const privateKey = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----';
      const result = filter.shouldFilter(privateKey);
      assert.strictEqual(result.filtered, true);
      assert.strictEqual(result.matchedPattern, 'private_key');
    });

    it('should filter various private key types', () => {
      const filter = new PrivacyFilter();
      const keys = [
        '-----BEGIN PRIVATE KEY-----',
        '-----BEGIN RSA PRIVATE KEY-----',
        '-----BEGIN EC PRIVATE KEY-----',
        '-----BEGIN ENCRYPTED PRIVATE KEY-----'
      ];
      
      for (const key of keys) {
        const result = filter.shouldFilter(key);
        assert.strictEqual(result.filtered, true, `Failed to filter: ${key}`);
        assert.strictEqual(result.matchedPattern, 'private_key');
      }
    });

    it('should not filter public keys', () => {
      const filter = new PrivacyFilter();
      const publicKey = '-----BEGIN PUBLIC KEY-----';
      const result = filter.shouldFilter(publicKey);
      assert.strictEqual(result.filtered, false);
    });
  });

  describe('SSH Key Patterns', () => {
    it('should filter SSH RSA keys', () => {
      const filter = new PrivacyFilter();
      const sshKey = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC...';
      const result = filter.shouldFilter(sshKey);
      assert.strictEqual(result.filtered, true);
      assert.strictEqual(result.matchedPattern, 'ssh_rsa');
    });

    it('should filter SSH Ed25519 keys', () => {
      const filter = new PrivacyFilter();
      const sshKey = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl';
      const result = filter.shouldFilter(sshKey);
      assert.strictEqual(result.filtered, true);
      assert.strictEqual(result.matchedPattern, 'ssh_ed25519');
    });
  });

  describe('Custom Patterns', () => {
    it('should add and use custom patterns', () => {
      const filter = new PrivacyFilter();
      filter.addCustomPattern('\\bSSN:\\s*\\d{3}-\\d{2}-\\d{4}\\b', 'ssn', 'Social Security Number');
      
      const result = filter.shouldFilter('SSN: 123-45-6789');
      assert.strictEqual(result.filtered, true);
      assert.strictEqual(result.matchedPattern, 'ssn');
    });

    it('should handle RegExp objects as patterns', () => {
      const filter = new PrivacyFilter();
      filter.addCustomPattern(/\bTEST-\d{4}\b/, 'test_id', 'Test ID');
      
      const result = filter.shouldFilter('TEST-1234');
      assert.strictEqual(result.filtered, true);
      assert.strictEqual(result.matchedPattern, 'test_id');
    });

    it('should throw error for invalid regex patterns', () => {
      const filter = new PrivacyFilter();
      assert.throws(() => {
        filter.addCustomPattern('[invalid(regex', 'invalid');
      }, /Invalid regex pattern/);
    });

    it('should skip invalid custom patterns during filtering', () => {
      const filter = new PrivacyFilter({
        patterns: [
          { name: 'invalid', regex: '[invalid(', description: 'Invalid pattern' }
        ]
      });
      
      // Should not throw, just skip the invalid pattern
      const result = filter.shouldFilter('some content');
      assert.strictEqual(result.filtered, false);
    });
  });

  describe('Disabled Filter', () => {
    it('should not filter when disabled', () => {
      const filter = new PrivacyFilter({ enabled: false });
      
      const sensitiveContent = [
        'MyP@ssw0rd123',
        '4532015112830366',
        'Bearer abc123',
        'ssh-rsa AAAAB3NzaC1yc2E...'
      ];
      
      for (const content of sensitiveContent) {
        const result = filter.shouldFilter(content);
        assert.strictEqual(result.filtered, false, `Filtered when disabled: ${content}`);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      const filter = new PrivacyFilter();
      const result = filter.shouldFilter('');
      assert.strictEqual(result.filtered, false);
    });

    it('should handle non-string input', () => {
      const filter = new PrivacyFilter();
      const result = filter.shouldFilter(null);
      assert.strictEqual(result.filtered, false);
    });

    it('should handle very long strings', () => {
      const filter = new PrivacyFilter();
      const longString = 'a'.repeat(100000) + 'MyP@ssw0rd123';
      const result = filter.shouldFilter(longString);
      assert.strictEqual(result.filtered, true);
    });

    it('should handle strings with multiple sensitive patterns', () => {
      const filter = new PrivacyFilter();
      const content = 'Password: MyP@ssw0rd123, Card: 4532015112830366';
      const result = filter.shouldFilter(content);
      assert.strictEqual(result.filtered, true);
      // Should match the first pattern found
      assert.ok(['password', 'credit_card'].includes(result.matchedPattern));
    });

    it('should handle special characters in content', () => {
      const filter = new PrivacyFilter();
      const content = 'Special chars: \n\t\r MyP@ssw0rd123 \u0000';
      const result = filter.shouldFilter(content);
      assert.strictEqual(result.filtered, true);
    });
  });

  describe('Luhn Algorithm', () => {
    it('should validate correct credit card numbers', () => {
      const filter = new PrivacyFilter();
      const validCards = [
        '4532015112830366',
        '5425233430109903',
        '374245455400126',
        '6011000991300009',
        '30569309025904'
      ];
      
      for (const card of validCards) {
        assert.strictEqual(filter._validateLuhn(card), true, `Failed Luhn check: ${card}`);
      }
    });

    it('should reject incorrect credit card numbers', () => {
      const filter = new PrivacyFilter();
      const invalidCards = [
        '1234567890123456',
        '9999999999999999',
        '1111111111111111'
      ];
      
      for (const card of invalidCards) {
        assert.strictEqual(filter._validateLuhn(card), false, `Passed Luhn check incorrectly: ${card}`);
      }
    });

    it('should handle cards with non-digit characters', () => {
      const filter = new PrivacyFilter();
      assert.strictEqual(filter._validateLuhn('4532-0151-1283-0366'), true);
      assert.strictEqual(filter._validateLuhn('4532 0151 1283 0366'), true);
    });

    it('should reject cards with invalid length', () => {
      const filter = new PrivacyFilter();
      assert.strictEqual(filter._validateLuhn('123'), false);
      assert.strictEqual(filter._validateLuhn('12345678901234567890'), false);
    });
  });

  describe('FilterResult Structure', () => {
    it('should return correct structure when filtered', () => {
      const filter = new PrivacyFilter();
      const result = filter.shouldFilter('MyP@ssw0rd123');
      
      assert.strictEqual(typeof result, 'object');
      assert.strictEqual(result.filtered, true);
      assert.strictEqual(typeof result.reason, 'string');
      assert.strictEqual(typeof result.matchedPattern, 'string');
    });

    it('should return correct structure when not filtered', () => {
      const filter = new PrivacyFilter();
      const result = filter.shouldFilter('normal text');
      
      assert.strictEqual(typeof result, 'object');
      assert.strictEqual(result.filtered, false);
      assert.strictEqual(result.reason, undefined);
      assert.strictEqual(result.matchedPattern, undefined);
    });
  });
});

describe('Secure Logging', () => {
  let testLogPath;
  let testLogDir;

  const setupTestLog = () => {
    testLogDir = path.join(os.tmpdir(), `clipkeeper-test-${Date.now()}`);
    testLogPath = path.join(testLogDir, 'test.log');
    return testLogPath;
  };

  const cleanupTestLog = () => {
    if (fs.existsSync(testLogPath)) {
      fs.unlinkSync(testLogPath);
    }
    if (fs.existsSync(testLogDir)) {
      fs.rmdirSync(testLogDir, { recursive: true });
    }
  };

  const readLogEntries = () => {
    if (!fs.existsSync(testLogPath)) {
      return [];
    }
    const logContent = fs.readFileSync(testLogPath, 'utf8');
    return logContent.trim().split('\n').filter(line => line).map(line => JSON.parse(line));
  };

  it('should log filtering action without logging actual content', () => {
    const logPath = setupTestLog();
    const logger = new Logger(logPath);
    const filter = new PrivacyFilter({ logger });

    const sensitiveContent = 'MyP@ssw0rd123';
    const result = filter.shouldFilter(sensitiveContent);

    assert.strictEqual(result.filtered, true);

    const logEntries = readLogEntries();
    assert.strictEqual(logEntries.length, 1);

    const logEntry = logEntries[0];
    assert.strictEqual(logEntry.level, 'info');
    assert.strictEqual(logEntry.component, 'PrivacyFilter');
    assert.strictEqual(logEntry.message, 'Content filtered');
    assert.strictEqual(logEntry.context.patternName, 'password');
    assert.ok(logEntry.context.reason);
    assert.ok(logEntry.context.timestamp);

    // Verify that the actual sensitive content is NOT in the log
    const logContent = fs.readFileSync(logPath, 'utf8');
    assert.strictEqual(logContent.includes(sensitiveContent), false);

    cleanupTestLog();
  });

  it('should include pattern name in log', () => {
    const logPath = setupTestLog();
    const logger = new Logger(logPath);
    const filter = new PrivacyFilter({ logger });

    filter.shouldFilter('4532015112830366'); // Credit card

    const logEntries = readLogEntries();
    assert.strictEqual(logEntries[0].context.patternName, 'credit_card');

    cleanupTestLog();
  });

  it('should include timestamp in log', () => {
    const logPath = setupTestLog();
    const logger = new Logger(logPath);
    const filter = new PrivacyFilter({ logger });

    const beforeTime = Date.now();
    filter.shouldFilter('Bearer abc123token');
    const afterTime = Date.now();

    const logEntries = readLogEntries();
    const logTimestamp = logEntries[0].context.timestamp;

    assert.ok(logTimestamp >= beforeTime);
    assert.ok(logTimestamp <= afterTime);

    cleanupTestLog();
  });

  it('should log for each filtered content', () => {
    const logPath = setupTestLog();
    const logger = new Logger(logPath);
    const filter = new PrivacyFilter({ logger });

    filter.shouldFilter('MyP@ssw0rd123');
    filter.shouldFilter('4532015112830366');
    filter.shouldFilter('Bearer token123');

    const logEntries = readLogEntries();
    assert.strictEqual(logEntries.length, 3);

    assert.strictEqual(logEntries[0].context.patternName, 'password');
    assert.strictEqual(logEntries[1].context.patternName, 'credit_card');
    assert.strictEqual(logEntries[2].context.patternName, 'api_key_bearer');

    cleanupTestLog();
  });

  it('should not log when content is not filtered', () => {
    const logPath = setupTestLog();
    const logger = new Logger(logPath);
    const filter = new PrivacyFilter({ logger });

    filter.shouldFilter('normal text content');

    const logEntries = readLogEntries();
    assert.strictEqual(logEntries.length, 0);

    cleanupTestLog();
  });

  it('should not log when filter is disabled', () => {
    const logPath = setupTestLog();
    const logger = new Logger(logPath);
    const filter = new PrivacyFilter({ enabled: false, logger });

    filter.shouldFilter('MyP@ssw0rd123');

    const logEntries = readLogEntries();
    assert.strictEqual(logEntries.length, 0);

    cleanupTestLog();
  });

  it('should log custom pattern matches', () => {
    const logPath = setupTestLog();
    const logger = new Logger(logPath);
    const filter = new PrivacyFilter({ logger });

    filter.addCustomPattern('\\bSSN:\\s*\\d{3}-\\d{2}-\\d{4}\\b', 'ssn', 'Social Security Number');
    filter.shouldFilter('SSN: 123-45-6789');

    const logEntries = readLogEntries();
    assert.strictEqual(logEntries.length, 1);
    assert.strictEqual(logEntries[0].context.patternName, 'ssn');
    assert.strictEqual(logEntries[0].context.reason, 'Social Security Number');

    // Verify SSN is not in the log
    const logContent = fs.readFileSync(logPath, 'utf8');
    assert.strictEqual(logContent.includes('123-45-6789'), false);

    cleanupTestLog();
  });

  it('should include reason in log entry', () => {
    const logPath = setupTestLog();
    const logger = new Logger(logPath);
    const filter = new PrivacyFilter({ logger });

    filter.shouldFilter('ssh-rsa AAAAB3NzaC1yc2E...');

    const logEntries = readLogEntries();
    assert.strictEqual(logEntries[0].context.reason, 'SSH RSA key');

    cleanupTestLog();
  });
});

