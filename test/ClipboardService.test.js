import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import clipboardy from 'clipboardy';
import ClipboardService from '../src/ClipboardService.js';

describe('ClipboardService', { concurrency: 1 }, () => {
  let service;
  let originalClipboard;

  before(async () => {
    service = new ClipboardService();
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
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  describe('copy()', { concurrency: 1 }, () => {
    beforeEach(async () => {
      // Clear clipboard before each test
      try {
        await clipboardy.write('');
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        // Ignore errors during cleanup
      }
    });

    afterEach(async () => {
      // Add delay after each test to ensure clipboard state is stable
      await new Promise(resolve => setTimeout(resolve, 300));
    });

    it('should copy text content to clipboard', async () => {
      const testContent = 'Test clipboard content';
      
      await service.copy(testContent);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const clipboardContent = await clipboardy.read();
      assert.strictEqual(clipboardContent, testContent);
    });

    it('should preserve exact content including whitespace', async () => {
      const testContent = '  Test with   spaces\n\tand tabs  ';
      
      await service.copy(testContent);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const clipboardContent = await clipboardy.read();
      assert.strictEqual(clipboardContent, testContent);
    });

    it('should handle empty string', async () => {
      const testContent = '';
      
      await service.copy(testContent);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const clipboardContent = await clipboardy.read();
      assert.strictEqual(clipboardContent, testContent);
    });

    it('should handle special characters', async () => {
      const testContent = 'Special chars: !@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
      
      await service.copy(testContent);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const clipboardContent = await clipboardy.read();
      assert.strictEqual(clipboardContent, testContent);
    });

    it('should handle unicode characters', async () => {
      const testContent = 'Unicode: 你好 🎉 café';
      
      await service.copy(testContent);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const clipboardContent = await clipboardy.read();
      assert.strictEqual(clipboardContent, testContent);
    });
  });

  describe('read()', () => {
    it('should read current clipboard content', async () => {
      const testContent = 'Content to read';
      await clipboardy.write(testContent);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const result = await service.read();
      
      assert.strictEqual(result, testContent);
    });
  });

  describe('error handling', () => {
    it('should throw error with descriptive message on copy failure', async () => {
      // Pass invalid input to trigger error
      await assert.rejects(
        async () => await service.copy(null),
        (error) => {
          assert.match(error.message, /Failed to copy to clipboard/);
          return true;
        }
      );
    });
  });
});
