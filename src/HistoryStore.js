import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';

/**
 * HistoryStore manages clipboard entries in SQLite database
 * Implements Requirements 2.5, 2.6
 */
class HistoryStore {
  /**
   * @param {string} dbPath - Path to SQLite database file
   */
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
    this.hasFTS5 = false; // Flag to track FTS5 availability
    this._initializeDatabase();
  }

  /**
   * Initialize database connection and create schema
   * @private
   */
  _initializeDatabase() {
    // Ensure directory exists
    if (this.dbPath !== ':memory:') {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    // Open database connection
    this.db = new Database(this.dbPath);
    
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    
    // Create schema
    this._createSchema();
  }

  /**
   * Create database schema with indexes
   * @private
   */
  _createSchema() {
    // Create schema_version table for migration tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY
      );
    `);

    // Create clipboard_entries table FIRST (needed for migrations)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS clipboard_entries (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        content_type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        source_app TEXT,
        metadata TEXT,
        created_at INTEGER NOT NULL
      );
    `);

    // Create indexes for fast retrieval
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_timestamp 
      ON clipboard_entries(timestamp DESC);
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_content_type 
      ON clipboard_entries(content_type);
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_created_at 
      ON clipboard_entries(created_at);
    `);

    // Get current schema version
    const currentVersion = this._getCurrentSchemaVersion();

    // Run migrations if needed (after base tables are created)
    this._runMigrations(currentVersion);
  }

  /**
   * Get current schema version from database
   * @private
   * @returns {number} Current schema version (0 if not set)
   */
  _getCurrentSchemaVersion() {
    try {
      const row = this.db.prepare('SELECT version FROM schema_version').get();
      return row ? row.version : 0;
    } catch (error) {
      // Table doesn't exist yet or is empty
      return 0;
    }
  }

  /**
   * Set schema version in database
   * @private
   * @param {number} version - Schema version to set
   */
  _setSchemaVersion(version) {
    // Delete existing version and insert new one
    this.db.prepare('DELETE FROM schema_version').run();
    this.db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(version);
  }

  /**
   * Run database migrations
   * @private
   * @param {number} currentVersion - Current schema version
   */
  _runMigrations(currentVersion) {
    const targetVersion = 2; // Updated target schema version for FTS5

    if (currentVersion < 1) {
      // Migration to version 1: Base schema (already created in _createSchema)
      this._setSchemaVersion(1);
      currentVersion = 1; // Update for next migration check
    }

    if (currentVersion < 2) {
      // Migration to version 2: Add FTS5 support
      this._migrateFTS5();
      this._setSchemaVersion(2);
    }
  }

  /**
   * Migrate to FTS5 full-text search
   * Creates FTS5 virtual table, triggers, and populates from existing data
   * Falls back gracefully if FTS5 is not available
   * @private
   */
  _migrateFTS5() {
    try {
      // Test if FTS5 is available by creating a temporary table
      this.db.exec('CREATE VIRTUAL TABLE test_fts USING fts5(content)');
      this.db.exec('DROP TABLE test_fts');
      
      // FTS5 is available, create the virtual table
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS clipboard_entries_fts USING fts5(
          content,
          content='clipboard_entries',
          content_rowid='rowid'
        );
      `);
      
      // Create triggers to keep FTS index in sync with main table
      // Trigger for INSERT
      this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS clipboard_entries_ai 
        AFTER INSERT ON clipboard_entries BEGIN
          INSERT INTO clipboard_entries_fts(rowid, content) 
          VALUES (new.rowid, new.content);
        END;
      `);
      
      // Trigger for DELETE
      this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS clipboard_entries_ad 
        AFTER DELETE ON clipboard_entries BEGIN
          DELETE FROM clipboard_entries_fts WHERE rowid = old.rowid;
        END;
      `);
      
      // Trigger for UPDATE
      this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS clipboard_entries_au 
        AFTER UPDATE ON clipboard_entries BEGIN
          UPDATE clipboard_entries_fts 
          SET content = new.content 
          WHERE rowid = new.rowid;
        END;
      `);
      
      // Populate FTS index from existing entries
      // Use INSERT OR IGNORE to handle case where FTS table already has data
      this.db.exec(`
        INSERT OR IGNORE INTO clipboard_entries_fts(rowid, content)
        SELECT rowid, content FROM clipboard_entries;
      `);
      
      // Set flag to indicate FTS5 is available
      this.hasFTS5 = true;
      
      console.log('FTS5 full-text search enabled');
    } catch (error) {
      // FTS5 not available, fall back to LIKE queries
      this.hasFTS5 = false;
      console.warn('FTS5 not available, using LIKE fallback for text search');
    }
  }


  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Check if database connection is open
   * @returns {boolean}
   */
  isOpen() {
    return this.db !== null && this.db.open;
  }

  /**
   * Save a clipboard entry to the database
   * Implements Requirements 2.1, 2.7
   * @param {Object} entry - Clipboard entry to save
   * @param {string} entry.content - The clipboard content
   * @param {string} entry.contentType - Classified content type
   * @param {number} entry.timestamp - Unix timestamp in milliseconds
   * @param {string} [entry.sourceApp] - Source application name
   * @param {Object} [entry.metadata] - Additional metadata
   * @returns {string} The generated entry ID
   */
  save(entry) {
    if (!this.isOpen()) {
      throw new Error('Database is not open');
    }

    // Generate UUID for entry
    const id = randomUUID();
    const createdAt = Date.now();

    // Prepare statement
    const stmt = this.db.prepare(`
      INSERT INTO clipboard_entries (
        id, content, content_type, timestamp, source_app, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Execute insert
    stmt.run(
      id,
      entry.content,
      entry.contentType,
      entry.timestamp,
      entry.sourceApp || null,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
      createdAt
    );

    return id;
  }

  /**
   * Retrieve a clipboard entry by ID
   * @param {string} id - Entry ID
   * @returns {Object|null} The clipboard entry or null if not found
   */
  getById(id) {
    if (!this.isOpen()) {
      throw new Error('Database is not open');
    }

    const stmt = this.db.prepare(`
      SELECT id, content, content_type, timestamp, source_app, metadata, created_at
      FROM clipboard_entries
      WHERE id = ?
    `);

    const row = stmt.get(id);

    if (!row) {
      return null;
    }

    return this._rowToEntry(row);
  }

  /**
   * Retrieve recent clipboard entries
   * @param {number} limit - Maximum number of entries to retrieve
   * @returns {Array<Object>} Array of clipboard entries
   */
  getRecent(limit = 10) {
    if (!this.isOpen()) {
      throw new Error('Database is not open');
    }

    const stmt = this.db.prepare(`
      SELECT id, content, content_type, timestamp, source_app, metadata, created_at
      FROM clipboard_entries
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit);

    return rows.map(row => this._rowToEntry(row));
  }

  /**
   * Retrieve recent clipboard entries filtered by content type
   * @param {number} limit - Maximum number of entries to retrieve
   * @param {string} contentType - Content type to filter by
   * @returns {Array<Object>} Array of clipboard entries
   */
  getRecentByType(limit = 10, contentType) {
    if (!this.isOpen()) {
      throw new Error('Database is not open');
    }

    const stmt = this.db.prepare(`
      SELECT id, content, content_type, timestamp, source_app, metadata, created_at
      FROM clipboard_entries
      WHERE content_type = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(contentType, limit);

    return rows.map(row => this._rowToEntry(row));
  }

  /**
   * Get entries since a specific date
   * Implements Requirement 4.3
   * @param {Date|number} since - Date object or Unix timestamp in milliseconds
   * @param {number} [limit=100] - Maximum number of results
   * @returns {Array<Object>} Entries after the date, ordered by timestamp DESC
   */
  getSince(since, limit = 100) {
    if (!this.isOpen()) {
      throw new Error('Database is not open');
    }

    // Convert Date to timestamp if needed
    const timestamp = since instanceof Date ? since.getTime() : since;

    const stmt = this.db.prepare(`
      SELECT id, content, content_type, timestamp, source_app, metadata, created_at
      FROM clipboard_entries
      WHERE timestamp >= ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(timestamp, limit);

    return rows.map(row => this._rowToEntry(row));
  }


  /**
   * Search clipboard entries by text content
   * Implements Requirements 1.1, 1.2, 1.3, 1.6, 1.7, 1.8
   * @param {string} query - Search query (case-insensitive, supports multiple keywords)
   * @param {Object} options - Search options
   * @param {number} [options.limit=10] - Maximum number of results
   * @param {string} [options.contentType] - Filter by content type
   * @param {Date|number} [options.since] - Only entries after this date
   * @returns {Array<Object>} Matching entries ordered by timestamp DESC
   */
  search(query, options = {}) {
    if (!this.isOpen()) {
      throw new Error('Database is not open');
    }

    // Parse options with defaults
    const limit = options.limit || 10;
    const contentType = options.contentType || null;
    const since = options.since ? (options.since instanceof Date ? options.since.getTime() : options.since) : null;

    // Parse query into keywords (split on whitespace, remove empty strings)
    const keywords = query.trim().split(/\s+/).filter(k => k.length > 0);
    
    if (keywords.length === 0) {
      return [];
    }

    let rows;

    if (this.hasFTS5) {
      // Use FTS5 MATCH for full-text search
      // FTS5 MATCH syntax: keywords are ANDed together
      const ftsQuery = keywords.join(' ');
      
      let sql = `
        SELECT e.id, e.content, e.content_type, e.timestamp, e.source_app, e.metadata, e.created_at
        FROM clipboard_entries e
        JOIN clipboard_entries_fts fts ON e.rowid = fts.rowid
        WHERE fts.content MATCH ?
      `;
      
      const params = [ftsQuery];
      
      // Add content type filter if specified
      if (contentType) {
        sql += ' AND e.content_type = ?';
        params.push(contentType);
      }
      
      // Add date filter if specified
      if (since) {
        sql += ' AND e.timestamp >= ?';
        params.push(since);
      }
      
      // Order by timestamp DESC and apply limit
      sql += ' ORDER BY e.timestamp DESC LIMIT ?';
      params.push(limit);
      
      const stmt = this.db.prepare(sql);
      rows = stmt.all(...params);
    } else {
      // Fall back to LIKE with AND logic
      let sql = `
        SELECT id, content, content_type, timestamp, source_app, metadata, created_at
        FROM clipboard_entries
        WHERE 1=1
      `;
      
      const params = [];
      
      // Add LIKE clause for each keyword (AND logic)
      for (const keyword of keywords) {
        sql += ' AND content LIKE ?';
        params.push(`%${keyword}%`);
      }
      
      // Add content type filter if specified
      if (contentType) {
        sql += ' AND content_type = ?';
        params.push(contentType);
      }
      
      // Add date filter if specified
      if (since) {
        sql += ' AND timestamp >= ?';
        params.push(since);
      }
      
      // Order by timestamp DESC and apply limit
      sql += ' ORDER BY timestamp DESC LIMIT ?';
      params.push(limit);
      
      const stmt = this.db.prepare(sql);
      rows = stmt.all(...params);
    }

    return rows.map(row => this._rowToEntry(row));
  }

  /**
   * Search clipboard entries by text content
   * Implements Requirements 1.1, 1.2, 1.3, 1.6, 1.7, 1.8
   * @param {string} query - Search query (case-insensitive, supports multiple keywords)
   * @param {Object} options - Search options
   * @param {number} [options.limit=10] - Maximum number of results
   * @param {string} [options.contentType] - Filter by content type
   * @param {Date|number} [options.since] - Only entries after this date
   * @returns {Array<Object>} Matching entries ordered by timestamp DESC
   */
  search(query, options = {}) {
    if (!this.isOpen()) {
      throw new Error('Database is not open');
    }

    // Parse options with defaults
    const limit = options.limit || 10;
    const contentType = options.contentType || null;
    const since = options.since ? (options.since instanceof Date ? options.since.getTime() : options.since) : null;

    // Parse query into keywords (split on whitespace, remove empty strings)
    const keywords = query.trim().split(/\s+/).filter(k => k.length > 0);

    if (keywords.length === 0) {
      return [];
    }

    let rows;

    if (this.hasFTS5) {
      // Use FTS5 MATCH for full-text search
      // FTS5 MATCH syntax: keywords are ANDed together
      const ftsQuery = keywords.join(' ');

      let sql = `
        SELECT e.id, e.content, e.content_type, e.timestamp, e.source_app, e.metadata, e.created_at
        FROM clipboard_entries e
        JOIN clipboard_entries_fts fts ON e.rowid = fts.rowid
        WHERE fts.content MATCH ?
      `;

      const params = [ftsQuery];

      // Add content type filter if specified
      if (contentType) {
        sql += ' AND e.content_type = ?';
        params.push(contentType);
      }

      // Add date filter if specified
      if (since) {
        sql += ' AND e.timestamp >= ?';
        params.push(since);
      }

      // Order by timestamp DESC and apply limit
      sql += ' ORDER BY e.timestamp DESC LIMIT ?';
      params.push(limit);

      const stmt = this.db.prepare(sql);
      rows = stmt.all(...params);
    } else {
      // Fall back to LIKE with AND logic
      let sql = `
        SELECT id, content, content_type, timestamp, source_app, metadata, created_at
        FROM clipboard_entries
        WHERE 1=1
      `;

      const params = [];

      // Add LIKE clause for each keyword (AND logic)
      for (const keyword of keywords) {
        sql += ' AND content LIKE ?';
        params.push(`%${keyword}%`);
      }

      // Add content type filter if specified
      if (contentType) {
        sql += ' AND content_type = ?';
        params.push(contentType);
      }

      // Add date filter if specified
      if (since) {
        sql += ' AND timestamp >= ?';
        params.push(since);
      }

      // Order by timestamp DESC and apply limit
      sql += ' ORDER BY timestamp DESC LIMIT ?';
      params.push(limit);

      const stmt = this.db.prepare(sql);
      rows = stmt.all(...params);
    }

    return rows.map(row => this._rowToEntry(row));
  }


  /**
   * Delete a clipboard entry by ID
   * @param {string} id - Entry ID
   * @returns {boolean} True if entry was deleted, false if not found
   */
  deleteById(id) {
    if (!this.isOpen()) {
      throw new Error('Database is not open');
    }

    const stmt = this.db.prepare(`
      DELETE FROM clipboard_entries
      WHERE id = ?
    `);

    const result = stmt.run(id);

    return result.changes > 0;
  }

  /**
   * Delete clipboard entries older than a specific date
   * Implements retention policy cleanup
   * @param {Date|number} date - Date object or Unix timestamp in milliseconds
   * @returns {number} Number of entries deleted
   */
  deleteOlderThan(date) {
    if (!this.isOpen()) {
      throw new Error('Database is not open');
    }

    const timestamp = date instanceof Date ? date.getTime() : date;

    const stmt = this.db.prepare(`
      DELETE FROM clipboard_entries
      WHERE timestamp < ?
    `);

    const result = stmt.run(timestamp);

    return result.changes;
  }

  /**
   * Clear all clipboard entries from the database
   * @returns {number} Number of entries deleted
   */
  clear() {
    if (!this.isOpen()) {
      throw new Error('Database is not open');
    }

    const stmt = this.db.prepare(`
      DELETE FROM clipboard_entries
    `);

    const result = stmt.run();

    return result.changes;
  }

  /**
   * Get total count of clipboard entries
   * @returns {number} Total entry count
   */
  getCount() {
    if (!this.isOpen()) {
      throw new Error('Database is not open');
    }

    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM clipboard_entries
    `);

    const result = stmt.get();

    return result.count;
  }

  /**
   * Get count of clipboard entries grouped by content type
   * @returns {Object} Map of content_type -> count
   */
  getCountByType() {
    if (!this.isOpen()) {
      throw new Error('Database is not open');
    }

    const stmt = this.db.prepare(`
      SELECT content_type, COUNT(*) as count
      FROM clipboard_entries
      GROUP BY content_type
    `);

    const rows = stmt.all();

    // Convert array of rows to object map
    const countMap = {};
    for (const row of rows) {
      countMap[row.content_type] = row.count;
    }

    return countMap;
  }

  /**
   * Convert database row to clipboard entry object
   * @private
   * @param {Object} row - Database row
   * @returns {Object} Clipboard entry
   */
  _rowToEntry(row) {
    return {
      id: row.id,
      content: row.content,
      contentType: row.content_type,
      timestamp: row.timestamp,
      sourceApp: row.source_app,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      createdAt: row.created_at
    };
  }

}

export default HistoryStore;

