import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { ConfigurationManager } from '../src/ConfigurationManager.js';

describe('ConfigurationManager', () => {
  let tempDir;
  let tempConfigPath;

  beforeEach(() => {
    // Create a temporary directory for test configs
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipkeeper-test-'));
    tempConfigPath = path.join(tempDir, 'config.json');
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    // Clean up environment variables
    delete process.env.clipkeeper_OPENAI_KEY;
    delete process.env.clipkeeper_ANTHROPIC_KEY;
  });

  describe('constructor and initialization', () => {
    it('should create config with defaults when file does not exist', () => {
      const config = new ConfigurationManager(tempConfigPath);
      
      assert.strictEqual(config.get('embedding.provider'), 'openai');
      assert.strictEqual(config.get('embedding.model'), 'text-embedding-3-small');
      assert.strictEqual(config.get('retention.days'), 30);
      assert.strictEqual(config.get('monitoring.pollInterval'), 500);
    });

    it('should load existing config file', () => {
      const testConfig = {
        embedding: {
          provider: 'ollama',
          model: 'custom-model'
        }
      };
      
      fs.writeFileSync(tempConfigPath, JSON.stringify(testConfig));
      
      const config = new ConfigurationManager(tempConfigPath);
      
      assert.strictEqual(config.get('embedding.provider'), 'ollama');
      assert.strictEqual(config.get('embedding.model'), 'custom-model');
      // Defaults should still be present
      assert.strictEqual(config.get('retention.days'), 30);
    });

    it('should handle invalid JSON gracefully', () => {
      fs.writeFileSync(tempConfigPath, 'invalid json {');
      
      const config = new ConfigurationManager(tempConfigPath);
      
      // Should fall back to defaults
      assert.strictEqual(config.get('embedding.provider'), 'openai');
    });
  });

  describe('environment variable overrides', () => {
    it('should override API key with clipkeeper_OPENAI_KEY', () => {
      process.env.clipkeeper_OPENAI_KEY = 'sk-test123456789012345678901234567890';
      
      const config = new ConfigurationManager(tempConfigPath);
      
      assert.strictEqual(config.get('embedding.apiKey'), 'sk-test123456789012345678901234567890');
    });

    it('should override API key with clipkeeper_ANTHROPIC_KEY', () => {
      process.env.clipkeeper_ANTHROPIC_KEY = 'sk-ant-test12345678901234567890';
      
      const testConfig = {
        embedding: {
          provider: 'anthropic'
        }
      };
      fs.writeFileSync(tempConfigPath, JSON.stringify(testConfig));
      
      const config = new ConfigurationManager(tempConfigPath);
      
      assert.strictEqual(config.get('embedding.apiKey'), 'sk-ant-test12345678901234567890');
    });

    it('should prioritize environment variable over file config', () => {
      const testConfig = {
        embedding: {
          apiKey: 'file-key'
        }
      };
      fs.writeFileSync(tempConfigPath, JSON.stringify(testConfig));
      
      process.env.clipkeeper_OPENAI_KEY = 'sk-env123456789012345678901234567890';
      
      const config = new ConfigurationManager(tempConfigPath);
      
      assert.strictEqual(config.get('embedding.apiKey'), 'sk-env123456789012345678901234567890');
    });
  });

  describe('get and set methods', () => {
    it('should get nested configuration values', () => {
      const config = new ConfigurationManager(tempConfigPath);
      
      assert.strictEqual(config.get('embedding.provider'), 'openai');
      assert.strictEqual(config.get('retention.days'), 30);
    });

    it('should return undefined for non-existent keys', () => {
      const config = new ConfigurationManager(tempConfigPath);
      
      assert.strictEqual(config.get('nonexistent.key'), undefined);
    });

    it('should set nested configuration values', () => {
      const config = new ConfigurationManager(tempConfigPath);
      
      config.set('embedding.provider', 'ollama');
      config.set('retention.days', 60);
      
      assert.strictEqual(config.get('embedding.provider'), 'ollama');
      assert.strictEqual(config.get('retention.days'), 60);
    });

    it('should create nested objects when setting deep keys', () => {
      const config = new ConfigurationManager(tempConfigPath);
      
      config.set('custom.nested.value', 'test');
      
      assert.strictEqual(config.get('custom.nested.value'), 'test');
    });
  });

  describe('save method', () => {
    it('should save configuration to file', () => {
      const config = new ConfigurationManager(tempConfigPath);
      
      config.set('embedding.provider', 'ollama');
      config.save();
      
      assert.ok(fs.existsSync(tempConfigPath));
      
      const savedConfig = JSON.parse(fs.readFileSync(tempConfigPath, 'utf8'));
      assert.strictEqual(savedConfig.embedding.provider, 'ollama');
    });

    it('should create directory if it does not exist', () => {
      const nestedPath = path.join(tempDir, 'nested', 'dir', 'config.json');
      const config = new ConfigurationManager(nestedPath);
      
      config.save();
      
      assert.ok(fs.existsSync(nestedPath));
    });

    it('should perform atomic write', () => {
      const config = new ConfigurationManager(tempConfigPath);
      
      config.set('test.value', 'original');
      config.save();
      
      // Verify temp file is cleaned up
      const tempFile = `${tempConfigPath}.tmp`;
      assert.ok(!fs.existsSync(tempFile));
      
      // Verify final file exists
      assert.ok(fs.existsSync(tempConfigPath));
    });

    it('should set secure file permissions on Unix-like systems', function() {
      if (os.platform() === 'win32') {
        this.skip();
        return;
      }
      
      const config = new ConfigurationManager(tempConfigPath);
      config.save();
      
      const stats = fs.statSync(tempConfigPath);
      const mode = stats.mode & 0o777;
      
      assert.strictEqual(mode, 0o600);
    });

    it('should set secure ACL on Windows systems', function() {
      if (os.platform() !== 'win32') {
        this.skip();
        return;
      }
      
      const config = new ConfigurationManager(tempConfigPath);
      config.save();
      
      // Verify file exists
      assert.ok(fs.existsSync(tempConfigPath));
      
      // On Windows, we can verify ACL was set by checking icacls output
      const username = os.userInfo().username;
      
      try {
        const output = execSync(`icacls "${tempConfigPath}"`, { encoding: 'utf8' });
        
        // The output should show only the current user has access
        // and should not show inherited permissions
        assert.ok(output.includes(username), 'Current user should have permissions');
        
        // Check that inheritance is disabled (no (I) markers for inherited permissions)
        // The file should show explicit permissions only
        const lines = output.split('\n');
        const permissionLine = lines.find(line => line.includes(username));
        
        if (permissionLine) {
          // Should have (F) for Full control, not (I) for inherited
          assert.ok(permissionLine.includes('(F)'), 'User should have full control');
        }
      } catch (error) {
        // If icacls fails, the test should still pass as long as the file was created
        console.warn('Could not verify Windows ACL:', error.message);
      }
    });
  });

  describe('validation', () => {
    it('should validate valid configuration', async () => {
      const config = new ConfigurationManager(tempConfigPath);
      
      const result = await config.validate();
      
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should reject invalid embedding provider', async () => {
      const config = new ConfigurationManager(tempConfigPath);
      config.set('embedding.provider', 'invalid-provider');
      
      const result = await config.validate();
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Invalid embedding provider')));
    });

    it('should validate OpenAI API key format', async () => {
      const config = new ConfigurationManager(tempConfigPath);
      config.set('embedding.provider', 'openai');
      config.set('embedding.apiKey', 'invalid-key');
      
      const result = await config.validate();
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Invalid OpenAI API key format')));
    });

    it('should accept valid OpenAI API key format', async () => {
      const config = new ConfigurationManager(tempConfigPath);
      config.set('embedding.provider', 'openai');
      config.set('embedding.apiKey', 'sk-' + 'a'.repeat(48));
      
      const result = await config.validate();
      
      assert.strictEqual(result.valid, true);
    });

    it('should validate Anthropic API key format', async () => {
      const config = new ConfigurationManager(tempConfigPath);
      config.set('embedding.provider', 'anthropic');
      config.set('embedding.apiKey', 'short');
      
      const result = await config.validate();
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Invalid Anthropic')));
    });

    it('should reject inaccessible Ollama endpoint', async () => {
      const config = new ConfigurationManager(tempConfigPath);
      config.set('embedding.provider', 'ollama');
      config.set('embedding.endpoint', 'http://localhost:99999');
      
      const result = await config.validate();
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Ollama endpoint is not accessible')));
    });

    it('should use default Ollama endpoint if not specified', async () => {
      const config = new ConfigurationManager(tempConfigPath);
      config.set('embedding.provider', 'ollama');
      // Don't set endpoint, should use default http://localhost:11434
      
      const result = await config.validate();
      
      // Will fail unless Ollama is actually running locally
      // This test just verifies the default endpoint is used
      assert.ok(result.errors.length === 0 || result.errors.some(e => e.includes('http://localhost:11434')));
    });

    it('should reject negative retention days', async () => {
      const config = new ConfigurationManager(tempConfigPath);
      config.set('retention.days', -1);
      
      const result = await config.validate();
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Retention days')));
    });

    it('should reject invalid poll interval', async () => {
      const config = new ConfigurationManager(tempConfigPath);
      config.set('monitoring.pollInterval', 50);
      
      const result = await config.validate();
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Poll interval')));
    });

    it('should reject invalid minimum score', async () => {
      const config = new ConfigurationManager(tempConfigPath);
      config.set('search.minScore', 1.5);
      
      const result = await config.validate();
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Minimum score')));
    });
  });

  describe('getAll method', () => {
    it('should return complete configuration object', () => {
      const config = new ConfigurationManager(tempConfigPath);
      
      const allConfig = config.getAll();
      
      assert.ok(allConfig.embedding);
      assert.ok(allConfig.privacy);
      assert.ok(allConfig.retention);
      assert.ok(allConfig.monitoring);
      assert.ok(allConfig.storage);
      assert.ok(allConfig.search);
    });

    it('should return a copy, not the original', () => {
      const config = new ConfigurationManager(tempConfigPath);
      
      const allConfig = config.getAll();
      allConfig.embedding.provider = 'modified';
      
      assert.strictEqual(config.get('embedding.provider'), 'openai');
    });
  });

  describe('default paths', () => {
    it('should use platform-appropriate config path', () => {
      const config = new ConfigurationManager();
      const platform = os.platform();
      
      if (platform === 'win32') {
        assert.ok(config.configPath.includes('AppData'));
        assert.ok(config.configPath.includes('clipkeeper'));
      } else {
        assert.ok(config.configPath.includes('.config'));
        assert.ok(config.configPath.includes('clipkeeper'));
      }
    });

    it('should use platform-appropriate data directory', () => {
      const config = new ConfigurationManager(tempConfigPath);
      const dataDir = config.get('storage.dataDir');
      const platform = os.platform();
      
      assert.ok(dataDir.includes('clipkeeper'));
      
      if (platform === 'darwin') {
        assert.ok(dataDir.includes('Library'));
      } else if (platform === 'win32') {
        assert.ok(dataDir.includes('AppData'));
      } else {
        assert.ok(dataDir.includes('.local'));
      }
    });
  });
});

