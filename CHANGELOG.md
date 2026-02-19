# Changelog

All notable changes to clipkeeper will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-02-18

### Added
- Background clipboard monitoring with automatic capture
- Local SQLite storage for clipboard history
- Automatic content classification (text, code, URL, JSON, XML, markdown, file paths, images)
- Privacy filtering for sensitive content:
  - Passwords (8+ chars with mixed case, numbers, symbols)
  - Credit card numbers (with Luhn validation)
  - API keys (Bearer tokens, sk-* prefixed keys)
  - Private keys (PEM format)
  - SSH keys (RSA, Ed25519)
- CLI commands:
  - `start` - Start background service
  - `stop` - Stop background service
  - `status` - Show service status with statistics
  - `list` - List clipboard history with filtering
  - `clear` - Clear clipboard history
  - `config set/show/get` - Configuration management
- Configuration system with validation
- Automatic retry logic for clipboard access denied errors
- Cross-platform support (Windows, macOS, Linux)
- Service statistics (uptime, entry count, entries by type)
- Secure configuration file permissions
- Comprehensive logging system

### Features
- Configurable retention period (default: 30 days)
- Configurable clipboard polling interval (default: 500ms)
- Content type filtering in list command
- Limit control for list command
- API key masking in config display
- Platform-appropriate data directories
- Atomic configuration file writes
- Environment variable support for API keys

### Testing
- 242 out of 244 tests passing
- Unit tests for all core components
- Integration tests for CLI commands
- Test coverage for privacy filtering, content classification, and storage

### Known Limitations
- Semantic search not yet implemented (planned for v0.2.0)
- No LLM embedding integration yet (planned for v0.2.0)
- No vector similarity search yet (planned for v0.2.0)
- Browser clipboard operations may occasionally fail due to clipboard locks (retry logic mitigates this)
- No GUI (CLI only)

### Technical Details
- Node.js 18+ required
- ES modules architecture
- SQLite for local storage
- Commander.js for CLI
- Clipboardy for cross-platform clipboard access
- Better-sqlite3 for database operations

### Documentation
- Comprehensive README with examples
- Quick start guide
- Configuration documentation
- Troubleshooting section
- Architecture overview

---

## [Unreleased]

### Planned for v0.4.0
- Semantic search with natural language queries
- LLM embedding integration (OpenAI, Anthropic, Ollama)
- Vector similarity search
- Usage statistics and analytics

### Planned for v0.5.0
- Optional sync across devices
- GUI application
- Plugin system
- Mobile companion app

---

## [0.3.0] - 2025-02-19

### Added
- **Text-based search** - Search clipboard history with keywords
  - `clipkeeper search <query>` command with multiple keyword support (AND logic)
  - Case-insensitive search by default
  - Filter by content type with `--type` flag
  - Filter by date with `--since` flag
  - Limit results with `--limit` flag (default: 10)
  - Results ordered by timestamp (most recent first)
  - Interactive selection mode with Cancel option
- **Copy to clipboard** - Copy historical entries back to clipboard
  - `clipkeeper copy <id>` command to restore previous clipboard content
  - Entry IDs displayed in list command for easy reference
  - Exact content preservation
  - Interactive selection mode with Cancel option
- **Automated retention cleanup** - Automatic deletion of old entries
  - Background cleanup runs every hour
  - Respects `retention.days` configuration
  - Logs cleanup operations
  - Set `retention.days` to 0 for unlimited retention
- **Enhanced list command** - More powerful clipboard history viewing
  - `--search <text>` flag for inline text filtering
  - `--since <date>` flag for date filtering (supports ISO dates, "yesterday", "today", relative terms)
  - `--format <format>` flag with options: table (default), json, csv
  - Entry IDs shown in table format
  - Total count displayed at bottom
  - Interactive selection mode with Cancel option
- **Performance improvements**
  - Full-text search using SQLite FTS5 (with LIKE fallback for systems without FTS5)
  - Database migration system with schema versioning
  - FTS5 triggers to keep search index in sync
  - Optimized queries complete in <500ms for 10,000+ entries
- **Better error messages**
  - Clear, actionable error messages for common issues
  - Suggested next steps included in error output
  - Improved handling of service not running, database locked, and invalid input errors

### Changed
- List command now displays entry IDs for easy copying
- Search results include previews and relative timestamps
- Database schema updated to version 2 with FTS5 support
- Improved CLI output formatting
- Interactive mode now includes a Cancel option at the top of the selection list

### Performance
- Search queries: <500ms for databases with 10,000+ entries
- Copy operations: <100ms
- Retention cleanup: <5 seconds for 10,000+ entries
- List command: <500ms for any limit

### Technical Details
- Added SearchService for coordinating search operations
- Added RetentionService for automated cleanup
- Added ClipboardService for clipboard operations
- Enhanced HistoryStore with search(), getSince(), getCount(), getCountByType() methods
- Database migration framework with automatic FTS5 detection and fallback
- New ErrorMessages utility for consistent error handling

### Breaking Changes
None - All changes are backward compatible with v0.1.x

### Migration Notes
- Database automatically migrates from v0.1.x to v0.3.0 on first run
- Existing clipboard history is preserved
- FTS5 index is built automatically from existing entries
- No user action required

---

[0.3.0]: https://github.com/mattpassman/clipkeeper/releases/tag/v0.3.0
[0.1.0]: https://github.com/mattpassman/clipkeeper/releases/tag/v0.1.0

