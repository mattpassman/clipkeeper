# Changelog

All notable changes to ClipKeeper will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-02-18

### Added
- 📋 Background clipboard monitoring with automatic capture
- 🗂️ Local SQLite storage for clipboard history
- 🏷️ Automatic content classification (text, code, URL, JSON, XML, markdown, file paths, images)
- 🔒 Privacy filtering for sensitive content:
  - Passwords (8+ chars with mixed case, numbers, symbols)
  - Credit card numbers (with Luhn validation)
  - API keys (Bearer tokens, sk-* prefixed keys)
  - Private keys (PEM format)
  - SSH keys (RSA, Ed25519)
- 📝 CLI commands:
  - `start` - Start background service
  - `stop` - Stop background service
  - `status` - Show service status with statistics
  - `list` - List clipboard history with filtering
  - `clear` - Clear clipboard history
  - `config set/show/get` - Configuration management
- ⚙️ Configuration system with validation
- 🔄 Automatic retry logic for clipboard access denied errors
- 🖥️ Cross-platform support (Windows, macOS, Linux)
- 📊 Service statistics (uptime, entry count, entries by type)
- 🔐 Secure configuration file permissions
- 📝 Comprehensive logging system

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

### Planned for v0.2.0
- Semantic search with natural language queries
- LLM embedding integration (OpenAI, Anthropic, Ollama)
- Vector similarity search
- Search command implementation
- Usage statistics and analytics

### Planned for v0.3.0
- Optional sync across devices
- GUI application
- Plugin system
- Mobile companion app

---

[0.1.0]: https://github.com/yourusername/ClipKeeper/releases/tag/v0.1.0

