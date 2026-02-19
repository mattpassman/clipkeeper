#!/usr/bin/env node

/**
 * clipkeeper CLI
 * 
 * Command-line interface for clipkeeper clipboard history manager.
 * Provides commands for service management, search, and configuration.
 */

import { Command } from 'commander';
import { ConfigurationManager } from './ConfigurationManager.js';
import { ServiceManager } from './ServiceManager.js';
import ErrorMessages from './ErrorMessages.js';
import path from 'path';
import fs from 'fs';
import readline from 'readline';

/**
 * CLI class for clipkeeper
 * 
 * Manages the command-line interface using commander.js.
 * Provides commands for:
 * - Service management (start, stop, status)
 * - Clipboard history operations (search, list, clear)
 * - Configuration management (config set/show/get)
 */
class CLI {
  constructor() {
    this.program = new Command();
    this.configManager = null;
    this.serviceManager = null;
    this.setupCommands();
  }

  /**
   * Initialize CLI dependencies
   */
  async initialize() {
    // Initialize ConfigurationManager
    this.configManager = new ConfigurationManager();
    
    // Initialize ServiceManager
    this.serviceManager = new ServiceManager(this.configManager);
  }

  /**
   * Set up all CLI commands and their options
   */
  setupCommands() {
    // Main program configuration
    this.program
      .name('clipkeeper')
      .description('Smart clipboard history manager with automatic content classification and privacy filtering')
      .version('0.2.0')
      .addHelpText('after', `
Examples:
  $ clipkeeper start                    Start the background monitoring service
  $ clipkeeper list --limit 20          List the 20 most recent clipboard entries
  $ clipkeeper config set retention.days 60
                                        Set retention period to 60 days
  $ clipkeeper config show              Display all configuration settings

For more information, visit: https://github.com/yourusername/clipkeeper
      `);

    // Service management commands
    this.setupServiceCommands();
    
    // Search and history commands
    this.setupHistoryCommands();
    
    // Configuration commands
    this.setupConfigCommands();
  }

  /**
   * Set up service management commands (start, stop, status)
   */
  setupServiceCommands() {
    this.program
      .command('start')
      .description('Start the background clipboard monitoring service')
      .option('--monitor', 'Enable resource usage monitoring')
      .addHelpText('after', `
The start command launches clipkeeper as a background service that continuously
monitors your system clipboard. All clipboard changes will be captured, classified,
and stored locally for easy retrieval.

The service will continue running until you stop it with 'clipkeeper stop'.

Options:
  --monitor    Enable resource usage monitoring (logs metrics every minute)
      `)
      .action((options) => {
        this.handleStart(options);
      });

    this.program
      .command('stop')
      .description('Stop the background monitoring service')
      .addHelpText('after', `
The stop command gracefully terminates the clipkeeper background service.
Clipboard monitoring will cease, but all stored history remains intact.
      `)
      .action(() => {
        this.handleStop();
      });

    this.program
      .command('status')
      .description('Check the status of the background service')
      .addHelpText('after', `
The status command reports whether the clipkeeper service is currently running,
along with uptime information, total entries stored, and last activity timestamp.
      `)
      .action(() => {
        this.handleStatus();
      });

    this.program
      .command('metrics')
      .description('View resource usage metrics')
      .option('-l, --limit <number>', 'Number of recent samples to show', '100')
      .option('--clear', 'Clear metrics log file')
      .addHelpText('after', `
The metrics command displays resource usage statistics collected when the service
is running with the --monitor flag.

Metrics include:
  - Memory usage (RSS, heap)
  - CPU usage
  - Database size and entry counts
  - System information

Options:
  --limit <number>    Number of recent samples to display (default: 100)
  --clear             Clear the metrics log file

Examples:
  $ clipkeeper metrics              Show recent metrics summary
  $ clipkeeper metrics --limit 50   Show last 50 samples
  $ clipkeeper metrics --clear      Clear metrics history
      `)
      .action((options) => {
        this.handleMetrics(options);
      });
  }

  /**
   * Set up clipboard history commands (search, list, clear)
   */
  setupHistoryCommands() {
    this.program
      .command('search')
      .description('Search clipboard history by text')
      .argument('<query>', 'Search query (keywords)')
      .option('-l, --limit <number>', 'Maximum number of results', '10')
      .option('-t, --type <type>', 'Filter by content type (text, code, url, etc.)')
      .option('--since <date>', 'Only entries after date (YYYY-MM-DD, "yesterday", "today", "7 days ago")')
      .option('--no-interactive', 'Disable interactive mode - show table instead')
      .addHelpText('after', `
The search command finds clipboard entries containing your search keywords
and lets you select one to copy using arrow keys (interactive mode is default).

Search is case-insensitive and supports multiple keywords (AND logic).

Examples:
  $ clipkeeper search "error message"           # Interactive selection (default)
  $ clipkeeper search "API key" --limit 20      # Show more results
  $ clipkeeper search "function" --type code    # Filter by type
  $ clipkeeper search "https" --since yesterday # Recent entries only
  $ clipkeeper search "config" --no-interactive # Show table with IDs instead
      `)
      .action((query, options) => {
        this.handleSearch(query, options);
      });

    this.program
      .command('list')
      .description('List recent clipboard entries')
      .option('-l, --limit <number>', 'Maximum number of entries to display', '10')
      .option('-t, --type <type>', 'Filter by content type (text, code, url, image, etc.)')
      .option('-s, --search <text>', 'Filter by text search')
      .option('--since <date>', 'Only entries after date (YYYY-MM-DD, "yesterday", "today", "7 days ago")')
      .option('-f, --format <format>', 'Output format: table, json, csv', 'table')
      .option('--no-interactive', 'Disable interactive mode - show table instead')
      .addHelpText('after', `
The list command displays your recent clipboard history and lets you select
an entry to copy using arrow keys (interactive mode is default).

Content types: text, code, url, image, file_path, json, xml, markdown
Output formats: table (default), json, csv

Examples:
  $ clipkeeper list                           # Interactive selection (default)
  $ clipkeeper list --limit 50                # Show more entries
  $ clipkeeper list --type code               # Filter by type
  $ clipkeeper list --search "error"          # Filter by text
  $ clipkeeper list --since yesterday         # Recent entries only
  $ clipkeeper list --format json             # JSON output
  $ clipkeeper list --format csv              # CSV output
  $ clipkeeper list --no-interactive          # Show table with IDs instead
      `)
      .action((options) => {
        this.handleList(options);
      });

    this.program
      .command('copy')
      .description('Copy a clipboard entry back to clipboard')
      .argument('<id>', 'Entry ID to copy')
      .addHelpText('after', `
The copy command retrieves a historical clipboard entry by its ID and copies
it back to your system clipboard, allowing you to reuse previously copied content.

Use the 'list' or 'search' commands to find entry IDs.

Examples:
  $ clipkeeper copy abc123
  $ clipkeeper copy def456
      `)
      .action((id) => {
        this.handleCopy(id);
      });

    this.program
      .command('clear')
      .description('Clear all clipboard history')
      .option('-c, --confirm', 'Skip confirmation prompt')
      .addHelpText('after', `
The clear command deletes all stored clipboard entries and their associated
embeddings. This action cannot be undone.

By default, you will be prompted to confirm. Use --confirm to skip the prompt.

Examples:
  $ clipkeeper clear
  $ clipkeeper clear --confirm
      `)
      .action((options) => {
        this.handleClear(options);
      });
  }

  /**
   * Set up configuration commands (config set/show/get)
   */
  setupConfigCommands() {
    const config = this.program
      .command('config')
      .description('Manage clipkeeper configuration settings')
      .addHelpText('after', `
The config command allows you to view and modify clipkeeper settings,
including privacy filters and retention policies.

Configuration is stored in:
  - Linux/macOS: ~/.config/clipkeeper/config.json
  - Windows: %APPDATA%/clipkeeper/config.json

Examples:
  $ clipkeeper config show
  $ clipkeeper config get retention.days
  $ clipkeeper config set retention.days 60
  $ clipkeeper config set privacy.enabled true
      `);

    config
      .command('set')
      .description('Set a configuration value')
      .argument('<key>', 'Configuration key (e.g., embedding.provider)')
      .argument('<value>', 'Configuration value')
      .addHelpText('after', `
Common configuration keys:
  retention.days           - Number of days to retain history (0 = unlimited)
  privacy.enabled          - Enable/disable privacy filtering (true/false)
  monitoring.pollInterval  - Clipboard polling interval in milliseconds
  monitoring.autoStart     - Auto-start service on login (true/false)

Examples:
  $ clipkeeper config set retention.days 90
  $ clipkeeper config set privacy.enabled true
  $ clipkeeper config set monitoring.pollInterval 500
      `)
      .action((key, value) => {
        this.handleConfigSet(key, value);
      });

    config
      .command('show')
      .description('Display all configuration settings')
      .addHelpText('after', `
The show command displays all current configuration settings.
API keys are masked for security (only first and last 4 characters shown).
      `)
      .action(() => {
        this.handleConfigShow();
      });

    config
      .command('get')
      .description('Get a specific configuration value')
      .argument('<key>', 'Configuration key to retrieve')
      .addHelpText('after', `
Examples:
  $ clipkeeper config get retention.days
  $ clipkeeper config get privacy.enabled
      `)
      .action((key) => {
        this.handleConfigGet(key);
      });
  }

  /**
   * Parse command-line arguments and execute commands
   * @param {string[]} args - Command-line arguments (defaults to process.argv)
   */
  async run(args = process.argv) {
    await this.program.parseAsync(args);
  }

  // Command handlers

  async handleStart(options = {}) {
    try {
      await this.initialize();
      
      console.log('Starting clipkeeper service...');
      const result = this.serviceManager.start({ monitor: options.monitor });
      
      if (result.success) {
        console.log(`✓ ${result.message}`);
        console.log('\nThe service is now running in the background.');
        if (options.monitor) {
          console.log('Resource monitoring is enabled. View metrics with: clipkeeper metrics');
        }
        console.log('Use "clipkeeper stop" to stop the service.');
      } else {
        console.error(`✗ ${result.message}`);
        process.exit(1);
      }
    } catch (error) {
      console.error(`✗ Failed to start service: ${error.message}`);
      process.exit(1);
    }
  }

  async handleStop() {
    try {
      await this.initialize();
      
      console.log('Stopping clipkeeper service...');
      const result = this.serviceManager.stop();
      
      if (result.success) {
        console.log(`✓ ${result.message}`);
      } else {
        console.error(`✗ ${result.message}`);
        process.exit(1);
      }
    } catch (error) {
      console.error(`✗ Failed to stop service: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Handle status command
   * Requirements: 12.3
   */
  async handleStatus() {
    try {
      await this.initialize();
      
      const status = this.serviceManager.getStatus();
      
      console.log('\nclipkeeper Service Status:');
      console.log('═'.repeat(60));
      
      if (status.running) {
        console.log(`Status:   ✓ Running`);
        console.log(`PID:      ${status.pid}`);
        
        // Get additional stats from database
        const stats = await this._getServiceStats();
        
        if (stats.uptime) {
          console.log(`Uptime:   ${this._formatUptime(stats.uptime)}`);
        }
        
        console.log(`\nClipboard History:`);
        console.log(`  Total entries:  ${stats.totalEntries}`);
        console.log(`  Last activity:  ${stats.lastActivity}`);
        
        if (stats.entriesByType && Object.keys(stats.entriesByType).length > 0) {
          console.log(`\nEntries by type:`);
          for (const [type, count] of Object.entries(stats.entriesByType)) {
            console.log(`  ${type.padEnd(12)} ${count}`);
          }
        }
      } else {
        console.log(`Status:   ✗ Not running`);
      }
      
      console.log(`\nPID File: ${status.pidFile}`);
      console.log('═'.repeat(60));
    } catch (error) {
      console.error(`✗ Failed to check status: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Get service statistics from database
   * @returns {Promise<object>} Service statistics
   * @private
   */
  async _getServiceStats() {
    const HistoryStore = (await import('./HistoryStore.js')).default;
    const dataDir = this.configManager.get('storage.dataDir');
    const dbPath = path.join(dataDir, 'clipboard-history.db');
    
    const stats = {
      totalEntries: 0,
      lastActivity: 'Never',
      entriesByType: {},
      uptime: null
    };

    try {
      // Check if database exists
      if (!fs.existsSync(dbPath)) {
        return stats;
      }

      const historyStore = new HistoryStore(dbPath);
      
      // Get recent entries to calculate stats
      const entries = await historyStore.getRecent(1000);
      stats.totalEntries = entries.length;
      
      if (entries.length > 0) {
        // Get last activity timestamp
        const lastEntry = entries[0];
        const lastTime = new Date(lastEntry.timestamp);
        const now = new Date();
        const diffMs = now - lastTime;
        
        if (diffMs < 60000) {
          stats.lastActivity = 'Just now';
        } else if (diffMs < 3600000) {
          const mins = Math.floor(diffMs / 60000);
          stats.lastActivity = `${mins} minute${mins > 1 ? 's' : ''} ago`;
        } else if (diffMs < 86400000) {
          const hours = Math.floor(diffMs / 3600000);
          stats.lastActivity = `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else {
          const days = Math.floor(diffMs / 86400000);
          stats.lastActivity = `${days} day${days > 1 ? 's' : ''} ago`;
        }
        
        // Count entries by type
        for (const entry of entries) {
          const type = entry.content_type || 'unknown';
          stats.entriesByType[type] = (stats.entriesByType[type] || 0) + 1;
        }
      }
      
      // Calculate uptime from PID file creation time
      const pidFilePath = this.serviceManager.pidFilePath;
      if (fs.existsSync(pidFilePath)) {
        const pidFileStats = fs.statSync(pidFilePath);
        const startTime = pidFileStats.mtime;
        stats.uptime = Date.now() - startTime.getTime();
      }
      
      historyStore.close();
    } catch (error) {
      // If we can't get stats, just return defaults
      console.error(`Warning: Could not retrieve service statistics: ${error.message}`);
    }

    return stats;
  }

  /**
   * Format uptime in human-readable format
   * @param {number} ms - Uptime in milliseconds
   * @returns {string} Formatted uptime
   * @private
   */
  _formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Handle metrics command
   * Display resource usage metrics
   * @param {Object} options - Command options
   */
  async handleMetrics(options = {}) {
    try {
      await this.initialize();
      
      const dataDir = this.configManager.get('storage.dataDir');
      const metricsPath = path.join(dataDir, 'metrics.log');
      
      // Handle clear option
      if (options.clear) {
        const ResourceMonitor = (await import('./ResourceMonitor.js')).default;
        ResourceMonitor.clearMetrics(metricsPath);
        console.log('✓ Metrics log cleared');
        return;
      }
      
      // Read metrics
      const ResourceMonitor = (await import('./ResourceMonitor.js')).default;
      const limit = parseInt(options.limit, 10) || 100;
      const metrics = ResourceMonitor.readMetrics(metricsPath, limit);
      
      if (metrics.length === 0) {
        console.log('\nNo metrics data available.');
        console.log('Start the service with --monitor flag to collect metrics:');
        console.log('  clipkeeper start --monitor');
        return;
      }
      
      // Get summary
      const summary = ResourceMonitor.getSummary(metrics);
      const latestMetric = metrics[metrics.length - 1];
      
      // Display summary
      console.log('\nResource Usage Metrics');
      console.log('═'.repeat(60));
      console.log(`\nPeriod: ${summary.period.start} to ${summary.period.end}`);
      console.log(`Samples: ${summary.period.samples}`);
      console.log(`Uptime: ${this._formatUptime(latestMetric.uptime)}`);
      
      console.log(`\nMemory (MB):`);
      console.log(`  RSS (Resident Set Size):`);
      console.log(`    Current: ${summary.memory.rss.current} MB`);
      console.log(`    Min:     ${summary.memory.rss.min} MB`);
      console.log(`    Max:     ${summary.memory.rss.max} MB`);
      console.log(`    Avg:     ${summary.memory.rss.avg} MB`);
      
      console.log(`  Heap Used:`);
      console.log(`    Current: ${summary.memory.heapUsed.current} MB`);
      console.log(`    Min:     ${summary.memory.heapUsed.min} MB`);
      console.log(`    Max:     ${summary.memory.heapUsed.max} MB`);
      console.log(`    Avg:     ${summary.memory.heapUsed.avg} MB`);
      
      console.log(`  Heap Total: ${latestMetric.memory.heapTotal} MB`);
      console.log(`  External:   ${latestMetric.memory.external} MB`);
      console.log(`  Buffers:    ${latestMetric.memory.arrayBuffers} MB`);
      
      // Calculate CPU usage
      const cpuUserSeconds = (latestMetric.cpu.user / 1000000).toFixed(2);
      const cpuSystemSeconds = (latestMetric.cpu.system / 1000000).toFixed(2);
      const cpuTotalSeconds = ((latestMetric.cpu.user + latestMetric.cpu.system) / 1000000).toFixed(2);
      const uptimeSeconds = (latestMetric.uptime / 1000).toFixed(2);
      const cpuPercentage = uptimeSeconds > 0 
        ? ((cpuTotalSeconds / uptimeSeconds) * 100).toFixed(2)
        : '0.00';
      
      console.log(`\nCPU Usage:`);
      console.log(`  User:   ${cpuUserSeconds}s (time spent in application code)`);
      console.log(`  System: ${cpuSystemSeconds}s (time spent in kernel operations)`);
      console.log(`  Total:  ${cpuTotalSeconds}s`);
      console.log(`  Usage:  ${cpuPercentage}% (of total uptime)`);
      
      console.log(`\nSystem:`);
      console.log(`  Platform:      ${latestMetric.system.platform}`);
      console.log(`  Architecture:  ${latestMetric.system.arch}`);
      console.log(`  Total Memory:  ${latestMetric.system.totalMemory} MB`);
      console.log(`  Free Memory:   ${latestMetric.system.freeMemory} MB`);
      if (latestMetric.system.loadAverage && latestMetric.system.loadAverage.some(v => v > 0)) {
        console.log(`  Load Average:  ${latestMetric.system.loadAverage.map(v => v.toFixed(2)).join(', ')}`);
      }
      
      if (summary.database) {
        console.log(`\nDatabase:`);
        const dbSize = summary.database.sizeMB !== undefined ? summary.database.sizeMB : 'N/A';
        console.log(`  File size:     ${dbSize} MB`);
        console.log(`  Total entries: ${summary.database.totalEntries}`);
        if (summary.database.entriesByType) {
          console.log(`  Entries by type:`);
          for (const [type, count] of Object.entries(summary.database.entriesByType)) {
            console.log(`    ${type.padEnd(12)} ${count}`);
          }
        }
      }
      
      console.log('\n' + '═'.repeat(60));
      console.log(`\nMetrics file: ${metricsPath}`);
      console.log(`Sampling interval: Every 60 seconds`);
      console.log(`Use --limit to show more samples, or --clear to reset metrics`);
      
    } catch (error) {
      console.error(`✗ Failed to read metrics: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Handle search command
   * Requirements: 1.1, 1.4, 1.5, 1.6, 1.7, 1.8
   * @param {string} query - Search query
   * @param {Object} options - Search options
   */
  async handleSearch(query, options = {}) {
    try {
      await this.initialize();
      
      // Parse limit
      const limit = parseInt(options.limit, 10);
      if (isNaN(limit) || limit <= 0) {
        console.error('✗ Invalid limit value. Must be a positive number.');
        process.exit(1);
      }
      
      // Parse since option if provided
      let since = null;
      if (options.since) {
        try {
          since = this._parseDate(options.since);
        } catch (error) {
          console.error(`✗ ${error.message}`);
          process.exit(1);
        }
      }
      
      // Get data directory and database path
      const dataDir = this.configManager.get('storage.dataDir');
      const dbPath = this.configManager.get('storage.dbPath') || 
                     path.join(dataDir, 'clipboard-history.db');
      
      // Check if database exists
      if (!fs.existsSync(dbPath)) {
        console.log('No clipboard history found. Start the service to begin capturing clipboard entries.');
        return;
      }
      
      // Import HistoryStore and SearchService dynamically
      const { default: HistoryStore } = await import('./HistoryStore.js');
      const { default: SearchService } = await import('./SearchService.js');
      
      const historyStore = new HistoryStore(dbPath);
      const searchService = new SearchService(historyStore);
      
      try {
        // Build search options
        const searchOptions = {
          limit,
        };
        
        if (options.type) {
          searchOptions.contentType = options.type;
        }
        
        if (since) {
          searchOptions.since = since;
        }
        
        // Perform search
        const results = searchService.search(query, searchOptions);
        
        // Check if any results found
        if (results.length === 0) {
          console.log('\nNo results found.');
          console.log(`\nTry a different search query or check your filters.`);
          return;
        }
        
        // Interactive mode is default (unless --no-interactive is specified)
        if (options.interactive !== false) {
          await this._handleInteractiveSelection(results, historyStore);
          return;
        }
        
        // Non-interactive mode - display table with IDs
        console.log('\nSearch Results:');
        console.log('─'.repeat(100));
        
        // Display results in table format with IDs
        this._displaySearchResultsTable(results);
        
        // Display summary
        console.log('─'.repeat(100));
        console.log(`\nFound ${results.length} matching entries`);
        console.log('\nUse "clipkeeper copy <id>" to copy an entry back to clipboard');
        
      } finally {
        historyStore.close();
      }
      
    } catch (error) {
      // Handle specific error codes
      if (error.code === 'SQLITE_BUSY') {
        console.error(`✗ ${ErrorMessages.DATABASE_LOCKED}`);
        process.exit(1);
      } else if (error.code === 'ENOSPC') {
        console.error(`✗ ${ErrorMessages.LOW_DISK_SPACE}`);
        process.exit(1);
      }
      
      console.error(`✗ Failed to search: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Display search results in table format with IDs
   * @private
   * @param {Array<Object>} results - Search results to display
   */
  _displaySearchResultsTable(results) {
    // Column widths
    const idWidth = 10;
    const timestampWidth = 20;
    const typeWidth = 12;
    const previewWidth = 50;
    
    // Header
    const header = 
      'ID'.padEnd(idWidth) + ' ' +
      'Timestamp'.padEnd(timestampWidth) + ' ' +
      'Type'.padEnd(typeWidth) + ' ' +
      'Preview';
    console.log(header);
    console.log('─'.repeat(100));
    
    // Rows
    for (const result of results) {
      // Format ID (truncate if too long)
      const id = result.id ? result.id.substring(0, idWidth - 1).padEnd(idWidth) : ''.padEnd(idWidth);
      
      // Format timestamp (use relativeTime from SearchService)
      const timestamp = result.relativeTime ? result.relativeTime.padEnd(timestampWidth) : ''.padEnd(timestampWidth);
      
      // Format type
      const type = (result.contentType || result.content_type || 'unknown').padEnd(typeWidth);
      
      // Format preview (use preview from SearchService)
      const preview = this._formatPreview(result.preview || result.content, previewWidth);
      
      // Print row
      console.log(
        id + ' ' +
        timestamp + ' ' +
        type + ' ' +
        preview
      );
    }
  }

  /**
   * Parse date string into Date object
   * Supports ISO dates (YYYY-MM-DD), relative terms (yesterday, today),
   * and relative offsets (7 days ago)
   * @param {string} dateStr - Date string to parse
   * @returns {Date} Parsed date
   * @throws {Error} If date format is invalid
   * @private
   */
  _parseDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') {
      throw new Error(ErrorMessages.INVALID_DATE(dateStr));
    }

    const str = dateStr.trim().toLowerCase();

    // Handle relative terms
    if (str === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    }

    if (str === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      return yesterday;
    }

    // Handle relative offsets like "7 days ago", "2 weeks ago", "3 months ago"
    const relativeMatch = str.match(/^(\d+)\s+(day|days|week|weeks|month|months|year|years)\s+ago$/);
    if (relativeMatch) {
      const amount = parseInt(relativeMatch[1], 10);
      const unit = relativeMatch[2];
      const date = new Date();

      if (unit.startsWith('day')) {
        date.setDate(date.getDate() - amount);
      } else if (unit.startsWith('week')) {
        date.setDate(date.getDate() - (amount * 7));
      } else if (unit.startsWith('month')) {
        date.setMonth(date.getMonth() - amount);
      } else if (unit.startsWith('year')) {
        date.setFullYear(date.getFullYear() - amount);
      }

      date.setHours(0, 0, 0, 0);
      return date;
    }

    // Handle ISO date format (YYYY-MM-DD)
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1; // Month is 0-indexed
      const day = parseInt(isoMatch[3], 10);
      
      const date = new Date(year, month, day);
      
      // Validate the date is valid
      if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
        throw new Error(ErrorMessages.INVALID_DATE(dateStr));
      }
      
      return date;
    }

    // If no pattern matched, throw error
    throw new Error(ErrorMessages.INVALID_DATE(dateStr));
  }

  /**
   * Handle interactive selection of entries
   * @private
   * @param {Array<Object>} entries - Entries to select from
   * @param {Object} historyStore - HistoryStore instance
   */
  async _handleInteractiveSelection(entries, historyStore) {
    const { select, Separator } = await import('@inquirer/prompts');
    const { default: ClipboardService } = await import('./ClipboardService.js');
    
    // Format entries as choices for the prompt
    const choices = [
      {
        name: '[ Cancel ]',
        value: '__CANCEL__',
        description: 'Return to terminal without copying'
      },
      new Separator(),
      ...entries.map(entry => {
        const date = new Date(entry.timestamp);
        const timestamp = this._formatTimestamp(date);
        const preview = this._formatPreview(entry.content, 60);
        
        return {
          name: `[${timestamp}] ${entry.contentType.padEnd(10)} ${preview}`,
          value: entry.id,
          description: entry.content.length > 100 
            ? entry.content.substring(0, 100) + '...' 
            : entry.content
        };
      })
    ];
    
    try {
      // Show interactive selection
      const selectedId = await select({
        message: 'Select an entry to copy to clipboard:',
        choices,
        pageSize: 15
      });
      
      // Check if user selected cancel
      if (selectedId === '__CANCEL__') {
        console.log('\nCancelled');
        return;
      }
      
      // Get the full entry
      const entry = historyStore.getById(selectedId);
      
      if (!entry) {
        console.error('✗ Entry not found');
        return;
      }
      
      // Copy to clipboard
      const clipboardService = new ClipboardService();
      await clipboardService.copy(entry.content);
      
      // Show success message
      console.log(`\n✓ Copied to clipboard!`);
      const preview = this._formatPreview(entry.content, 80);
      console.log(`\nContent: ${preview}`);
      
    } catch (error) {
      // User cancelled (Ctrl+C)
      if (error.name === 'ExitPromptError') {
        console.log('\nCancelled');
        return;
      }
      throw error;
    }
  }

  /**
   * Handle copy command
   * Requirements: 2.2, 2.3, 2.4, 2.5
   * @param {string} id - Entry ID to copy
   */
  async handleCopy(id) {
    try {
      await this.initialize();
      
      // Get data directory and database path
      const dataDir = this.configManager.get('storage.dataDir');
      const dbPath = this.configManager.get('storage.dbPath') || 
                     path.join(dataDir, 'clipboard-history.db');
      
      // Check if database exists
      if (!fs.existsSync(dbPath)) {
        console.error('✗ No clipboard history found. Start the service to begin capturing clipboard entries.');
        process.exit(1);
      }
      
      // Import HistoryStore and ClipboardService dynamically
      const { default: HistoryStore } = await import('./HistoryStore.js');
      const { default: ClipboardService } = await import('./ClipboardService.js');
      
      const historyStore = new HistoryStore(dbPath);
      const clipboardService = new ClipboardService();
      
      try {
        // Get entry by ID
        const entry = historyStore.getById(id);
        
        // Check if entry exists
        if (!entry) {
          console.error(`✗ ${ErrorMessages.ENTRY_NOT_FOUND(id)}`);
          process.exit(1);
        }
        
        // Copy content to clipboard
        await clipboardService.copy(entry.content);
        
        // Display success message
        console.log(`✓ Copied entry ${id} to clipboard`);
        
        // Show preview of copied content
        const preview = this._formatPreview(entry.content, 60);
        console.log(`\nContent: ${preview}`);
        
      } finally {
        historyStore.close();
      }
      
    } catch (error) {
      // Handle specific error codes
      if (error.code === 'SQLITE_BUSY') {
        console.error(`✗ ${ErrorMessages.DATABASE_LOCKED}`);
        process.exit(1);
      } else if (error.code === 'ENOSPC') {
        console.error(`✗ ${ErrorMessages.LOW_DISK_SPACE}`);
        process.exit(1);
      }
      
      console.error(`✗ Failed to copy entry: ${error.message}`);
      process.exit(1);
    }
  }

  async handleList(options) {
    try {
      await this.initialize();
      
      // Parse limit
      const limit = parseInt(options.limit, 10);
      if (isNaN(limit) || limit <= 0) {
        console.error('✗ Invalid limit value. Must be a positive number.');
        process.exit(1);
      }
      
      // Validate format option
      const validFormats = ['table', 'json', 'csv'];
      const format = options.format || 'table';
      if (!validFormats.includes(format)) {
        console.error(`✗ Invalid format: ${format}. Must be one of: ${validFormats.join(', ')}`);
        process.exit(1);
      }
      
      // Get data directory and database path
      const dataDir = this.configManager.get('storage.dataDir');
      const dbPath = this.configManager.get('storage.dbPath') || 
                     path.join(dataDir, 'clipboard-history.db');
      
      // Check if database exists
      if (!fs.existsSync(dbPath)) {
        console.log('No clipboard history found. Start the service to begin capturing clipboard entries.');
        return;
      }
      
      // Import HistoryStore dynamically
      const { default: HistoryStore } = await import('./HistoryStore.js');
      const historyStore = new HistoryStore(dbPath);
      
      try {
        // Retrieve entries
        let entries;
        let totalCount = 0;
        
        // If search option provided, use SearchService
        if (options.search) {
          const { default: SearchService } = await import('./SearchService.js');
          const searchService = new SearchService(historyStore);
          
          // Build search options
          const searchOptions = { limit };
          if (options.type) {
            searchOptions.contentType = options.type;
          }
          if (options.since) {
            const sinceDate = this._parseDate(options.since);
            if (!sinceDate) {
              console.error(`✗ Invalid date format: ${options.since}`);
              console.error('Use format: YYYY-MM-DD or "yesterday", "today", "7 days ago"');
              process.exit(1);
            }
            searchOptions.since = sinceDate;
          }
          
          // Perform search
          const results = searchService.search(options.search, searchOptions);
          entries = results;
          
          // Get total count for search results
          totalCount = entries.length;
        } else {
          // Use HistoryStore.getRecent() or getSince()
          if (options.since) {
            const sinceDate = this._parseDate(options.since);
            if (!sinceDate) {
              console.error(`✗ Invalid date format: ${options.since}`);
              console.error('Use format: YYYY-MM-DD or "yesterday", "today", "7 days ago"');
              process.exit(1);
            }
            entries = historyStore.getSince(sinceDate, limit);
          } else if (options.type) {
            entries = historyStore.getRecentByType(limit, options.type);
          } else {
            entries = historyStore.getRecent(limit);
          }
          
          // Get total count
          if (options.type) {
            const countByType = historyStore.getCountByType();
            totalCount = countByType[options.type] || 0;
          } else {
            totalCount = historyStore.getCount();
          }
        }
        
        // Check if any entries found
        if (entries.length === 0) {
          if (options.search) {
            console.log(`No clipboard entries found matching "${options.search}".`);
          } else if (options.type) {
            console.log(`No clipboard entries found with type "${options.type}".`);
          } else if (options.since) {
            console.log(`No clipboard entries found since ${options.since}.`);
          } else {
            console.log('No clipboard entries found.');
          }
          return;
        }
        
        // Interactive mode is default (unless --no-interactive is specified or format is not table)
        if (options.interactive !== false && format === 'table') {
          await this._handleInteractiveSelection(entries, historyStore);
          return;
        }
        
        // Non-interactive mode - format output based on --format option
        if (format === 'json') {
          this._formatJSON(entries);
        } else if (format === 'csv') {
          this._formatCSV(entries);
        } else {
          // Table format (default)
          console.log('\nClipboard History:');
          console.log('─'.repeat(100));
          
          // Display entries in table format with IDs
          this._displayEntriesTable(entries, true);
          
          // Display summary with total count
          console.log('─'.repeat(100));
          console.log(`\nShowing ${entries.length} of ${totalCount} total entries`);
          console.log('\nUse "clipkeeper copy <id>" to copy an entry back to clipboard');
        }
        
      } finally {
        historyStore.close();
      }
      
    } catch (error) {
      // Handle specific error codes
      if (error.code === 'SQLITE_BUSY') {
        console.error(`✗ ${ErrorMessages.DATABASE_LOCKED}`);
        process.exit(1);
      } else if (error.code === 'ENOSPC') {
        console.error(`✗ ${ErrorMessages.LOW_DISK_SPACE}`);
        process.exit(1);
      }
      
      console.error(`✗ Failed to list entries: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Display entries in table format
   * @private
   * @param {Array<Object>} entries - Clipboard entries to display
   * @param {boolean} showIds - Whether to show entry IDs
   */
  _displayEntriesTable(entries, showIds = false) {
    if (showIds) {
      // Column widths with IDs
      const idWidth = 10;
      const timestampWidth = 20;
      const typeWidth = 12;
      const previewWidth = 50;
      
      // Header
      const header = 
        'ID'.padEnd(idWidth) + ' ' +
        'Timestamp'.padEnd(timestampWidth) + ' ' +
        'Type'.padEnd(typeWidth) + ' ' +
        'Preview';
      console.log(header);
      console.log('─'.repeat(100));
      
      // Rows
      for (const entry of entries) {
        // Format ID (show first 8 chars)
        const id = entry.id ? entry.id.substring(0, 8).padEnd(idWidth) : ''.padEnd(idWidth);
        
        // Format timestamp
        const date = new Date(entry.timestamp);
        const timestamp = this._formatTimestamp(date);
        
        // Format type
        const type = entry.contentType.padEnd(typeWidth);
        
        // Format preview (truncate and escape newlines)
        const preview = this._formatPreview(entry.content, previewWidth);
        
        // Print row
        console.log(
          id + ' ' +
          timestamp.padEnd(timestampWidth) + ' ' +
          type + ' ' +
          preview
        );
      }
    } else {
      // Original format without IDs
      const timestampWidth = 20;
      const typeWidth = 12;
      const previewWidth = 60;
      
      // Header
      const header = 
        'Timestamp'.padEnd(timestampWidth) + ' ' +
        'Type'.padEnd(typeWidth) + ' ' +
        'Preview';
      console.log(header);
      console.log('─'.repeat(100));
      
      // Rows
      for (const entry of entries) {
        // Format timestamp
        const date = new Date(entry.timestamp);
        const timestamp = this._formatTimestamp(date);
        
        // Format type
        const type = entry.contentType.padEnd(typeWidth);
        
        // Format preview (truncate and escape newlines)
        const preview = this._formatPreview(entry.content, previewWidth);
        
        // Print row
        console.log(
          timestamp.padEnd(timestampWidth) + ' ' +
          type + ' ' +
          preview
        );
      }
    }
  }

  /**
   * Format timestamp for display
   * @private
   * @param {Date} date - Date to format
   * @returns {string} Formatted timestamp
   */
  _formatTimestamp(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    // Relative time for recent entries
    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }
    
    // Absolute time for older entries
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }

  /**
   * Format content preview for display
   * @private
   * @param {string} content - Content to preview
   * @param {number} maxLength - Maximum length of preview
   * @returns {string} Formatted preview
   */
  _formatPreview(content, maxLength) {
    // Replace newlines and tabs with spaces
    let preview = content.replace(/[\n\r\t]+/g, ' ');
    
    // Trim whitespace
    preview = preview.trim();
    
    // Truncate if too long
    if (preview.length > maxLength) {
      preview = preview.substring(0, maxLength - 3) + '...';
    }
    
    return preview;
  }

  /**
   * Format uptime duration for display
   * @private
   * @param {number} uptimeMs - Uptime in milliseconds
   * @returns {string} Formatted uptime
   */
  _formatUptime(uptimeMs) {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h`;
    } else if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    } else if (minutes > 0) {
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Format entries as JSON
   * @private
   * @param {Array<Object>} entries - Clipboard entries to format
   */
  _formatJSON(entries) {
    console.log(JSON.stringify(entries, null, 2));
  }

  /**
   * Format entries as CSV
   * @private
   * @param {Array<Object>} entries - Clipboard entries to format
   */
  _formatCSV(entries) {
    // CSV header
    console.log('id,timestamp,contentType,content');

    // CSV rows
    for (const entry of entries) {
      const id = entry.id || '';
      const timestamp = entry.timestamp;
      const contentType = entry.contentType;

      // Escape content for CSV (handle quotes and newlines)
      let content = entry.content;
      // Replace double quotes with two double quotes (CSV escaping)
      content = content.replace(/"/g, '""');
      // Replace newlines with spaces for CSV
      content = content.replace(/[\n\r]+/g, ' ');

      // Output row with quoted content field
      console.log(`${id},${timestamp},${contentType},"${content}"`);
    }
  }


  async handleClear(options) {
    try {
      await this.initialize();
      
      // Get data directory and database path
      const dataDir = this.configManager.get('storage.dataDir');
      const dbPath = this.configManager.get('storage.dbPath') || 
                     path.join(dataDir, 'clipboard-history.db');
      
      // Check if database exists
      if (!fs.existsSync(dbPath)) {
        console.log('No clipboard history found. Nothing to clear.');
        return;
      }
      
      // Import HistoryStore dynamically
      const { default: HistoryStore } = await import('./HistoryStore.js');
      const historyStore = new HistoryStore(dbPath);
      
      try {
        // Get current count before clearing
        const entries = historyStore.getRecent(999999); // Get all entries to count
        const totalCount = entries.length;
        
        if (totalCount === 0) {
          console.log('No clipboard history found. Nothing to clear.');
          return;
        }
        
        // Prompt for confirmation unless --confirm flag is set
        if (!options.confirm) {
          const confirmed = await this._promptConfirmation(
            `This will delete all ${totalCount} clipboard entries. This action cannot be undone. Continue? (y/N): `
          );
          
          if (!confirmed) {
            console.log('Clear operation cancelled.');
            return;
          }
        }
        
        // Clear all entries
        const deletedCount = historyStore.clear();
        
        // Display success message
        console.log(`✓ Successfully deleted ${deletedCount} clipboard entries.`);
        
      } finally {
        historyStore.close();
      }
      
    } catch (error) {
      // Handle specific error codes
      if (error.code === 'SQLITE_BUSY') {
        console.error(`✗ ${ErrorMessages.DATABASE_LOCKED}`);
        process.exit(1);
      } else if (error.code === 'ENOSPC') {
        console.error(`✗ ${ErrorMessages.LOW_DISK_SPACE}`);
        process.exit(1);
      }
      
      console.error(`✗ Failed to clear history: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Prompt user for confirmation
   * @private
   * @param {string} question - Question to ask
   * @returns {Promise<boolean>} True if user confirmed, false otherwise
   */
  async _promptConfirmation(question) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        const normalized = answer.trim().toLowerCase();
        resolve(normalized === 'y' || normalized === 'yes');
      });
    });
  }

  /**
   * Handle config set command
   * Requirements: 6.4, 5.1
   */
  async handleConfigSet(key, value) {
    try {
      await this.initialize();

      // Parse value to appropriate type
      let parsedValue = value;
      
      // Convert string booleans to actual booleans
      if (value === 'true') parsedValue = true;
      else if (value === 'false') parsedValue = false;
      // Convert numeric strings to numbers
      else if (!isNaN(value) && value.trim() !== '') {
        parsedValue = Number(value);
      }

      // Set the configuration value
      this.configManager.set(key, parsedValue);
      
      // Validate the configuration
      const validation = await this.configManager.validate();
      if (!validation.valid) {
        console.error(`✗ ${ErrorMessages.INVALID_CONFIG(validation.errors)}`);
        process.exit(1);
      }

      // Save the configuration
      this.configManager.save();

      console.log(`✓ Configuration updated: ${key} = ${parsedValue}`);
      console.log('\nNote: Restart the service for changes to take effect.');
    } catch (error) {
      console.error(`✗ Failed to set configuration: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Handle config show command
   * Requirements: 6.4, 5.7
   */
  async handleConfigShow() {
    try {
      await this.initialize();

      const config = this.configManager.getAll();
      
      console.log('\nclipkeeper Configuration:');
      console.log('═'.repeat(60));
      
      this._displayConfigSection('Embedding', config.embedding);
      this._displayConfigSection('Privacy', config.privacy);
      this._displayConfigSection('Retention', config.retention);
      this._displayConfigSection('Monitoring', config.monitoring);
      this._displayConfigSection('Storage', config.storage);
      this._displayConfigSection('Search', config.search);
      
      console.log('═'.repeat(60));
      console.log(`\nConfiguration file: ${this.configManager.configPath}`);
    } catch (error) {
      console.error(`✗ Failed to show configuration: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Display a configuration section with masked API keys
   * @param {string} title - Section title
   * @param {object} section - Configuration section
   * @private
   */
  _displayConfigSection(title, section) {
    console.log(`\n${title}:`);
    for (const [key, value] of Object.entries(section)) {
      // Mask API keys (show first 4 and last 4 characters)
      let displayValue = value;
      if (key.toLowerCase().includes('key') && typeof value === 'string' && value.length > 12) {
        displayValue = `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
      }
      
      // Format null values
      if (value === null) {
        displayValue = '(not set)';
      }
      
      console.log(`  ${key}: ${displayValue}`);
    }
  }

  /**
   * Handle config get command
   * Requirements: 6.4
   */
  async handleConfigGet(key) {
    try {
      await this.initialize();

      const value = this.configManager.get(key);
      
      if (value === undefined) {
        console.error(`✗ Configuration key not found: ${key}`);
        process.exit(1);
      }

      // Mask API keys
      let displayValue = value;
      if (key.toLowerCase().includes('key') && typeof value === 'string' && value.length > 12) {
        displayValue = `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
      }

      console.log(`${key} = ${displayValue}`);
    } catch (error) {
      console.error(`✗ Failed to get configuration: ${error.message}`);
      process.exit(1);
    }
  }
}

// Create and run CLI only if this file is executed directly (not imported for testing)
// Check if we're in a test environment
const isTestEnvironment = process.argv.some(arg => arg.includes('node:test') || arg.includes('test'));

if (!isTestEnvironment) {
  const cli = new CLI();
  cli.run().catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}

export default CLI;


