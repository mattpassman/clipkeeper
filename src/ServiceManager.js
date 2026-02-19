import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';
import { getLogger } from './Logger.js';

/**
 * ServiceManager - Manages background service lifecycle
 * 
 * Handles:
 * - Forking and detaching background process
 * - PID file management
 * - Graceful shutdown on SIGTERM
 * - Service status checking
 * 
 * Requirements: 12.1, 12.2
 */
export class ServiceManager {
  constructor(configManager) {
    this.configManager = configManager;
    this.logger = getLogger();
    
    // Get PID file path from config or use default
    const dataDir = this.configManager.get('storage.dataDir');
    this.pidFilePath = path.join(dataDir, 'clipkeeper.pid');
  }

  /**
   * Start the background service
   * Forks the process and detaches it
   * 
   * @param {Object} options - Start options
   * @param {boolean} options.monitor - Enable resource monitoring
   * @returns {Object} Result with success status and message
   */
  start(options = {}) {
    try {
      // Check if service is already running
      if (this.isRunning()) {
        const pid = this.getPid();
        return {
          success: false,
          message: `Service is already running (PID: ${pid})`
        };
      }

      // Get the path to the service script
      // Handle Windows file URLs properly
      let modulePath = new URL(import.meta.url).pathname;
      // On Windows, pathname starts with /C:/ which needs to be converted to C:/
      if (process.platform === 'win32' && modulePath.startsWith('/')) {
        modulePath = modulePath.substring(1);
      }
      const serviceScript = path.join(path.dirname(modulePath), 'service.js');
      
      // Prepare environment variables
      const env = { ...process.env };
      if (options.monitor) {
        env.CLIPKEEPER_MONITOR = 'true';
      }
      
      // Fork the process and detach
      const child = spawn(process.execPath, [serviceScript], {
        detached: true,
        stdio: 'ignore',
        env
      });

      // Unref the child so parent can exit
      child.unref();

      // Write PID to file
      this.writePid(child.pid);

      this.logger.info('ServiceManager', 'Service started', { 
        pid: child.pid,
        monitor: options.monitor || false
      });

      const message = options.monitor 
        ? `Service started with monitoring enabled (PID: ${child.pid})`
        : `Service started successfully (PID: ${child.pid})`;

      return {
        success: true,
        message,
        pid: child.pid
      };

    } catch (error) {
      this.logger.error('ServiceManager', 'Failed to start service', {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      });

      return {
        success: false,
        message: `Failed to start service: ${error.message}`
      };
    }
  }

  /**
   * Stop the background service
   * Sends SIGTERM for graceful shutdown
   * 
   * @returns {Object} Result with success status and message
   */
  stop() {
    try {
      // Check if service is running
      if (!this.isRunning()) {
        // Clean up stale PID file if it exists
        if (fs.existsSync(this.pidFilePath)) {
          fs.unlinkSync(this.pidFilePath);
        }
        return {
          success: false,
          message: 'Service is not running'
        };
      }

      const pid = this.getPid();

      // Send SIGTERM for graceful shutdown
      try {
        process.kill(pid, 'SIGTERM');
      } catch (error) {
        // Process might have already exited
        if (error.code === 'ESRCH') {
          this.removePidFile();
          return {
            success: false,
            message: 'Service was not running (stale PID file removed)'
          };
        }
        throw error;
      }

      // Wait for process to exit (max 5 seconds)
      const maxWaitTime = 5000;
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime) {
        if (!this.isProcessRunning(pid)) {
          this.removePidFile();
          this.logger.info('ServiceManager', 'Service stopped', { pid });
          return {
            success: true,
            message: `Service stopped successfully (PID: ${pid})`
          };
        }
        // Sleep for 100ms
        this.sleep(100);
      }

      // If still running after timeout, force kill
      try {
        process.kill(pid, 'SIGKILL');
        this.removePidFile();
        this.logger.warn('ServiceManager', 'Service force killed after timeout', { pid });
        return {
          success: true,
          message: `Service force killed after timeout (PID: ${pid})`
        };
      } catch (error) {
        this.removePidFile();
        return {
          success: true,
          message: 'Service stopped (process no longer exists)'
        };
      }

    } catch (error) {
      this.logger.error('ServiceManager', 'Failed to stop service', {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      });

      return {
        success: false,
        message: `Failed to stop service: ${error.message}`
      };
    }
  }

  /**
   * Get service status
   * 
   * @returns {Object} Status information
   */
  getStatus() {
    const running = this.isRunning();
    const pid = running ? this.getPid() : null;

    return {
      running,
      pid,
      pidFile: this.pidFilePath
    };
  }

  /**
   * Check if service is running
   * 
   * @returns {boolean} True if service is running
   */
  isRunning() {
    if (!fs.existsSync(this.pidFilePath)) {
      return false;
    }

    const pid = this.getPid();
    if (!pid) {
      return false;
    }

    return this.isProcessRunning(pid);
  }

  /**
   * Check if a process is running
   * 
   * @param {number} pid - Process ID
   * @returns {boolean} True if process is running
   */
  isProcessRunning(pid) {
    try {
      // Sending signal 0 checks if process exists without killing it
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get PID from PID file
   * 
   * @returns {number|null} PID or null if not found
   */
  getPid() {
    try {
      if (!fs.existsSync(this.pidFilePath)) {
        return null;
      }

      const pidContent = fs.readFileSync(this.pidFilePath, 'utf8').trim();
      const pid = parseInt(pidContent, 10);

      if (isNaN(pid)) {
        this.logger.warn('ServiceManager', 'Invalid PID in file', { pidContent });
        return null;
      }

      return pid;
    } catch (error) {
      this.logger.error('ServiceManager', 'Failed to read PID file', {
        error: {
          name: error.name,
          message: error.message
        }
      });
      return null;
    }
  }

  /**
   * Write PID to file
   * 
   * @param {number} pid - Process ID
   */
  writePid(pid) {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.pidFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.pidFilePath, pid.toString(), 'utf8');
      this.logger.debug('ServiceManager', 'PID written to file', { pid, path: this.pidFilePath });
    } catch (error) {
      this.logger.error('ServiceManager', 'Failed to write PID file', {
        error: {
          name: error.name,
          message: error.message
        }
      });
      throw error;
    }
  }

  /**
   * Remove PID file
   */
  removePidFile() {
    try {
      if (fs.existsSync(this.pidFilePath)) {
        fs.unlinkSync(this.pidFilePath);
        this.logger.debug('ServiceManager', 'PID file removed', { path: this.pidFilePath });
      }
    } catch (error) {
      this.logger.error('ServiceManager', 'Failed to remove PID file', {
        error: {
          name: error.name,
          message: error.message
        }
      });
    }
  }

  /**
   * Sleep for specified milliseconds
   * 
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    const start = Date.now();
    while (Date.now() - start < ms) {
      // Busy wait
    }
  }
}

