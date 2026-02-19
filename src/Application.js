import path from 'path';
import os from 'os';
import { ConfigurationManager } from './ConfigurationManager.js';
import HistoryStore from './HistoryStore.js';
import ClipboardMonitor from './ClipboardMonitor.js';
import { PrivacyFilter } from './PrivacyFilter.js';
import { ContentClassifier } from './ContentClassifier.js';
import { getLogger } from './Logger.js';
import RetentionService from './RetentionService.js';
import SearchService from './SearchService.js';
import ClipboardService from './ClipboardService.js';

/**
 * Application class - Main orchestrator for clipkeeper
 * Wires together all components and manages the application lifecycle
 * 
 * Requirements: 11.2
 */
export class Application {
  constructor(configPath = null) {
    this.configPath = configPath;
    this.logger = getLogger();
    
    // Components
    this.configManager = null;
    this.historyStore = null;
    this.clipboardMonitor = null;
    this.privacyFilter = null;
    this.contentClassifier = null;
    this.retentionService = null;
    this.searchService = null;
    this.clipboardService = null;
    
    // State
    this.isRunning = false;
  }

  /**
   * Initialize all application components
   * Sets up ConfigurationManager, HistoryStore, ClipboardMonitor, 
   * PrivacyFilter, and ContentClassifier with platform-appropriate paths
   */
  async initialize() {
    try {
      // Initialize ConfigurationManager
      this.logger.info('Application', 'Initializing ConfigurationManager');
      this.configManager = new ConfigurationManager(this.configPath);
      
      // Validate configuration
      const validation = await this.configManager.validate();
      if (!validation.valid) {
        this.logger.warn('Application', 'Configuration validation warnings', {
          errors: validation.errors
        });
      }
      
      // Get platform-appropriate data directory
      const dataDir = this.configManager.get('storage.dataDir');
      this.logger.info('Application', 'Using data directory', { dataDir });
      
      // Initialize HistoryStore with platform-appropriate path
      const dbPath = this.configManager.get('storage.dbPath') || 
                     path.join(dataDir, 'clipboard-history.db');
      this.logger.info('Application', 'Initializing HistoryStore', { dbPath });
      this.historyStore = new HistoryStore(dbPath);
      
      // Initialize PrivacyFilter
      this.logger.info('Application', 'Initializing PrivacyFilter');
      const privacyConfig = {
        enabled: this.configManager.get('privacy.enabled'),
        patterns: this.configManager.get('privacy.patterns'),
        logger: this.logger
      };
      this.privacyFilter = new PrivacyFilter(privacyConfig);
      
      // Initialize ContentClassifier
      this.logger.info('Application', 'Initializing ContentClassifier');
      this.contentClassifier = new ContentClassifier();
      
      // Initialize ClipboardMonitor
      const pollInterval = this.configManager.get('monitoring.pollInterval');
      this.logger.info('Application', 'Initializing ClipboardMonitor', { pollInterval });
      this.clipboardMonitor = new ClipboardMonitor(pollInterval, this.logger);
      
      // Set up clipboard change event handler
      this.clipboardMonitor.on('change', this._handleClipboardChange.bind(this));
      
      // Set up error event handler
      this.clipboardMonitor.on('error', this._handleClipboardError.bind(this));
      
      // Initialize RetentionService
      this.logger.info('Application', 'Initializing RetentionService');
      this.retentionService = new RetentionService(this.historyStore, this.configManager);
      
      // Initialize SearchService
      this.logger.info('Application', 'Initializing SearchService');
      this.searchService = new SearchService(this.historyStore);
      
      // Initialize ClipboardService
      this.logger.info('Application', 'Initializing ClipboardService');
      this.clipboardService = new ClipboardService();
      
      this.logger.info('Application', 'Initialization complete');
      
    } catch (error) {
      this.logger.error('Application', 'Initialization failed', {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      });
      throw error;
    }
  }

  /**
   * Start the application
   * Begins clipboard monitoring and retention cleanup
   */
  start() {
    if (this.isRunning) {
      this.logger.warn('Application', 'Application is already running');
      return;
    }
    
    if (!this.clipboardMonitor) {
      throw new Error('Application not initialized. Call initialize() first.');
    }
    
    this.logger.info('Application', 'Starting application');
    this.clipboardMonitor.start();
    
    // Start retention service
    if (this.retentionService) {
      this.logger.info('Application', 'Starting RetentionService');
      this.retentionService.start();
    }
    
    this.isRunning = true;
    this.logger.info('Application', 'Application started successfully');
  }

  /**
   * Stop the application
   * Stops clipboard monitoring, retention cleanup, and closes database connections
   */
  stop() {
    if (!this.isRunning) {
      this.logger.warn('Application', 'Application is not running');
      return;
    }
    
    this.logger.info('Application', 'Stopping application');
    
    // Stop retention service
    if (this.retentionService) {
      this.logger.info('Application', 'Stopping RetentionService');
      this.retentionService.stop();
    }
    
    // Stop clipboard monitoring
    if (this.clipboardMonitor) {
      this.clipboardMonitor.stop();
    }
    
    // Close database connection
    if (this.historyStore && this.historyStore.isOpen()) {
      this.historyStore.close();
    }
    
    this.isRunning = false;
    this.logger.info('Application', 'Application stopped successfully');
  }

  /**
   * Handle clipboard change events
   * Filters through PrivacyFilter, classifies with ContentClassifier,
   * and stores in HistoryStore
   * 
   * @param {Object} clipboardContent - Clipboard content from monitor
   * @private
   */
  _handleClipboardChange(clipboardContent) {
    try {
      const content = clipboardContent.text;
      const timestamp = clipboardContent.timestamp;
      
      this.logger.debug('Application', 'Clipboard change detected', {
        contentLength: content.length,
        timestamp
      });
      
      // Filter through PrivacyFilter
      const filterResult = this.privacyFilter.shouldFilter(content);
      if (filterResult.filtered) {
        this.logger.info('Application', 'Content filtered by PrivacyFilter', {
          reason: filterResult.reason,
          pattern: filterResult.matchedPattern
        });
        return; // Don't store sensitive content
      }
      
      // Classify content type
      const classification = this.contentClassifier.classify(content);
      this.logger.debug('Application', 'Content classified', {
        type: classification.type,
        language: classification.language,
        confidence: classification.confidence
      });
      
      // Prepare entry for storage
      const entry = {
        content: content,
        contentType: classification.type,
        timestamp: timestamp,
        sourceApp: null, // TODO: Implement source app detection
        metadata: {
          language: classification.language,
          confidence: classification.confidence,
          characterCount: content.length,
          wordCount: content.split(/\s+/).filter(w => w.length > 0).length
        }
      };
      
      // Store in HistoryStore
      const entryId = this.historyStore.save(entry);
      this.logger.info('Application', 'Clipboard entry stored', {
        entryId,
        contentType: classification.type,
        contentLength: content.length
      });
      
      // TODO: Generate embedding asynchronously (when EmbeddingService is implemented)
      // TODO: Store embedding in VectorStore (when VectorStore is implemented)
      
    } catch (error) {
      this.logger.error('Application', 'Failed to handle clipboard change', {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      });
    }
  }

  /**
   * Handle clipboard monitor errors
   * @param {Object} errorEvent - Error event from monitor
   * @private
   */
  _handleClipboardError(errorEvent) {
    this.logger.error('Application', 'Clipboard monitor error', {
      message: errorEvent.message,
      error: errorEvent.error,
      timestamp: errorEvent.timestamp
    });
  }

  /**
   * Get application status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      running: this.isRunning,
      components: {
        configManager: this.configManager !== null,
        historyStore: this.historyStore !== null && this.historyStore.isOpen(),
        clipboardMonitor: this.clipboardMonitor !== null,
        privacyFilter: this.privacyFilter !== null,
        contentClassifier: this.contentClassifier !== null,
        retentionService: this.retentionService !== null,
        searchService: this.searchService !== null,
        clipboardService: this.clipboardService !== null
      },
      config: {
        dataDir: this.configManager?.get('storage.dataDir'),
        pollInterval: this.configManager?.get('monitoring.pollInterval'),
        privacyEnabled: this.configManager?.get('privacy.enabled')
      }
    };
  }
}


