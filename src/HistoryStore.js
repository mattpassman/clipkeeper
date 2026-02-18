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
    // Create clipboard_entries table
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

