/**
 * Logger - Simple logging utility for clipkeeper
 * 
 * Validates: Requirements 13.1, 13.5
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

export class Logger {
  constructor(logPath = null) {
    // Default log path in application data directory
    if (!logPath) {
      const dataDir = this._getDataDirectory();
      this.logPath = path.join(dataDir, 'clipkeeper.log');
    } else {
      this.logPath = logPath;
    }

    // Ensure log directory exists
    this._ensureLogDirectory();
  }

  /**
   * Get platform-appropriate data directory
   * @returns {string} Data directory path
   * @private
   */
  _getDataDirectory() {
    const platform = os.platform();
    const homeDir = os.homedir();

    switch (platform) {
      case 'win32':
        return path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'clipkeeper');
      case 'darwin':
        return path.join(homeDir, 'Library', 'Application Support', 'clipkeeper');
      default: // linux and others
        return path.join(homeDir, '.local', 'share', 'clipkeeper');
    }
  }

  /**
   * Ensure log directory exists
   * @private
   */
  _ensureLogDirectory() {
    const logDir = path.dirname(this.logPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  /**
   * Write a log entry
   * @param {string} level - Log level (info, warn, error)
   * @param {string} component - Component name
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   */
  log(level, component, message, context = {}) {
    const logEntry = {
      timestamp: Date.now(),
      level,
      component,
      message,
      context
    };

    const logLine = JSON.stringify(logEntry) + '\n';

    try {
      fs.appendFileSync(this.logPath, logLine, 'utf8');
    } catch (error) {
      // If we can't write to log, write to stderr as fallback
      console.error('Failed to write to log file:', error.message);
      console.error('Log entry:', logLine);
    }
  }

  /**
   * Log debug message
   * @param {string} component - Component name
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   */
  debug(component, message, context = {}) {
    this.log('debug', component, message, context);
  }

  /**
   * Log info message
   * @param {string} component - Component name
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   */
  info(component, message, context = {}) {
    this.log('info', component, message, context);
  }

  /**
   * Log warning message
   * @param {string} component - Component name
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   */
  warn(component, message, context = {}) {
    this.log('warn', component, message, context);
  }

  /**
   * Log error message
   * @param {string} component - Component name
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   */
  error(component, message, context = {}) {
    this.log('error', component, message, context);
  }
}

// Singleton instance for application-wide logging
let loggerInstance = null;

/**
 * Get or create the singleton logger instance
 * @param {string} logPath - Optional log path
 * @returns {Logger} Logger instance
 */
export function getLogger(logPath = null) {
  if (!loggerInstance) {
    loggerInstance = new Logger(logPath);
  }
  return loggerInstance;
}

