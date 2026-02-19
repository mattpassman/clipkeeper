import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import HistoryStore from '../src/HistoryStore.js';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('HistoryStore', () => {
  let store;
  const testDbPath = ':memory:'; // Use in-memory database for tests

  beforeEach(() => {
    store = new HistoryStore(testDbPath);
  });

  afterEach(() => {
    if (store) {
      store.close();
    }
  });

  describe('Database Initialization', () => {
    it('should create database connection', () => {
      assert.ok(store.isOpen(), 'Database should be open');
    });

    it('should create schema_version table', () => {
      const tables = store.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
      ).all();
      
      assert.strictEqual(tables.length, 1, 'schema_version table should exist');
    });

    it('should set initial schema version to 2', () => {
      const row = store.db.prepare('SELECT version FROM schema_version').get();
      assert.strictEqual(row.version, 2, 'Schema version should be 2');
    });

    it('should create clipboard_entries table', () => {
      const tables = store.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='clipboard_entries'"
      ).all();
      
      assert.strictEqual(tables.length, 1, 'clipboard_entries table should exist');
    });

    it('should create timestamp index', () => {
      const indexes = store.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_timestamp'"
      ).all();
      
      assert.strictEqual(indexes.length, 1, 'idx_timestamp index should exist');
    });

    it('should create content_type index', () => {
      const indexes = store.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_content_type'"
      ).all();
      
      assert.strictEqual(indexes.length, 1, 'idx_content_type index should exist');
    });

    it('should create created_at index', () => {
      const indexes = store.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_created_at'"
      ).all();
      
      assert.strictEqual(indexes.length, 1, 'idx_created_at index should exist');
    });
  });

  describe('Connection Management', () => {
    it('should close database connection', () => {
      store.close();
      assert.ok(!store.isOpen(), 'Database should be closed');
    });

    it('should handle multiple close calls gracefully', () => {
      store.close();
      store.close(); // Should not throw
      assert.ok(!store.isOpen(), 'Database should remain closed');
    });
  });

  describe('File-based Database', () => {
    it('should create database file and directory', () => {
      const tempDir = path.join(process.cwd(), 'test', 'temp');
      const tempDbPath = path.join(tempDir, 'test.db');
      
      // Clean up if exists
      if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
      }
      if (fs.existsSync(tempDir)) {
        fs.rmdirSync(tempDir, { recursive: true });
      }

      const fileStore = new HistoryStore(tempDbPath);
      
      assert.ok(fs.existsSync(tempDbPath), 'Database file should be created');
      assert.ok(fs.existsSync(tempDir), 'Directory should be created');
      
      fileStore.close();
      
      // Clean up
      fs.unlinkSync(tempDbPath);
      fs.rmdirSync(tempDir, { recursive: true });
    });
  });

  describe('CRUD Operations', () => {
    describe('save()', () => {
      it('should save entry and return UUID', () => {
        const entry = {
          content: 'Test content',
          contentType: 'text',
          timestamp: Date.now()
        };

        const id = store.save(entry);

        assert.ok(id, 'Should return an ID');
        assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Should be a valid UUID');
      });

      it('should save entry with all fields', () => {
        const entry = {
          content: 'Test content',
          contentType: 'code',
          timestamp: Date.now(),
          sourceApp: 'VSCode',
          metadata: { language: 'javascript', lines: 10 }
        };

        const id = store.save(entry);
        const retrieved = store.getById(id);

        assert.strictEqual(retrieved.content, entry.content);
        assert.strictEqual(retrieved.contentType, entry.contentType);
        assert.strictEqual(retrieved.timestamp, entry.timestamp);
        assert.strictEqual(retrieved.sourceApp, entry.sourceApp);
        assert.deepStrictEqual(retrieved.metadata, entry.metadata);
      });

      it('should save entry without optional fields', () => {
        const entry = {
          content: 'Minimal entry',
          contentType: 'text',
          timestamp: Date.now()
        };

        const id = store.save(entry);
        const retrieved = store.getById(id);

        assert.strictEqual(retrieved.content, entry.content);
        assert.strictEqual(retrieved.sourceApp, null);
        assert.strictEqual(retrieved.metadata, null);
      });

      it('should generate unique IDs for different entries', () => {
        const id1 = store.save({ content: 'Entry 1', contentType: 'text', timestamp: Date.now() });
        const id2 = store.save({ content: 'Entry 2', contentType: 'text', timestamp: Date.now() });

        assert.notStrictEqual(id1, id2, 'IDs should be unique');
      });

      it('should throw error when database is closed', () => {
        store.close();
        
        assert.throws(() => {
          store.save({ content: 'Test', contentType: 'text', timestamp: Date.now() });
        }, /Database is not open/);
      });
    });

    describe('getById()', () => {
      it('should retrieve entry by ID', () => {
        const entry = {
          content: 'Test content',
          contentType: 'text',
          timestamp: Date.now()
        };

        const id = store.save(entry);
        const retrieved = store.getById(id);

        assert.ok(retrieved, 'Should retrieve entry');
        assert.strictEqual(retrieved.id, id);
        assert.strictEqual(retrieved.content, entry.content);
      });

      it('should return null for non-existent ID', () => {
        const retrieved = store.getById('non-existent-id');
        assert.strictEqual(retrieved, null);
      });

      it('should throw error when database is closed', () => {
        store.close();
        
        assert.throws(() => {
          store.getById('some-id');
        }, /Database is not open/);
      });
    });

    describe('getRecent()', () => {
      it('should retrieve recent entries in descending order', () => {
        const now = Date.now();
        const id1 = store.save({ content: 'First', contentType: 'text', timestamp: now - 2000 });
        const id2 = store.save({ content: 'Second', contentType: 'text', timestamp: now - 1000 });
        const id3 = store.save({ content: 'Third', contentType: 'text', timestamp: now });

        const recent = store.getRecent(10);

        assert.strictEqual(recent.length, 3);
        assert.strictEqual(recent[0].id, id3, 'Most recent should be first');
        assert.strictEqual(recent[1].id, id2);
        assert.strictEqual(recent[2].id, id1);
      });

      it('should respect limit parameter', () => {
        for (let i = 0; i < 5; i++) {
          store.save({ content: `Entry ${i}`, contentType: 'text', timestamp: Date.now() + i });
        }

        const recent = store.getRecent(3);
        assert.strictEqual(recent.length, 3);
      });

      it('should use default limit of 10', () => {
        for (let i = 0; i < 15; i++) {
          store.save({ content: `Entry ${i}`, contentType: 'text', timestamp: Date.now() + i });
        }

        const recent = store.getRecent();
        assert.strictEqual(recent.length, 10);
      });

      it('should return empty array when no entries exist', () => {
        const recent = store.getRecent(10);
        assert.deepStrictEqual(recent, []);
      });

      it('should throw error when database is closed', () => {
        store.close();
        
        assert.throws(() => {
          store.getRecent(10);
        }, /Database is not open/);
      });
    });

    describe('deleteById()', () => {
      it('should delete entry by ID', () => {
        const id = store.save({ content: 'To delete', contentType: 'text', timestamp: Date.now() });
        
        const deleted = store.deleteById(id);
        assert.strictEqual(deleted, true);

        const retrieved = store.getById(id);
        assert.strictEqual(retrieved, null);
      });

      it('should return false for non-existent ID', () => {
        const deleted = store.deleteById('non-existent-id');
        assert.strictEqual(deleted, false);
      });

      it('should throw error when database is closed', () => {
        store.close();
        
        assert.throws(() => {
          store.deleteById('some-id');
        }, /Database is not open/);
      });
    });

    describe('deleteOlderThan()', () => {
      it('should delete entries older than timestamp', () => {
        const now = Date.now();
        store.save({ content: 'Old 1', contentType: 'text', timestamp: now - 10000 });
        store.save({ content: 'Old 2', contentType: 'text', timestamp: now - 5000 });
        store.save({ content: 'Recent', contentType: 'text', timestamp: now });

        const deleted = store.deleteOlderThan(now - 3000);
        assert.strictEqual(deleted, 2);

        const remaining = store.getRecent(10);
        assert.strictEqual(remaining.length, 1);
        assert.strictEqual(remaining[0].content, 'Recent');
      });

      it('should accept Date object', () => {
        const now = Date.now();
        store.save({ content: 'Old', contentType: 'text', timestamp: now - 10000 });
        store.save({ content: 'Recent', contentType: 'text', timestamp: now });

        const cutoffDate = new Date(now - 5000);
        const deleted = store.deleteOlderThan(cutoffDate);
        
        assert.strictEqual(deleted, 1);
      });

      it('should return 0 when no entries match', () => {
        const now = Date.now();
        store.save({ content: 'Recent', contentType: 'text', timestamp: now });

        const deleted = store.deleteOlderThan(now - 10000);
        assert.strictEqual(deleted, 0);
      });

      it('should throw error when database is closed', () => {
        store.close();
        
        assert.throws(() => {
          store.deleteOlderThan(Date.now());
        }, /Database is not open/);
      });
    });

    describe('clear()', () => {
      it('should delete all entries', () => {
        store.save({ content: 'Entry 1', contentType: 'text', timestamp: Date.now() });
        store.save({ content: 'Entry 2', contentType: 'text', timestamp: Date.now() });
        store.save({ content: 'Entry 3', contentType: 'text', timestamp: Date.now() });

        const deleted = store.clear();
        assert.strictEqual(deleted, 3);

        const remaining = store.getRecent(10);
        assert.strictEqual(remaining.length, 0);
      });

      it('should return 0 when database is empty', () => {
        const deleted = store.clear();
        assert.strictEqual(deleted, 0);
      });

      it('should throw error when database is closed', () => {
        store.close();
        
        assert.throws(() => {
          store.clear();
        }, /Database is not open/);
      });
    });

    describe('getCount()', () => {
      it('should return 0 for empty database', () => {
        const count = store.getCount();
        assert.strictEqual(count, 0);
      });

      it('should return correct count after adding entries', () => {
        store.save({ content: 'Entry 1', contentType: 'text', timestamp: Date.now() });
        store.save({ content: 'Entry 2', contentType: 'text', timestamp: Date.now() });
        store.save({ content: 'Entry 3', contentType: 'text', timestamp: Date.now() });

        const count = store.getCount();
        assert.strictEqual(count, 3);
      });

      it('should return correct count after deleting entries', () => {
        const id1 = store.save({ content: 'Entry 1', contentType: 'text', timestamp: Date.now() });
        store.save({ content: 'Entry 2', contentType: 'text', timestamp: Date.now() });
        store.save({ content: 'Entry 3', contentType: 'text', timestamp: Date.now() });

        store.deleteById(id1);

        const count = store.getCount();
        assert.strictEqual(count, 2);
      });

      it('should return 0 after clearing all entries', () => {
        store.save({ content: 'Entry 1', contentType: 'text', timestamp: Date.now() });
        store.save({ content: 'Entry 2', contentType: 'text', timestamp: Date.now() });

        store.clear();

        const count = store.getCount();
        assert.strictEqual(count, 0);
      });

      it('should throw error when database is closed', () => {
        store.close();
        
        assert.throws(() => {
          store.getCount();
        }, /Database is not open/);
      });
    });

    describe('getCountByType()', () => {
      it('should return empty object for empty database', () => {
        const countByType = store.getCountByType();
        assert.deepStrictEqual(countByType, {});
      });

      it('should return correct count for single content type', () => {
        store.save({ content: 'Entry 1', contentType: 'text', timestamp: Date.now() });
        store.save({ content: 'Entry 2', contentType: 'text', timestamp: Date.now() });
        store.save({ content: 'Entry 3', contentType: 'text', timestamp: Date.now() });

        const countByType = store.getCountByType();
        assert.deepStrictEqual(countByType, { text: 3 });
      });

      it('should return correct counts for multiple content types', () => {
        store.save({ content: 'Text 1', contentType: 'text', timestamp: Date.now() });
        store.save({ content: 'Text 2', contentType: 'text', timestamp: Date.now() });
        store.save({ content: 'Code 1', contentType: 'code', timestamp: Date.now() });
        store.save({ content: 'URL 1', contentType: 'url', timestamp: Date.now() });
        store.save({ content: 'URL 2', contentType: 'url', timestamp: Date.now() });
        store.save({ content: 'URL 3', contentType: 'url', timestamp: Date.now() });

        const countByType = store.getCountByType();
        assert.deepStrictEqual(countByType, { 
          text: 2, 
          code: 1, 
          url: 3 
        });
      });

      it('should update counts after deleting entries', () => {
        const id1 = store.save({ content: 'Text 1', contentType: 'text', timestamp: Date.now() });
        store.save({ content: 'Text 2', contentType: 'text', timestamp: Date.now() });
        store.save({ content: 'Code 1', contentType: 'code', timestamp: Date.now() });

        store.deleteById(id1);

        const countByType = store.getCountByType();
        assert.deepStrictEqual(countByType, { 
          text: 1, 
          code: 1 
        });
      });

      it('should remove type from result when all entries of that type are deleted', () => {
        const id1 = store.save({ content: 'Text 1', contentType: 'text', timestamp: Date.now() });
        store.save({ content: 'Code 1', contentType: 'code', timestamp: Date.now() });

        store.deleteById(id1);

        const countByType = store.getCountByType();
        assert.deepStrictEqual(countByType, { code: 1 });
        assert.ok(!('text' in countByType), 'text type should not be in result');
      });

      it('should return empty object after clearing all entries', () => {
        store.save({ content: 'Text 1', contentType: 'text', timestamp: Date.now() });
        store.save({ content: 'Code 1', contentType: 'code', timestamp: Date.now() });

        store.clear();

        const countByType = store.getCountByType();
        assert.deepStrictEqual(countByType, {});
      });

      it('should handle many entries of different types', () => {
        for (let i = 0; i < 10; i++) {
          store.save({ content: `Text ${i}`, contentType: 'text', timestamp: Date.now() });
        }
        for (let i = 0; i < 5; i++) {
          store.save({ content: `Code ${i}`, contentType: 'code', timestamp: Date.now() });
        }
        for (let i = 0; i < 3; i++) {
          store.save({ content: `URL ${i}`, contentType: 'url', timestamp: Date.now() });
        }

        const countByType = store.getCountByType();
        assert.deepStrictEqual(countByType, { 
          text: 10, 
          code: 5, 
          url: 3 
        });
      });

      it('should throw error when database is closed', () => {
        store.close();
        
        assert.throws(() => {
          store.getCountByType();
        }, /Database is not open/);
      });
    });
  });

  describe('Schema Version Tracking', () => {
    it('should track schema version across database reopens', () => {
      // Create a temporary file-based database
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipkeeper-test-'));
      const tmpDbPath = path.join(tmpDir, 'test.db');
      
      try {
        // Create first instance
        const store1 = new HistoryStore(tmpDbPath);
        const version1 = store1.db.prepare('SELECT version FROM schema_version').get();
        assert.strictEqual(version1.version, 2, 'Initial version should be 2');
        store1.close();
        
        // Reopen database
        const store2 = new HistoryStore(tmpDbPath);
        const version2 = store2.db.prepare('SELECT version FROM schema_version').get();
        assert.strictEqual(version2.version, 2, 'Version should persist after reopen');
        store2.close();
      } finally {
        // Cleanup - use try-catch to handle Windows file locking issues
        try {
          if (fs.existsSync(tmpDbPath)) {
            fs.unlinkSync(tmpDbPath);
          }
          if (fs.existsSync(tmpDbPath + '-shm')) {
            fs.unlinkSync(tmpDbPath + '-shm');
          }
          if (fs.existsSync(tmpDbPath + '-wal')) {
            fs.unlinkSync(tmpDbPath + '-wal');
          }
          fs.rmdirSync(tmpDir, { recursive: true });
        } catch (cleanupError) {
          // Ignore cleanup errors on Windows
          console.warn('Cleanup warning:', cleanupError.message);
        }
      }
    });

    it('should not run migrations when schema is current', () => {
      // Schema version should already be 2
      const version = store.db.prepare('SELECT version FROM schema_version').get();
      assert.strictEqual(version.version, 2, 'Schema version should be 2');
      
      // Verify no errors occur on subsequent initialization
      const store2 = new HistoryStore(':memory:');
      const version2 = store2.db.prepare('SELECT version FROM schema_version').get();
      assert.strictEqual(version2.version, 2, 'New database should also be version 2');
      store2.close();
    });
  });

  describe('FTS5 Migration', () => {
    it('should set hasFTS5 flag based on availability', () => {
      // The flag should be set (true or false) after initialization
      assert.ok(typeof store.hasFTS5 === 'boolean', 'hasFTS5 should be a boolean');
    });

    it('should create FTS5 virtual table if available', () => {
      if (store.hasFTS5) {
        const tables = store.db.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='clipboard_entries_fts'"
        ).all();
        
        assert.strictEqual(tables.length, 1, 'clipboard_entries_fts table should exist when FTS5 is available');
      }
    });

    it('should create FTS5 triggers if available', () => {
      if (store.hasFTS5) {
        const triggers = store.db.prepare(
          "SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'clipboard_entries_a%'"
        ).all();
        
        assert.ok(triggers.length >= 3, 'Should have at least 3 triggers (insert, update, delete)');
        
        const triggerNames = triggers.map(t => t.name);
        assert.ok(triggerNames.includes('clipboard_entries_ai'), 'Should have insert trigger');
        assert.ok(triggerNames.includes('clipboard_entries_au'), 'Should have update trigger');
        assert.ok(triggerNames.includes('clipboard_entries_ad'), 'Should have delete trigger');
      }
    });

    it('should populate FTS5 index from existing entries', () => {
      if (store.hasFTS5) {
        // Add some entries
        store.save({ content: 'Test content 1', contentType: 'text', timestamp: Date.now() });
        store.save({ content: 'Test content 2', contentType: 'text', timestamp: Date.now() });
        
        // Check FTS index has entries
        const count = store.db.prepare('SELECT COUNT(*) as count FROM clipboard_entries_fts').get();
        assert.ok(count.count >= 2, 'FTS index should contain entries');
      }
    });

    it('should keep FTS5 index in sync on insert', () => {
      if (store.hasFTS5) {
        const id = store.save({ content: 'New entry', contentType: 'text', timestamp: Date.now() });
        
        // Get the rowid for this entry
        const entry = store.db.prepare('SELECT rowid FROM clipboard_entries WHERE id = ?').get(id);
        
        // Check FTS index was updated
        const ftsEntry = store.db.prepare('SELECT rowid FROM clipboard_entries_fts WHERE rowid = ?').get(entry.rowid);
        assert.ok(ftsEntry, 'FTS index should be updated on insert');
      }
    });

    it('should keep FTS5 index in sync on delete', () => {
      if (store.hasFTS5) {
        const id = store.save({ content: 'To delete', contentType: 'text', timestamp: Date.now() });
        
        // Get the rowid before deletion
        const entry = store.db.prepare('SELECT rowid FROM clipboard_entries WHERE id = ?').get(id);
        const rowid = entry.rowid;
        
        // Delete the entry
        store.deleteById(id);
        
        // Check FTS index was updated
        const ftsEntry = store.db.prepare('SELECT rowid FROM clipboard_entries_fts WHERE rowid = ?').get(rowid);
        assert.strictEqual(ftsEntry, undefined, 'FTS index should be updated on delete');
      }
    });

    it('should migrate existing database from version 1 to version 2', () => {
      // Create a temporary file-based database
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipkeeper-test-'));
      const tmpDbPath = path.join(tmpDir, 'test.db');
      
      try {
        // Create a version 1 database manually
        const db = new Database(tmpDbPath);
        
        db.exec(`
          CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
          INSERT INTO schema_version (version) VALUES (1);
          
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
        
        // Add some test data
        db.prepare(`
          INSERT INTO clipboard_entries (id, content, content_type, timestamp, source_app, metadata, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run('test-id-1', 'Test content', 'text', Date.now(), null, null, Date.now());
        
        db.close();
        
        // Now open with HistoryStore which should migrate to version 2
        const migratedStore = new HistoryStore(tmpDbPath);
        
        // Check version was updated
        const version = migratedStore.db.prepare('SELECT version FROM schema_version').get();
        assert.strictEqual(version.version, 2, 'Should migrate to version 2');
        
        // Check FTS5 was set up if available
        if (migratedStore.hasFTS5) {
          const tables = migratedStore.db.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='clipboard_entries_fts'"
          ).all();
          assert.strictEqual(tables.length, 1, 'FTS5 table should be created during migration');
          
          // Check existing data was indexed
          const count = migratedStore.db.prepare('SELECT COUNT(*) as count FROM clipboard_entries_fts').get();
          assert.ok(count.count >= 1, 'Existing entries should be indexed');
        }
        
        migratedStore.close();
      } finally {
        // Cleanup - use try-catch to handle Windows file locking issues
        try {
          if (fs.existsSync(tmpDbPath)) {
            fs.unlinkSync(tmpDbPath);
          }
          if (fs.existsSync(tmpDbPath + '-shm')) {
            fs.unlinkSync(tmpDbPath + '-shm');
          }
          if (fs.existsSync(tmpDbPath + '-wal')) {
            fs.unlinkSync(tmpDbPath + '-wal');
          }
          fs.rmdirSync(tmpDir, { recursive: true });
        } catch (cleanupError) {
          // Ignore cleanup errors on Windows
          console.warn('Cleanup warning:', cleanupError.message);
        }
      }
    });
  });

  describe('search()', () => {
    describe('Basic Search', () => {
      it('should find entries with single keyword', () => {
        store.save({ content: 'Hello world', contentType: 'text', timestamp: Date.now() });
        store.save({ content: 'Goodbye world', contentType: 'text', timestamp: Date.now() });
        store.save({ content: 'Something else', contentType: 'text', timestamp: Date.now() });

        const results = store.search('world');
        
        assert.strictEqual(results.length, 2);
        assert.ok(results.every(r => r.content.toLowerCase().includes('world')));
      });

      it('should find entries with multiple keywords (AND logic)', () => {
        store.save({ content: 'Hello world', contentType: 'text', timestamp: Date.now() });
        store.save({ content: 'Hello there', contentType: 'text', timestamp: Date.now() });
        store.save({ content: 'world peace', contentType: 'text', timestamp: Date.now() });

        const results = store.search('hello world');
        
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].content, 'Hello world');
      });

      it('should be case-insensitive', () => {
        store.save({ content: 'HELLO WORLD', contentType: 'text', timestamp: Date.now() });
        store.save({ content: 'hello world', contentType: 'text', timestamp: Date.now() });
        store.save({ content: 'HeLLo WoRLd', contentType: 'text', timestamp: Date.now() });

        const results = store.search('hello world');
        
        assert.strictEqual(results.length, 3);
      });

      it('should return empty array for no matches', () => {
        store.save({ content: 'Hello world', contentType: 'text', timestamp: Date.now() });
        
        const results = store.search('nonexistent');
        
        assert.deepStrictEqual(results, []);
      });

      it('should return empty array for empty query', () => {
        store.save({ content: 'Hello world', contentType: 'text', timestamp: Date.now() });
        
        const results = store.search('');
        
        assert.deepStrictEqual(results, []);
      });

      it('should return empty array for whitespace-only query', () => {
        store.save({ content: 'Hello world', contentType: 'text', timestamp: Date.now() });
        
        const results = store.search('   ');
        
        assert.deepStrictEqual(results, []);
      });
    });

    describe('Search Ordering', () => {
      it('should order results by timestamp DESC', () => {
        const now = Date.now();
        store.save({ content: 'test entry old', contentType: 'text', timestamp: now - 3000 });
        store.save({ content: 'test entry middle', contentType: 'text', timestamp: now - 1000 });
        store.save({ content: 'test entry new', contentType: 'text', timestamp: now });

        const results = store.search('test entry');
        
        assert.strictEqual(results.length, 3);
        assert.ok(results[0].timestamp >= results[1].timestamp);
        assert.ok(results[1].timestamp >= results[2].timestamp);
        assert.strictEqual(results[0].content, 'test entry new');
      });
    });

    describe('Search Filters', () => {
      it('should filter by content type', () => {
        store.save({ content: 'test content', contentType: 'text', timestamp: Date.now() });
        store.save({ content: 'test content', contentType: 'code', timestamp: Date.now() });
        store.save({ content: 'test content', contentType: 'url', timestamp: Date.now() });

        const results = store.search('test', { contentType: 'code' });
        
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].contentType, 'code');
      });

      it('should filter by date (timestamp)', () => {
        const now = Date.now();
        store.save({ content: 'old entry', contentType: 'text', timestamp: now - 10000 });
        store.save({ content: 'recent entry', contentType: 'text', timestamp: now - 1000 });
        store.save({ content: 'new entry', contentType: 'text', timestamp: now });

        const results = store.search('entry', { since: now - 5000 });
        
        assert.strictEqual(results.length, 2);
        assert.ok(results.every(r => r.timestamp >= now - 5000));
      });

      it('should filter by date (Date object)', () => {
        const now = Date.now();
        store.save({ content: 'old entry', contentType: 'text', timestamp: now - 10000 });
        store.save({ content: 'recent entry', contentType: 'text', timestamp: now - 1000 });
        store.save({ content: 'new entry', contentType: 'text', timestamp: now });

        const sinceDate = new Date(now - 5000);
        const results = store.search('entry', { since: sinceDate });
        
        assert.strictEqual(results.length, 2);
        assert.ok(results.every(r => r.timestamp >= now - 5000));
      });

      it('should combine content type and date filters', () => {
        const now = Date.now();
        store.save({ content: 'test old text', contentType: 'text', timestamp: now - 10000 });
        store.save({ content: 'test old code', contentType: 'code', timestamp: now - 10000 });
        store.save({ content: 'test new text', contentType: 'text', timestamp: now });
        store.save({ content: 'test new code', contentType: 'code', timestamp: now });

        const results = store.search('test', { 
          contentType: 'code', 
          since: now - 5000 
        });
        
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].content, 'test new code');
      });
    });

    describe('Limit Parameter', () => {
      it('should respect limit parameter', () => {
        for (let i = 0; i < 10; i++) {
          store.save({ content: `test entry ${i}`, contentType: 'text', timestamp: Date.now() + i });
        }

        const results = store.search('test', { limit: 5 });
        
        assert.strictEqual(results.length, 5);
      });

      it('should use default limit of 10', () => {
        for (let i = 0; i < 15; i++) {
          store.save({ content: `test entry ${i}`, contentType: 'text', timestamp: Date.now() + i });
        }

        const results = store.search('test');
        
        assert.strictEqual(results.length, 10);
      });

      it('should return fewer results if not enough matches', () => {
        store.save({ content: 'test entry 1', contentType: 'text', timestamp: Date.now() });
        store.save({ content: 'test entry 2', contentType: 'text', timestamp: Date.now() });

        const results = store.search('test', { limit: 10 });
        
        assert.strictEqual(results.length, 2);
      });
    });

    describe('Error Handling', () => {
      it('should throw error when database is closed', () => {
        store.close();
        
        assert.throws(() => {
          store.search('test');
        }, /Database is not open/);
      });
    });

    describe('Special Characters', () => {
      it('should handle special characters in search query', () => {
        store.save({ content: 'function test() { return true; }', contentType: 'code', timestamp: Date.now() });
        store.save({ content: 'const x = 100;', contentType: 'code', timestamp: Date.now() });

        const results = store.search('function');
        
        assert.strictEqual(results.length, 1);
        assert.ok(results[0].content.includes('function'));
      });

      it('should handle punctuation in search query', () => {
        store.save({ content: 'Hello, world!', contentType: 'text', timestamp: Date.now() });
        store.save({ content: 'Hello world', contentType: 'text', timestamp: Date.now() });

        const results = store.search('Hello');
        
        assert.strictEqual(results.length, 2);
      });
    });
  });

  describe('getSince()', () => {
    describe('Basic Functionality', () => {
      it('should retrieve entries since a timestamp', () => {
        const now = Date.now();
        store.save({ content: 'Old entry 1', contentType: 'text', timestamp: now - 10000 });
        store.save({ content: 'Old entry 2', contentType: 'text', timestamp: now - 5000 });
        store.save({ content: 'Recent entry 1', contentType: 'text', timestamp: now - 2000 });
        store.save({ content: 'Recent entry 2', contentType: 'text', timestamp: now });

        const results = store.getSince(now - 3000);
        
        assert.strictEqual(results.length, 2);
        assert.ok(results.every(r => r.timestamp >= now - 3000));
      });

      it('should retrieve entries since a Date object', () => {
        const now = Date.now();
        store.save({ content: 'Old entry', contentType: 'text', timestamp: now - 10000 });
        store.save({ content: 'Recent entry 1', contentType: 'text', timestamp: now - 2000 });
        store.save({ content: 'Recent entry 2', contentType: 'text', timestamp: now });

        const sinceDate = new Date(now - 3000);
        const results = store.getSince(sinceDate);
        
        assert.strictEqual(results.length, 2);
        assert.ok(results.every(r => r.timestamp >= now - 3000));
      });

      it('should order results by timestamp DESC', () => {
        const now = Date.now();
        store.save({ content: 'Entry 1', contentType: 'text', timestamp: now - 5000 });
        store.save({ content: 'Entry 2', contentType: 'text', timestamp: now - 3000 });
        store.save({ content: 'Entry 3', contentType: 'text', timestamp: now - 1000 });
        store.save({ content: 'Entry 4', contentType: 'text', timestamp: now });

        const results = store.getSince(now - 6000);
        
        assert.strictEqual(results.length, 4);
        assert.ok(results[0].timestamp >= results[1].timestamp);
        assert.ok(results[1].timestamp >= results[2].timestamp);
        assert.ok(results[2].timestamp >= results[3].timestamp);
        assert.strictEqual(results[0].content, 'Entry 4');
        assert.strictEqual(results[3].content, 'Entry 1');
      });

      it('should return empty array when no entries match', () => {
        const now = Date.now();
        store.save({ content: 'Old entry', contentType: 'text', timestamp: now - 10000 });
        
        const results = store.getSince(now);
        
        assert.deepStrictEqual(results, []);
      });

      it('should include entries with exact timestamp match', () => {
        const now = Date.now();
        store.save({ content: 'Exact match', contentType: 'text', timestamp: now });
        store.save({ content: 'Older', contentType: 'text', timestamp: now - 1000 });

        const results = store.getSince(now);
        
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].content, 'Exact match');
      });
    });

    describe('Limit Parameter', () => {
      it('should respect limit parameter', () => {
        const now = Date.now();
        for (let i = 0; i < 10; i++) {
          store.save({ content: `Entry ${i}`, contentType: 'text', timestamp: now + i });
        }

        const results = store.getSince(now, 5);
        
        assert.strictEqual(results.length, 5);
      });

      it('should use default limit of 100', () => {
        const now = Date.now();
        for (let i = 0; i < 150; i++) {
          store.save({ content: `Entry ${i}`, contentType: 'text', timestamp: now + i });
        }

        const results = store.getSince(now);
        
        assert.strictEqual(results.length, 100);
      });

      it('should return fewer results if not enough entries', () => {
        const now = Date.now();
        store.save({ content: 'Entry 1', contentType: 'text', timestamp: now });
        store.save({ content: 'Entry 2', contentType: 'text', timestamp: now + 1000 });

        const results = store.getSince(now, 10);
        
        assert.strictEqual(results.length, 2);
      });
    });

    describe('Edge Cases', () => {
      it('should handle timestamp of 0', () => {
        const now = Date.now();
        store.save({ content: 'Entry 1', contentType: 'text', timestamp: now });
        
        const results = store.getSince(0);
        
        assert.strictEqual(results.length, 1);
      });

      it('should handle future timestamp', () => {
        const now = Date.now();
        store.save({ content: 'Entry 1', contentType: 'text', timestamp: now });
        
        const results = store.getSince(now + 10000);
        
        assert.deepStrictEqual(results, []);
      });

      it('should return all entries when since is very old', () => {
        const now = Date.now();
        store.save({ content: 'Entry 1', contentType: 'text', timestamp: now - 5000 });
        store.save({ content: 'Entry 2', contentType: 'text', timestamp: now - 3000 });
        store.save({ content: 'Entry 3', contentType: 'text', timestamp: now });

        const results = store.getSince(0, 100);
        
        assert.strictEqual(results.length, 3);
      });
    });

    describe('Error Handling', () => {
      it('should throw error when database is closed', () => {
        store.close();
        
        assert.throws(() => {
          store.getSince(Date.now());
        }, /Database is not open/);
      });
    });

    describe('Data Integrity', () => {
      it('should return complete entry objects', () => {
        const now = Date.now();
        const id = store.save({ 
          content: 'Test entry', 
          contentType: 'code',
          timestamp: now,
          sourceApp: 'VSCode',
          metadata: { language: 'javascript' }
        });

        const results = store.getSince(now - 1000);
        
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].id, id);
        assert.strictEqual(results[0].content, 'Test entry');
        assert.strictEqual(results[0].contentType, 'code');
        assert.strictEqual(results[0].timestamp, now);
        assert.strictEqual(results[0].sourceApp, 'VSCode');
        assert.deepStrictEqual(results[0].metadata, { language: 'javascript' });
        assert.ok(results[0].createdAt);
      });

      it('should not modify entries', () => {
        const now = Date.now();
        const originalContent = 'Original content';
        store.save({ content: originalContent, contentType: 'text', timestamp: now });

        const results = store.getSince(now - 1000);
        
        assert.strictEqual(results[0].content, originalContent);
        
        // Verify entry is unchanged in database
        const allEntries = store.getRecent(10);
        assert.strictEqual(allEntries[0].content, originalContent);
      });
    });
  });
});
