import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

/**
 * ConfigurationManager handles loading, saving, and validating application configuration.
 * Supports environment variable overrides and secure file permissions.
 */
export class ConfigurationManager {
  constructor(configPath = null) {
    this.configPath = configPath || this._getDefaultConfigPath();
    this.config = this._loadConfig();
  }

  /**
   * Get the default configuration file path based on the platform
   * @returns {string} Path to config file
   */
  _getDefaultConfigPath() {
    const platform = os.platform();
    let configDir;

    if (platform === 'win32') {
      // Windows: %APPDATA%/clipkeeper/config.json
      configDir = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'clipkeeper');
    } else {
      // Linux/macOS: ~/.config/clipkeeper/config.json
      configDir = path.join(os.homedir(), '.config', 'clipkeeper');
    }

    return path.join(configDir, 'config.json');
  }

  /**
   * Get default configuration values
   * @returns {object} Default configuration
   */
  _getDefaultConfig() {
    return {
      version: '1.0',
      embedding: {
        provider: 'openai',
        model: 'text-embedding-3-small',
        apiKey: null,
        endpoint: null,
        dimensions: null,
        batchSize: 10
      },
      privacy: {
        enabled: true,
        patterns: [],
        excludeTypes: []
      },
      retention: {
        days: 30,
        maxEntries: null
      },
      monitoring: {
        pollInterval: 500,
        autoStart: false,
        enabled: true
      },
      storage: {
        dataDir: this._getDefaultDataDir(),
        dbPath: null,
        vectorPath: null,
        logPath: null
      },
      search: {
        defaultLimit: 10,
        minScore: 0.7,
        cacheSize: 1000
      }
    };
  }

  /**
   * Get default data directory based on platform
   * @returns {string} Path to data directory
   */
  _getDefaultDataDir() {
    const platform = os.platform();
    
    if (platform === 'win32') {
      return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'clipkeeper');
    } else if (platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'clipkeeper');
    } else {
      return path.join(os.homedir(), '.local', 'share', 'clipkeeper');
    }
  }

  /**
   * Load configuration from file, merging with defaults and environment variables
   * @returns {object} Loaded configuration
   */
  _loadConfig() {
    let fileConfig = {};

    // Try to load from file
    if (fs.existsSync(this.configPath)) {
      try {
        const fileContent = fs.readFileSync(this.configPath, 'utf8');
        fileConfig = JSON.parse(fileContent);
      } catch (error) {
        console.warn(`Failed to load config from ${this.configPath}: ${error.message}`);
        console.warn('Using default configuration');
      }
    }

    // Start with defaults
    const config = this._deepMerge(this._getDefaultConfig(), fileConfig);

    // Apply environment variable overrides (they take precedence)
    this._applyEnvironmentOverrides(config);

    return config;
  }

  /**
   * Apply environment variable overrides to configuration
   * @param {object} config Configuration object to modify
   */
  _applyEnvironmentOverrides(config) {
    // ClipKeeper_OPENAI_KEY
    if (process.env.ClipKeeper_OPENAI_KEY) {
      config.embedding.apiKey = process.env.ClipKeeper_OPENAI_KEY;
      if (config.embedding.provider === 'openai') {
        // Already set
      }
    }

    // ClipKeeper_ANTHROPIC_KEY
    if (process.env.ClipKeeper_ANTHROPIC_KEY) {
      config.embedding.apiKey = process.env.ClipKeeper_ANTHROPIC_KEY;
      if (config.embedding.provider === 'anthropic' || config.embedding.provider === 'voyage') {
        // Already set
      }
    }
  }

  /**
   * Deep merge two objects
   * @param {object} target Target object
   * @param {object} source Source object
   * @returns {object} Merged object
   */
  _deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this._deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * Get a configuration value by key path (e.g., 'embedding.provider')
   * @param {string} key Key path
   * @returns {any} Configuration value
   */
  get(key) {
    const keys = key.split('.');
    let value = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Set a configuration value by key path
   * @param {string} key Key path
   * @param {any} value Value to set
   */
  set(key, value) {
    const keys = key.split('.');
    let current = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Get all configuration
   * @returns {object} Complete configuration object
   */
  getAll() {
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * Save configuration to file with atomic write and secure permissions
   */
  save() {
    try {
      // Ensure directory exists
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
      }

      // Atomic write: write to temp file, then rename
      const tempPath = `${this.configPath}.tmp`;
      const configJson = JSON.stringify(this.config, null, 2);
      
      fs.writeFileSync(tempPath, configJson, { mode: 0o600 });
      fs.renameSync(tempPath, this.configPath);

      // Set secure permissions (user read/write only)
      this._setSecurePermissions(this.configPath);

    } catch (error) {
      throw new Error(`Failed to save configuration: ${error.message}`);
    }
  }

  /**
   * Set secure file permissions (600 on Unix-like systems, user-only ACL on Windows)
   * @param {string} filePath Path to file
   */
  _setSecurePermissions(filePath) {
    if (os.platform() === 'win32') {
      // On Windows, use icacls to set user-only permissions
      this._setWindowsACL(filePath);
    } else {
      // On Unix-like systems, use chmod to set 600 permissions
      try {
        fs.chmodSync(filePath, 0o600);
      } catch (error) {
        console.warn(`Failed to set secure permissions on ${filePath}: ${error.message}`);
      }
    }
  }

  /**
   * Set Windows ACL to restrict access to current user only
   * @param {string} filePath Path to file
   */
  _setWindowsACL(filePath) {
    try {
      const username = os.userInfo().username;
      
      // Remove all inherited permissions and grant full control to current user only
      // /inheritance:r - Remove inherited permissions
      // /grant:r - Grant permissions, replacing existing ones
      const command = `icacls "${filePath}" /inheritance:r /grant:r "${username}:F"`;
      
      execSync(command, { 
        stdio: 'pipe',
        windowsHide: true 
      });
    } catch (error) {
      console.warn(`Failed to set Windows ACL on ${filePath}: ${error.message}`);
    }
  }

  /**
   * Validate configuration
   * @returns {Promise<object>} Validation result with { valid: boolean, errors: string[] }
   */
  async validate() {
    const errors = [];

    // Validate embedding provider
    const validProviders = ['openai', 'anthropic', 'voyage', 'ollama'];
    if (!validProviders.includes(this.config.embedding.provider)) {
      errors.push(`Invalid embedding provider: ${this.config.embedding.provider}`);
    }

    // Validate API key format for OpenAI
    if (this.config.embedding.provider === 'openai' && this.config.embedding.apiKey) {
      if (!this._validateOpenAIKey(this.config.embedding.apiKey)) {
        errors.push('Invalid OpenAI API key format');
      }
    }

    // Validate API key format for Anthropic/Voyage
    if ((this.config.embedding.provider === 'anthropic' || this.config.embedding.provider === 'voyage') 
        && this.config.embedding.apiKey) {
      if (!this._validateAnthropicKey(this.config.embedding.apiKey)) {
        errors.push('Invalid Anthropic/Voyage API key format');
      }
    }

    // Validate Ollama endpoint accessibility
    if (this.config.embedding.provider === 'ollama') {
      const endpoint = this.config.embedding.endpoint || 'http://localhost:11434';
      const isAccessible = await this._validateOllamaEndpoint(endpoint);
      if (!isAccessible) {
        errors.push(`Ollama endpoint is not accessible: ${endpoint}`);
      }
    }

    // Validate retention period
    if (typeof this.config.retention.days !== 'number' || this.config.retention.days < 0) {
      errors.push('Retention days must be a non-negative number');
    }

    // Validate poll interval
    if (typeof this.config.monitoring.pollInterval !== 'number' || this.config.monitoring.pollInterval < 100) {
      errors.push('Poll interval must be at least 100ms');
    }

    // Validate search settings
    if (typeof this.config.search.minScore !== 'number' || 
        this.config.search.minScore < 0 || 
        this.config.search.minScore > 1) {
      errors.push('Minimum score must be between 0 and 1');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate OpenAI API key format
   * @param {string} key API key
   * @returns {boolean} True if valid
   */
  _validateOpenAIKey(key) {
    // OpenAI keys typically start with 'sk-' and are alphanumeric
    return /^sk-[a-zA-Z0-9]{32,}$/.test(key);
  }

  /**
   * Validate Anthropic/Voyage API key format
   * @param {string} key API key
   * @returns {boolean} True if valid
   */
  _validateAnthropicKey(key) {
    // Anthropic keys typically start with 'sk-ant-' or similar patterns
    // Voyage keys may have different patterns
    // For now, just check it's a reasonable length alphanumeric string
    return /^[a-zA-Z0-9_-]{20,}$/.test(key);
  }

  /**
   * Validate Ollama endpoint accessibility
   * @param {string} endpoint Ollama endpoint URL
   * @returns {Promise<boolean>} True if accessible
   */
  async _validateOllamaEndpoint(endpoint) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

      const response = await fetch(`${endpoint}/api/tags`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}


