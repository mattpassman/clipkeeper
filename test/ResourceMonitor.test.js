import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import ResourceMonitor from '../src/ResourceMonitor.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('ResourceMonitor', () => {
  let tempDir;
  let metricsPath;

  before(() => {
    // Create temp directory for test metrics
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipkeeper-test-'));
    metricsPath = path.join(tempDir, 'metrics.log');
  });

  after(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Constructor', () => {
    it('should create ResourceMonitor with default interval', () => {
      const monitor = new ResourceMonitor(metricsPath);
      assert.strictEqual(monitor.metricsPath, metricsPath);
      assert.strictEqual(monitor.interval, 60000);
      assert.strictEqual(monitor.isRunning, false);
    });

    it('should create ResourceMonitor with custom interval', () => {
      const monitor = new ResourceMonitor(metricsPath, 5000);
      assert.strictEqual(monitor.interval, 5000);
    });

    it('should create metrics directory if it does not exist', () => {
      const nestedPath = path.join(tempDir, 'nested', 'dir', 'metrics.log');
      const monitor = new ResourceMonitor(nestedPath);
      assert.ok(fs.existsSync(path.dirname(nestedPath)));
    });
  });

  describe('start() and stop()', () => {
    it('should start and stop monitoring', (t, done) => {
      const monitor = new ResourceMonitor(metricsPath, 100);
      
      monitor.start();
      assert.strictEqual(monitor.isRunning, true);
      assert.ok(monitor.intervalId !== null);
      
      // Wait a bit for metrics to be collected
      setTimeout(() => {
        monitor.stop();
        assert.strictEqual(monitor.isRunning, false);
        assert.strictEqual(monitor.intervalId, null);
        done();
      }, 250);
    });

    it('should not start multiple times', () => {
      const monitor = new ResourceMonitor(metricsPath);
      
      monitor.start();
      const firstIntervalId = monitor.intervalId;
      
      monitor.start();
      assert.strictEqual(monitor.intervalId, firstIntervalId);
      
      monitor.stop();
    });

    it('should handle stop when not running', () => {
      const monitor = new ResourceMonitor(metricsPath);
      
      // Should not throw
      monitor.stop();
      assert.strictEqual(monitor.isRunning, false);
    });
  });

  describe('_collectMetrics()', () => {
    it('should collect current metrics', () => {
      const monitor = new ResourceMonitor(metricsPath);
      const metrics = monitor._collectMetrics();
      
      assert.ok(metrics.timestamp);
      assert.ok(metrics.datetime);
      assert.ok(metrics.uptime >= 0);
      
      // Memory metrics
      assert.ok(metrics.memory.rss > 0);
      assert.ok(metrics.memory.heapTotal > 0);
      assert.ok(metrics.memory.heapUsed > 0);
      
      // CPU metrics
      assert.ok(typeof metrics.cpu.user === 'number');
      assert.ok(typeof metrics.cpu.system === 'number');
      
      // System metrics
      assert.ok(metrics.system.platform);
      assert.ok(metrics.system.arch);
      assert.ok(metrics.system.totalMemory > 0);
    });
  });

  describe('_logMetrics()', () => {
    it('should log metrics to file', () => {
      const monitor = new ResourceMonitor(metricsPath);
      const metrics = monitor._collectMetrics();
      
      monitor._logMetrics(metrics);
      
      assert.ok(fs.existsSync(metricsPath));
      const content = fs.readFileSync(metricsPath, 'utf8');
      assert.ok(content.length > 0);
      
      // Should be valid JSON (parse first line only)
      const firstLine = content.trim().split('\n')[0];
      const parsed = JSON.parse(firstLine);
      assert.ok(parsed.timestamp);
    });
  });

  describe('readMetrics()', () => {
    it('should read metrics from file', () => {
      const monitor = new ResourceMonitor(metricsPath);
      
      // Clear file first
      if (fs.existsSync(metricsPath)) {
        fs.unlinkSync(metricsPath);
      }
      
      // Log some metrics
      for (let i = 0; i < 5; i++) {
        const metrics = monitor._collectMetrics();
        monitor._logMetrics(metrics);
      }
      
      const metrics = ResourceMonitor.readMetrics(metricsPath);
      assert.strictEqual(metrics.length, 5);
      assert.ok(metrics[0].timestamp);
    });

    it('should respect limit parameter', () => {
      const monitor = new ResourceMonitor(metricsPath);
      
      // Clear file first
      if (fs.existsSync(metricsPath)) {
        fs.unlinkSync(metricsPath);
      }
      
      // Log 10 metrics
      for (let i = 0; i < 10; i++) {
        const metrics = monitor._collectMetrics();
        monitor._logMetrics(metrics);
      }
      
      const metrics = ResourceMonitor.readMetrics(metricsPath, 5);
      assert.strictEqual(metrics.length, 5);
    });

    it('should return empty array if file does not exist', () => {
      const nonExistentPath = path.join(tempDir, 'nonexistent.log');
      const metrics = ResourceMonitor.readMetrics(nonExistentPath);
      assert.strictEqual(metrics.length, 0);
    });
  });

  describe('getSummary()', () => {
    it('should generate summary statistics', () => {
      const monitor = new ResourceMonitor(metricsPath);
      
      // Clear file first
      if (fs.existsSync(metricsPath)) {
        fs.unlinkSync(metricsPath);
      }
      
      // Log some metrics
      for (let i = 0; i < 5; i++) {
        const metrics = monitor._collectMetrics();
        monitor._logMetrics(metrics);
      }
      
      const metrics = ResourceMonitor.readMetrics(metricsPath);
      const summary = ResourceMonitor.getSummary(metrics);
      
      assert.ok(summary.period);
      assert.strictEqual(summary.period.samples, 5);
      assert.ok(summary.memory.rss.current > 0);
      assert.ok(summary.memory.rss.min > 0);
      assert.ok(summary.memory.rss.max > 0);
      assert.ok(summary.memory.rss.avg > 0);
    });

    it('should return null for empty metrics', () => {
      const summary = ResourceMonitor.getSummary([]);
      assert.strictEqual(summary, null);
    });
  });

  describe('clearMetrics()', () => {
    it('should clear metrics file', () => {
      const monitor = new ResourceMonitor(metricsPath);
      
      // Log some metrics
      const metrics = monitor._collectMetrics();
      monitor._logMetrics(metrics);
      
      assert.ok(fs.existsSync(metricsPath));
      
      ResourceMonitor.clearMetrics(metricsPath);
      assert.ok(!fs.existsSync(metricsPath));
    });

    it('should handle non-existent file', () => {
      const nonExistentPath = path.join(tempDir, 'nonexistent.log');
      
      // Should not throw
      ResourceMonitor.clearMetrics(nonExistentPath);
    });
  });
});
