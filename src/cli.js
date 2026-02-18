#!/usr/bin/env node

/**
 * ClipKeeper CLI
 * 
 * Command-line interface for ClipKeeper clipboard history manager.
 * Provides commands for service management, search, and configuration.
 */

import { Command } from 'commander';
import { ConfigurationManager } from './ConfigurationManager.js';
import { ServiceManager } from './ServiceManager.js';
import path from 'path';
import fs from 'fs';
import readline from 'readline';

/**
 * CLI class for ClipKeeper
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
      .version('0.1.0')
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
      .addHelpText('after', `
The start command launches ClipKeeper as a background service that continuously
monitors your system clipboard. All clipboard changes will be captured, classified,
and stored locally for easy retrieval.

The service will continue running until you stop it with 'clipkeeper stop'.
      `)
      .action(() => {
        this.handleStart();
      });

    this.program
      .command('stop')
      .description('Stop the background monitoring service')
      .addHelpText('after', `
The stop command gracefully terminates the ClipKeeper background service.
Clipboard monitoring will cease, but all stored history remains intact.
      `)
      .action(() => {
        this.handleStop();
      });

    this.program
      .command('status')
      .description('Check the status of the background service')
      .addHelpText('after', `
The status command reports whether the ClipKeeper service is currently running,
along with uptime information, total entries stored, and last activity timestamp.
      `)
      .action(() => {
        this.handleStatus();
      });
  }

  /**
   * Set up clipboard history commands (search, list, clear)
   */
  setupHistoryCommands() {
    this.program
      .command('search')
      .description('Search clipboard history using natural language')
      .argument('<query>', 'Natural language search query')
      .addHelpText('after', `
The search command uses semantic embeddings to find relevant clipboard entries
based on your natural language query. You can search for concepts, not just
exact text matches.

Examples:
  $ ClipKeeper search "that API key from yesterday"
  $ ClipKeeper search "error message about database"
  $ ClipKeeper search "code snippet for authentication"
      `)
      .action((query) => {
        this.handleSearch(query);
      });

    this.program
      .command('list')
      .description('List recent clipboard entries')
      .option('-l, --limit <number>', 'Maximum number of entries to display', '10')
      .option('-t, --type <type>', 'Filter by content type (text, code, url, image, etc.)')
      .addHelpText('after', `
The list command displays your recent clipboard history in a table format,
showing timestamps, content types, and previews of each entry.

Content types: text, code, url, image, file_path, json, xml, markdown

Examples:
  $ ClipKeeper list
  $ ClipKeeper list --limit 50
  $ ClipKeeper list --type code
  $ ClipKeeper list --type url --limit 20
      `)
      .action((options) => {
        this.handleList(options);
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
  $ ClipKeeper clear
  $ ClipKeeper clear --confirm
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
      .description('Manage ClipKeeper configuration settings')
      .addHelpText('after', `
The config command allows you to view and modify ClipKeeper settings,
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

  async handleStart() {
    try {
      await this.initialize();
      
      console.log('Starting ClipKeeper service...');
      const result = this.serviceManager.start();
      
      if (result.success) {
        console.log(`✓ ${result.message}`);
        console.log('\nThe service is now running in the background.');
        console.log('Use "ClipKeeper stop" to stop the service.');
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
      
      console.log('Stopping ClipKeeper service...');
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
      
      console.log('\nClipKeeper Service Status:');
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

  handleSearch(query) {
    console.log(`Searching for: ${query}`);
    console.log('(Implementation pending)');
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
        if (options.type) {
          entries = historyStore.getRecentByType(limit, options.type);
        } else {
          entries = historyStore.getRecent(limit);
        }
        
        // Check if any entries found
        if (entries.length === 0) {
          if (options.type) {
            console.log(`No clipboard entries found with type "${options.type}".`);
          } else {
            console.log('No clipboard entries found.');
          }
          return;
        }
        
        // Display header
        console.log('\nClipboard History:');
        console.log('─'.repeat(100));
        
        // Display entries in table format
        this._displayEntriesTable(entries);
        
        // Display summary
        console.log('─'.repeat(100));
        if (options.type) {
          console.log(`\nShowing ${entries.length} entries of type "${options.type}"`);
        } else {
          console.log(`\nShowing ${entries.length} most recent entries`);
        }
        
      } finally {
        historyStore.close();
      }
      
    } catch (error) {
      console.error(`✗ Failed to list entries: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Display entries in table format
   * @private
   * @param {Array<Object>} entries - Clipboard entries to display
   */
  _displayEntriesTable(entries) {
    // Column widths
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
        console.error(`✗ Invalid configuration: ${validation.errors.join(', ')}`);
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
      
      console.log('\nClipKeeper Configuration:');
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


