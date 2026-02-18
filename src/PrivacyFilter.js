/**
 * PrivacyFilter - Identifies and filters sensitive content patterns
 * 
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import { getLogger } from './Logger.js';

export class PrivacyFilter {
  constructor(config = {}) {
    this.enabled = config.enabled !== undefined ? config.enabled : true;
    this.customPatterns = config.patterns || [];
    this.logger = config.logger || getLogger();
    
    // Built-in patterns for sensitive content
    this.builtInPatterns = [
      {
        name: 'password',
        regex: /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}/,
        description: 'Password with mixed case, numbers, and symbols'
      },
      {
        name: 'credit_card',
        regex: /\b\d{13,19}\b/,
        description: 'Credit card number (13-19 digits)',
        validator: this._validateLuhn.bind(this)
      },
      {
        name: 'api_key_bearer',
        regex: /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/,
        description: 'Bearer token'
      },
      {
        name: 'api_key_sk',
        regex: /\bsk-[a-zA-Z0-9\-]{32,}\b/,
        description: 'API key starting with sk-'
      },
      {
        name: 'private_key',
        regex: /-----BEGIN.*PRIVATE KEY-----/,
        description: 'Private key (PEM format)'
      },
      {
        name: 'ssh_rsa',
        regex: /ssh-rsa\s+[A-Za-z0-9+/=]+/,
        description: 'SSH RSA key'
      },
      {
        name: 'ssh_ed25519',
        regex: /ssh-ed25519\s+[A-Za-z0-9+/=]+/,
        description: 'SSH Ed25519 key'
      }
    ];
  }

  /**
   * Check if content should be filtered based on sensitive patterns
   * @param {string} content - The content to check
   * @returns {FilterResult} - Result indicating if content should be filtered
   */
  shouldFilter(content) {
    if (!this.enabled) {
      return { filtered: false };
    }

    if (typeof content !== 'string' || content.length === 0) {
      return { filtered: false };
    }

    // Check if content is a URL - URLs should not be filtered as passwords
    const isUrl = /^https?:\/\//i.test(content.trim());

    // Check built-in patterns
    for (const pattern of this.builtInPatterns) {
      // Skip password check for URLs
      if (pattern.name === 'password' && isUrl) {
        continue;
      }

      if (pattern.regex.test(content)) {
        // If pattern has a validator, use it for additional validation
        if (pattern.validator) {
          const match = content.match(pattern.regex);
          if (match && pattern.validator(match[0])) {
            this._logFilterAction(pattern.name, pattern.description);
            return {
              filtered: true,
              reason: pattern.description,
              matchedPattern: pattern.name
            };
          }
        } else {
          this._logFilterAction(pattern.name, pattern.description);
          return {
            filtered: true,
            reason: pattern.description,
            matchedPattern: pattern.name
          };
        }
      }
    }

    // Check custom patterns
    for (const pattern of this.customPatterns) {
      try {
        const regex = new RegExp(pattern.regex);
        if (regex.test(content)) {
          this._logFilterAction(pattern.name, pattern.description || 'Custom pattern match');
          return {
            filtered: true,
            reason: pattern.description || 'Custom pattern match',
            matchedPattern: pattern.name
          };
        }
      } catch (error) {
        // Skip invalid regex patterns
        console.error(`Invalid custom pattern "${pattern.name}": ${error.message}`);
      }
    }

    return { filtered: false };
  }

  /**
   * Log filtering action without logging actual content
   * @param {string} patternName - Name of the matched pattern
   * @param {string} reason - Reason for filtering
   * @private
   */
  _logFilterAction(patternName, reason) {
    this.logger.info('PrivacyFilter', 'Content filtered', {
      patternName,
      reason,
      timestamp: Date.now()
    });
  }

  /**
   * Add a custom pattern to the filter
   * @param {string|RegExp} pattern - The regex pattern
   * @param {string} name - Name for the pattern
   * @param {string} description - Optional description
   */
  addCustomPattern(pattern, name, description = '') {
    // Validate pattern
    try {
      const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
      this.customPatterns.push({
        name,
        regex: regex.source,
        description
      });
    } catch (error) {
      throw new Error(`Invalid regex pattern: ${error.message}`);
    }
  }

  /**
   * Validate credit card number using Luhn algorithm
   * @param {string} cardNumber - The card number to validate
   * @returns {boolean} - True if valid according to Luhn algorithm
   * @private
   */
  _validateLuhn(cardNumber) {
    // Remove non-digit characters
    const digits = cardNumber.replace(/\D/g, '');
    
    // Must be 13-19 digits
    if (digits.length < 13 || digits.length > 19) {
      return false;
    }

    let sum = 0;
    let isEven = false;

    // Loop through digits from right to left
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i], 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }
}

/**
 * @typedef {Object} FilterResult
 * @property {boolean} filtered - Whether the content should be filtered
 * @property {string} [reason] - Reason for filtering
 * @property {string} [matchedPattern] - Name of the matched pattern
 */

/**
 * @typedef {Object} FilterPattern
 * @property {string} name - Pattern name
 * @property {string} regex - Regular expression pattern (as string)
 * @property {string} description - Pattern description
 */

/**
 * @typedef {Object} PrivacyConfig
 * @property {boolean} enabled - Whether privacy filtering is enabled
 * @property {FilterPattern[]} patterns - Custom filter patterns
 */

