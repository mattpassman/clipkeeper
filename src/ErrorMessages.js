/**
 * ErrorMessages utility class
 * 
 * Provides standardized error messages with helpful next steps for users.
 * All error messages follow a consistent format and include actionable guidance.
 */
class ErrorMessages {
  /**
   * Service not running error
   * @returns {string} Error message with next steps
   */
  static SERVICE_NOT_RUNNING = 
    'Service not running. Start it with: clipkeeper start';
  
  /**
   * Database locked error
   * @returns {string} Error message with next steps
   */
  static DATABASE_LOCKED = 
    'Database is busy. Please try again in a moment.';
  
  /**
   * Low disk space error
   * @returns {string} Error message with next steps
   */
  static LOW_DISK_SPACE = 
    'Low disk space. Consider clearing old entries with: clipkeeper clear';
  
  /**
   * Invalid configuration error
   * @param {Array<string>} errors - List of validation errors
   * @returns {string} Error message with next steps
   */
  static INVALID_CONFIG(errors) {
    return `Invalid configuration:\n${errors.join('\n')}\nFix with: clipkeeper config set <key> <value>`;
  }
  
  /**
   * Entry not found error
   * @param {string} id - Entry ID that was not found
   * @returns {string} Error message with next steps
   */
  static ENTRY_NOT_FOUND(id) {
    return `Entry not found: ${id}\nList entries with: clipkeeper list`;
  }
  
  /**
   * Invalid date format error
   * @param {string} date - Invalid date string
   * @returns {string} Error message with next steps
   */
  static INVALID_DATE(date) {
    return `Invalid date format: ${date}\nUse format: YYYY-MM-DD or "yesterday", "today", "N days ago"`;
  }
}

export default ErrorMessages;
