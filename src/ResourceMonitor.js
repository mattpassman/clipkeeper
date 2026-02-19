import os from 'os';
import fs from 'fs';
import path from 'path';

/**
 * ResourceMonitor tracks clipkeeper's resource usage over time
 * and logs metrics to a dedicated file for analysis.
 */
class ResourceMonitor {
  /**
   * @param {string} metricsPath - Path to metrics log file
   * @param {number} interval - Monitoring interval in milliseconds (default: 60000 = 1 minute)
   */
  constructor(metricsPath, interval = 60000) {
    this.metricsPath = metricsPath;
    this.interval = interval;
    this.intervalId = null;
    this.isRunning = false;
    this.startTime = null;
    this.historyStore = null;
    
    // Ensure metrics directory exists
    const metricsDir = path.dirname(metricsPath);
    if (!fs.existsSync(metricsDir)) {
      fs.mkdirSync(metricsDir, { recursive: true });
    }
  }

  /**
   * Set the HistoryStore instance for database metrics
   * @param {Object} historyStore - HistoryStore instance
   */
  setHistoryStore(historyStore) {
    this.historyStore = historyStore;
  }

  /**
   * Start monitoring resource usage
   */
  start() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.startTime = Date.now();
    
    // Log initial metrics
    this._collectAndLogMetrics();
    
    // Schedule periodic collection
    this.intervalId = setInterval(() => {
      this._collectAndLogMetrics();
    }, this.interval);
  }

  /**
   * Stop monitoring
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
  }

  /**
   * Collect current metrics and log to file
   * @private
   */
  _collectAndLogMetrics() {
    const metrics = this._collectMetrics();
    this._logMetrics(metrics);
  }

  /**
   * Collect current resource usage metrics
   * @returns {Object} Metrics object
   * @private
   */
  _collectMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const metrics = {
      timestamp: Date.now(),
      datetime: new Date().toISOString(),
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      
      // Memory metrics (in MB)
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
        external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100,
        arrayBuffers: Math.round((memUsage.arrayBuffers || 0) / 1024 / 1024 * 100) / 100
      },
      
      // CPU metrics (in microseconds)
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      
      // System metrics
      system: {
        platform: os.platform(),
        arch: os.arch(),
        totalMemory: Math.round(os.totalmem() / 1024 / 1024),
        freeMemory: Math.round(os.freemem() / 1024 / 1024),
        loadAverage: os.loadavg()
      }
    };

    // Add database metrics if HistoryStore is available
    if (this.historyStore) {
      try {
        const entryCount = this.historyStore.getCount();
        const countByType = this.historyStore.getCountByType();
        
        // Get database file size
        let dbSizeMB = 0;
        const dbPath = this.historyStore.dbPath;
        if (dbPath && dbPath !== ':memory:' && fs.existsSync(dbPath)) {
          const stats = fs.statSync(dbPath);
          dbSizeMB = Math.round(stats.size / 1024 / 1024 * 100) / 100;
        }
        
        metrics.database = {
          totalEntries: entryCount,
          entriesByType: countByType,
          sizeMB: dbSizeMB
        };
      } catch (error) {
        metrics.database = {
          error: error.message
        };
      }
    }

    return metrics;
  }

  /**
   * Log metrics to file
   * @param {Object} metrics - Metrics to log
   * @private
   */
  _logMetrics(metrics) {
    try {
      const logLine = JSON.stringify(metrics) + '\n';
      fs.appendFileSync(this.metricsPath, logLine, 'utf8');
    } catch (error) {
      console.error(`Failed to log metrics: ${error.message}`);
    }
  }

  /**
   * Read metrics from log file
   * @param {number} limit - Maximum number of entries to read (default: 100)
   * @returns {Array<Object>} Array of metric entries
   */
  static readMetrics(metricsPath, limit = 100) {
    try {
      if (!fs.existsSync(metricsPath)) {
        return [];
      }

      const content = fs.readFileSync(metricsPath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);
      
      // Get last N lines
      const recentLines = lines.slice(-limit);
      
      // Parse JSON lines
      const metrics = recentLines.map(line => {
        try {
          return JSON.parse(line);
        } catch (error) {
          return null;
        }
      }).filter(m => m !== null);

      return metrics;
    } catch (error) {
      console.error(`Failed to read metrics: ${error.message}`);
      return [];
    }
  }

  /**
   * Get summary statistics from metrics
   * @param {Array<Object>} metrics - Array of metric entries
   * @returns {Object} Summary statistics
   */
  static getSummary(metrics) {
    if (metrics.length === 0) {
      return null;
    }

    const memoryRss = metrics.map(m => m.memory.rss);
    const memoryHeap = metrics.map(m => m.memory.heapUsed);
    
    const summary = {
      period: {
        start: metrics[0].datetime,
        end: metrics[metrics.length - 1].datetime,
        samples: metrics.length
      },
      memory: {
        rss: {
          current: memoryRss[memoryRss.length - 1],
          min: Math.min(...memoryRss),
          max: Math.max(...memoryRss),
          avg: Math.round(memoryRss.reduce((a, b) => a + b, 0) / memoryRss.length * 100) / 100
        },
        heapUsed: {
          current: memoryHeap[memoryHeap.length - 1],
          min: Math.min(...memoryHeap),
          max: Math.max(...memoryHeap),
          avg: Math.round(memoryHeap.reduce((a, b) => a + b, 0) / memoryHeap.length * 100) / 100
        }
      }
    };

    // Add database stats if available
    const lastMetric = metrics[metrics.length - 1];
    if (lastMetric.database) {
      summary.database = lastMetric.database;
    }

    return summary;
  }

  /**
   * Clear metrics log file
   * @param {string} metricsPath - Path to metrics file
   */
  static clearMetrics(metricsPath) {
    try {
      if (fs.existsSync(metricsPath)) {
        fs.unlinkSync(metricsPath);
      }
    } catch (error) {
      console.error(`Failed to clear metrics: ${error.message}`);
    }
  }
}

export default ResourceMonitor;
