/**
 * SearchService - Handles text-based search queries with filtering
 * 
 * Coordinates search operations, formats results with previews,
 * and provides user-friendly output.
 */
class SearchService {
  /**
   * Create a SearchService
   * @param {HistoryStore} historyStore - The history store instance
   */
  constructor(historyStore) {
    if (!historyStore) {
      throw new Error('HistoryStore is required');
    }
    this.historyStore = historyStore;
  }

  /**
   * Search clipboard history
   * @param {string} query - Search query (keywords)
   * @param {Object} options - Search options
   * @param {number} options.limit - Maximum results (default: 10)
   * @param {string} options.contentType - Filter by content type
   * @param {Date|number} options.since - Only entries after this date
   * @returns {Array<Object>} Search results with metadata (preview, relativeTime)
   */
  search(query, options = {}) {
    // Parse query into keywords
    const keywords = this._parseQuery(query);
    
    // If no valid keywords, return empty results
    if (keywords.length === 0) {
      return [];
    }
    
    // Call historyStore.search() with options
    const results = this.historyStore.search(query, options);
    
    // Format results with previews and relative timestamps
    return results.map(entry => this._formatEntry(entry));
  }

  /**
   * Parse search query into keywords
   * @param {string} query - Raw query string
   * @returns {Array<string>} Keywords (lowercase, no empty strings)
   * @private
   */
  _parseQuery(query) {
    if (!query || typeof query !== 'string') {
      return [];
    }

    // Split on whitespace, remove empty strings, convert to lowercase
    return query
      .split(/\s+/)
      .filter(keyword => keyword.length > 0)
      .map(keyword => keyword.toLowerCase());
  }

  /**
   * Format entry for display with preview and relative timestamp
   * @param {Object} entry - Clipboard entry
   * @returns {Object} Formatted entry with preview and relativeTime
   * @private
   */
  _formatEntry(entry) {
    const formatted = { ...entry };
    
    // Generate preview (first 100 chars)
    if (entry.content && entry.content.length > 100) {
      formatted.preview = entry.content.substring(0, 100) + '...';
    } else {
      formatted.preview = entry.content || '';
    }
    
    // Calculate relative timestamp
    formatted.relativeTime = this._getRelativeTime(entry.timestamp);
    
    return formatted;
  }

  /**
   * Calculate relative time string from timestamp
   * @param {number} timestamp - Unix timestamp in milliseconds
   * @returns {string} Relative time string (e.g., "2 hours ago")
   * @private
   */
  _getRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    
    if (seconds < 60) {
      return 'just now';
    } else if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else if (hours < 24) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else if (days < 7) {
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    } else if (weeks < 4) {
      return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
    } else if (months < 12) {
      return `${months} month${months !== 1 ? 's' : ''} ago`;
    } else {
      return `${years} year${years !== 1 ? 's' : ''} ago`;
    }
  }

}

export default SearchService;
