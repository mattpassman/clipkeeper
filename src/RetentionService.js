/**
 * RetentionService manages automated cleanup of expired clipboard entries
 * Implements Requirements 3.1, 3.2, 3.3, 3.5, 3.6
 */
class RetentionService {
  /**
   * @param {HistoryStore} historyStore - HistoryStore instance
   * @param {ConfigurationManager} configManager - ConfigurationManager instance
   */
  constructor(historyStore, configManager) {
    this.historyStore = historyStore;
    this.configManager = configManager;
    this.cleanupInterval = null;
  }

  /**
   * Start periodic cleanup
   * Schedules cleanup every hour and runs initial cleanup immediately
   * Implements Requirement 3.1
   */
  start() {
    // Run initial cleanup immediately
    this.cleanup();

    // Schedule cleanup every hour (3600000 milliseconds)
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }

  /**
   * Stop periodic cleanup
   * Clears the cleanup interval
   * Implements Requirement 3.1
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Perform cleanup of expired entries
   * Implements Requirements 3.2, 3.3, 3.5, 3.6
   * @returns {number} Number of entries deleted
   */
  cleanup() {
    try {
      // Get retention.days from config
      const retentionDays = this.configManager.get('retention.days');

      // Skip if retention.days === 0 (unlimited retention)
      if (retentionDays === 0) {
        return 0;
      }

      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Delete entries older than cutoff date
      const deletedCount = this.historyStore.deleteOlderThan(cutoffDate);

      // Log deleted count if any entries were deleted
      if (deletedCount > 0) {
        console.log(`Retention cleanup: deleted ${deletedCount} entries older than ${retentionDays} days`);
      }

      return deletedCount;
    } catch (error) {
      console.error('Retention cleanup failed:', error.message);
      return 0;
    }
  }
}

export default RetentionService;
