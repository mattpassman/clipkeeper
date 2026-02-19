import { describe, it } from 'node:test';
import assert from 'node:assert';
import ErrorMessages from '../src/ErrorMessages.js';

describe('ErrorMessages', () => {
  describe('SERVICE_NOT_RUNNING', () => {
    it('should return helpful message with next steps', () => {
      const message = ErrorMessages.SERVICE_NOT_RUNNING;
      
      assert.strictEqual(typeof message, 'string');
      assert.ok(message.includes('Service not running'));
      assert.ok(message.includes('clipkeeper start'));
    });
  });

  describe('DATABASE_LOCKED', () => {
    it('should return helpful message about database being busy', () => {
      const message = ErrorMessages.DATABASE_LOCKED;
      
      assert.strictEqual(typeof message, 'string');
      assert.ok(message.includes('Database is busy'));
      assert.ok(message.includes('try again'));
    });
  });

  describe('LOW_DISK_SPACE', () => {
    it('should return helpful message with next steps', () => {
      const message = ErrorMessages.LOW_DISK_SPACE;
      
      assert.strictEqual(typeof message, 'string');
      assert.ok(message.includes('Low disk space'));
      assert.ok(message.includes('clipkeeper clear'));
    });
  });

  describe('INVALID_CONFIG', () => {
    it('should format validation errors with next steps', () => {
      const errors = ['retention.days must be a number', 'privacy.enabled must be boolean'];
      const message = ErrorMessages.INVALID_CONFIG(errors);
      
      assert.strictEqual(typeof message, 'string');
      assert.ok(message.includes('Invalid configuration'));
      assert.ok(message.includes('retention.days must be a number'));
      assert.ok(message.includes('privacy.enabled must be boolean'));
      assert.ok(message.includes('clipkeeper config set'));
    });

    it('should handle single error', () => {
      const errors = ['retention.days must be a number'];
      const message = ErrorMessages.INVALID_CONFIG(errors);
      
      assert.ok(message.includes('retention.days must be a number'));
    });

    it('should handle empty error array', () => {
      const errors = [];
      const message = ErrorMessages.INVALID_CONFIG(errors);
      
      assert.strictEqual(typeof message, 'string');
      assert.ok(message.includes('Invalid configuration'));
    });
  });

  describe('ENTRY_NOT_FOUND', () => {
    it('should include entry ID and next steps', () => {
      const id = 'abc123';
      const message = ErrorMessages.ENTRY_NOT_FOUND(id);
      
      assert.strictEqual(typeof message, 'string');
      assert.ok(message.includes('Entry not found'));
      assert.ok(message.includes(id));
      assert.ok(message.includes('clipkeeper list'));
    });

    it('should handle different ID formats', () => {
      const ids = ['abc123', '12345', 'test-id-123'];
      
      for (const id of ids) {
        const message = ErrorMessages.ENTRY_NOT_FOUND(id);
        assert.ok(message.includes(id));
      }
    });
  });

  describe('INVALID_DATE', () => {
    it('should include invalid date and format examples', () => {
      const date = '2024-13-45';
      const message = ErrorMessages.INVALID_DATE(date);
      
      assert.strictEqual(typeof message, 'string');
      assert.ok(message.includes('Invalid date format'));
      assert.ok(message.includes(date));
      assert.ok(message.includes('YYYY-MM-DD'));
      assert.ok(message.includes('yesterday'));
      assert.ok(message.includes('today'));
    });

    it('should handle various invalid date formats', () => {
      const dates = ['invalid', '2024/01/01', '01-01-2024', 'tomorrow'];
      
      for (const date of dates) {
        const message = ErrorMessages.INVALID_DATE(date);
        assert.ok(message.includes(date));
        assert.ok(message.includes('YYYY-MM-DD'));
      }
    });
  });
});
