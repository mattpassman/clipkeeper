import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { ServiceManager } from '../src/ServiceManager.js';
import { ConfigurationManager } from '../src/ConfigurationManager.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Reset logger singleton before tests
import { getLogger } from '../src/Logger.js';

describe('ServiceManager', () => {
  let serviceManager;
  let configManager;
  let testDataDir;
  let testConfigPath;

  beforeEach(() => {
    testDataDir = path.join(os.tmpdir(), `clipkeeper-test-${Date.now()}`);
    fs.mkdirSync(testDataDir, { recursive: true });
    
    testConfigPath = path.join(testDataDir, 'config.json');
    const testConfig = {
      storage: {
        dataDir: testDataDir
      }
    };
    fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));
    
    configManager = new ConfigurationManager(testConfigPath);
    serviceManager = new ServiceManager(configManager);
  });

  afterEach(() => {
    try {
      if (serviceManager && serviceManager.isRunning()) {
        serviceManager.stop();
      }
    } catch (error) {
      // Ignore stop errors
    }
    
    if (testDataDir && fs.existsSync(testDataDir)) {
      try {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  it('should create ServiceManager instance', () => {
    assert.ok(serviceManager);
    assert.ok(serviceManager.pidFilePath);
  });

  it('should write and read PID file', () => {
    const testPid = 12345;
    serviceManager.writePid(testPid);
    
    assert.ok(fs.existsSync(serviceManager.pidFilePath));
    const readPid = serviceManager.getPid();
    assert.strictEqual(readPid, testPid);
  });

  it('should detect running process', () => {
    const isRunning = serviceManager.isProcessRunning(process.pid);
    assert.strictEqual(isRunning, true);
  });

  it('should detect non-existent process', () => {
    const isRunning = serviceManager.isProcessRunning(999999);
    assert.strictEqual(isRunning, false);
  });

  it('should report not running when no PID file exists', () => {
    const isRunning = serviceManager.isRunning();
    assert.strictEqual(isRunning, false);
  });

  it('should get status correctly', () => {
    const status = serviceManager.getStatus();
    assert.strictEqual(status.running, false);
    assert.strictEqual(status.pid, null);
    assert.ok(status.pidFile);
  });

  it('should prevent starting when already running', () => {
    // Write current process PID to simulate a running service
    serviceManager.writePid(process.pid);
    
    // Verify the PID file was written correctly
    assert.ok(fs.existsSync(serviceManager.pidFilePath));
    assert.strictEqual(serviceManager.getPid(), process.pid);
    
    // Verify isRunning() returns true
    assert.strictEqual(serviceManager.isRunning(), true);
    
    // Try to start - should fail because service is "already running"
    const result = serviceManager.start();
    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('already running'));
    
    // Clean up the PID file we created
    serviceManager.removePidFile();
  });

  it('should handle stop when not running', () => {
    const result = serviceManager.stop();
    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('not running'));
  });
});

