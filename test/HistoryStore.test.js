import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import HistoryStore from '../src/HistoryStore.js';
import fs from 'fs';
import path from 'path';

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
  });
});

