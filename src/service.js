#!/usr/bin/env node

/**
 * clipkeeper Background Service
 * 
 * This script runs as a detached background process to monitor clipboard changes.
 * It handles graceful shutdown on SIGTERM and SIGINT signals.
 * 
 * Requirements: 12.1, 12.2
 */

import { Application } from './Application.js';
import { getLogger } from './Logger.js';

const logger = getLogger();

/**
 * Main service function
 */
async function main() {
  logger.info('Service', 'clipkeeper background service starting', {
    pid: process.pid,
    nodeVersion: process.version,
    platform: process.platform,
    monitoring: process.env.CLIPKEEPER_MONITOR === 'true'
  });

  // Create and initialize application
  const app = new Application();
  let resourceMonitor = null;

  try {
    await app.initialize();
    app.start();

    logger.info('Service', 'Background service initialized and started', {
      pid: process.pid
    });

    // Start resource monitoring if enabled
    if (process.env.CLIPKEEPER_MONITOR === 'true') {
      const ResourceMonitor = (await import('./ResourceMonitor.js')).default;
      const { ConfigurationManager } = await import('./ConfigurationManager.js');
      const path = await import('path');
      
      const configManager = new ConfigurationManager();
      const dataDir = configManager.get('storage.dataDir');
      const metricsPath = path.join(dataDir, 'metrics.log');
      
      resourceMonitor = new ResourceMonitor(metricsPath, 60000); // Log every minute
      resourceMonitor.setHistoryStore(app.historyStore);
      resourceMonitor.start();
      
      logger.info('Service', 'Resource monitoring enabled', {
        metricsPath,
        interval: '60s'
      });
    }

  } catch (error) {
    logger.error('Service', 'Failed to initialize service', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    });
    process.exit(1);
  }

  // Set up graceful shutdown handlers
  const shutdown = async (signal) => {
    logger.info('Service', `Received ${signal}, shutting down gracefully`, {
      pid: process.pid
    });

    try {
      // Stop resource monitoring if running
      if (resourceMonitor) {
        resourceMonitor.stop();
        logger.info('Service', 'Resource monitoring stopped');
      }
      
      app.stop();
      logger.info('Service', 'Service stopped successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Service', 'Error during shutdown', {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      });
      process.exit(1);
    }
  };

  // Handle SIGTERM (graceful shutdown)
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Service', 'Uncaught exception', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    });
    
    // Try to shut down gracefully
    try {
      app.stop();
    } catch (shutdownError) {
      logger.error('Service', 'Error during emergency shutdown', {
        error: {
          name: shutdownError.name,
          message: shutdownError.message
        }
      });
    }
    
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Service', 'Unhandled promise rejection', {
      reason: reason instanceof Error ? {
        name: reason.name,
        message: reason.message,
        stack: reason.stack
      } : reason,
      promise: promise.toString()
    });
  });

  // Keep the process alive
  logger.info('Service', 'Service is now running in background', {
    pid: process.pid
  });
}

// Start the service
main().catch((error) => {
  logger.error('Service', 'Fatal error in main', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    }
  });
  process.exit(1);
});


