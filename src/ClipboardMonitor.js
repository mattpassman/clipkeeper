import { EventEmitter } from 'events';
import clipboardy from 'clipboardy';
import crypto from 'crypto';
import { getLogger } from './Logger.js';

/**
 * ClipboardMonitor continuously monitors the system clipboard for changes
 * and emits events when new content is detected.
 * 
 * Requirements: 1.1, 1.2, 1.4, 1.5, 1.6
 */
class ClipboardMonitor extends EventEmitter {
  /**
   * @param {number} pollInterval - Polling interval in milliseconds (default: 500ms)
   * @param {Object} logger - Optional logger instance (defaults to singleton logger)
   */
  constructor(pollInterval = 500, logger = null) {
    super();
    this.pollInterval = pollInterval;
    this.lastContentHash = null;
    this.intervalId = null;
    this.isRunning = false;
    this.logger = logger || getLogger();
  }

  /**
   * Start monitoring the clipboard
   * Requirements: 1.1, 1.2
   */
  start() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.intervalId = setInterval(() => this._checkClipboard(), this.pollInterval);
    
    // Perform initial check
    this._checkClipboard();
  }

  /**
   * Stop monitoring the clipboard
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.lastContentHash = null;
  }

  /**
   * Check clipboard for changes with retry logic for access denied errors
   * Requirements: 1.2, 1.5, 1.6
   * @private
   */
  async _checkClipboard() {
    try {
      // Try to read clipboard with retry on access denied
      const content = await this._readClipboardWithRetry();
      
      // Calculate hash of content
      const contentHash = this._hashContent(content);
      
      // Check if content has changed
      if (contentHash !== this.lastContentHash) {
        this.lastContentHash = contentHash;
        
        // Emit change event with content
        // Requirements: 1.5 - capture content before it is overwritten
        this.emit('change', {
          text: content,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      // Requirements: 1.6 - log error and continue monitoring
      // Log the error with context
      this.logger.error('ClipboardMonitor', 'Failed to read clipboard', {
        error: {
          name: error.name,
          message: error.message,
          code: error.code
        },
        isRunning: this.isRunning
      });
      
      // Emit error event for consumers
      this.emit('error', {
        message: 'Failed to read clipboard',
        error: error,
        timestamp: Date.now()
      });
      
      // Continue monitoring - no need to stop or throw
    }
  }

  /**
   * Read clipboard with retry logic for access denied errors
   * Retries once after 100ms if access is denied (e.g., browser is writing)
   * @returns {Promise<string>} Clipboard content
   * @private
   */
  async _readClipboardWithRetry() {
    try {
      return await clipboardy.read();
    } catch (error) {
      // Check if it's an access denied error (Windows error code 5)
      const isAccessDenied = error.message && (
        error.message.includes('Access is denied') ||
        error.message.includes('code: 5') ||
        error.exitCode === 101
      );

      if (isAccessDenied) {
        // Wait 100ms and retry once
        await this._sleep(100);
        try {
          return await clipboardy.read();
        } catch (retryError) {
          // If retry fails, throw the original error
          throw error;
        }
      }

      // Not an access denied error, throw immediately
      throw error;
    }
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calculate hash of clipboard content
   * @param {string} content - Clipboard content
   * @returns {string} Hash of content
   * @private
   */
  _hashContent(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}

export default ClipboardMonitor;

