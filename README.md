# clipkeeper

A smart clipboard history manager with automatic content classification and privacy filtering.

[![npm version](https://img.shields.io/npm/v/clipkeeper.svg)](https://www.npmjs.com/package/clipkeeper)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/clipkeeper.svg)](https://nodejs.org)

## Overview

clipkeeper runs in the background and automatically captures everything you copy to your clipboard. It stores your clipboard history locally with intelligent content classification and privacy filtering, making it easy to find and reuse previously copied content.

## Features

✅ **Currently Available:**
- 📋 **Background Monitoring** - Automatically captures all clipboard activity
- 🗂️ **Local Storage** - All data stored in SQLite on your machine
- 🏷️ **Content Classification** - Automatically detects content types (text, code, URLs, JSON, XML, markdown, etc.)
- 🔒 **Privacy Filtering** - Automatically blocks passwords, credit cards, API keys, SSH keys
- 🔍 **List & Filter** - View history with filtering by content type
- ⚙️ **Configuration** - Customize retention period, poll interval, and privacy settings
- 🖥️ **Cross-Platform** - Works on Windows, macOS, and Linux

🚧 **Planned Features:**
- 🔮 Semantic search with natural language queries
- 🤖 LLM embedding integration (OpenAI, Anthropic, Ollama)
- 🎯 Vector similarity search

## Installation

```bash
npm install -g clipkeeper
```

**Requirements:**
- Node.js 18 or higher
- Windows, macOS, or Linux

## Quick Start

### 1. Start the Background Service

```bash
clipkeeper start
```

The service will run in the background and monitor your clipboard automatically.

### 2. Copy Some Content

Copy anything to your clipboard - text, code, URLs, etc. clipkeeper captures it all!

### 3. View Your History

```bash
# List last 10 entries
clipkeeper list

# List last 50 entries
clipkeeper list --limit 50

# Filter by content type
clipkeeper list --type url
clipkeeper list --type code
clipkeeper list --type json
```

Available content types: `text`, `code`, `url`, `json`, `xml`, `markdown`, `file_path`, `image`

### 4. Check Service Status

```bash
clipkeeper status
```

Shows service status, uptime, total entries, and breakdown by content type.

### 5. Stop the Service

```bash
clipkeeper stop
```

## Commands

### Service Management

| Command | Description |
|---------|-------------|
| `clipkeeper start` | Start the background monitoring service |
| `clipkeeper stop` | Stop the background service |
| `clipkeeper status` | Check service status with statistics |

### Clipboard History

| Command | Description |
|---------|-------------|
| `clipkeeper list [options]` | List recent clipboard entries |
| `  --limit <number>` | Number of entries to show (default: 10) |
| `  --type <type>` | Filter by content type |
| `clipkeeper clear [--confirm]` | Clear all clipboard history |

### Configuration

| Command | Description |
|---------|-------------|
| `clipkeeper config show` | Display all configuration settings |
| `clipkeeper config get <key>` | Get a specific configuration value |
| `clipkeeper config set <key> <value>` | Set a configuration value |

## Configuration

clipkeeper stores configuration in:
- **Windows:** `%APPDATA%\clipkeeper\config.json`
- **macOS:** `~/Library/Application Support/clipkeeper/config.json`
- **Linux:** `~/.config/clipkeeper/config.json`

### Common Settings

```bash
# Set retention period (days)
clipkeeper config set retention.days 60

# Adjust clipboard polling interval (milliseconds)
clipkeeper config set monitoring.pollInterval 500

# Enable/disable privacy filtering
clipkeeper config set privacy.enabled true
```

### Configuration Keys

| Key | Description | Default |
|-----|-------------|---------|
| `retention.days` | Days to keep history (0 = unlimited) | 30 |
| `monitoring.pollInterval` | Clipboard check interval (ms) | 500 |
| `privacy.enabled` | Enable privacy filtering | true |

## Privacy & Security

clipkeeper is designed with privacy as a priority:

- ✅ **All data stays local** - Nothing is sent to external services
- ✅ **Automatic filtering** - Sensitive content is blocked by default:
  - Passwords (8+ chars with mixed case, numbers, symbols)
  - Credit card numbers (validated with Luhn algorithm)
  - API keys (Bearer tokens, sk-* keys)
  - Private keys (PEM format)
  - SSH keys (RSA, Ed25519)
- ✅ **Secure storage** - Config files have restricted permissions
- ✅ **Configurable** - Customize privacy settings and add custom patterns

### Data Storage Locations

**Clipboard History:**
- Windows: `%LOCALAPPDATA%\clipkeeper\clipboard-history.db`
- macOS: `~/Library/Application Support/clipkeeper/clipboard-history.db`
- Linux: `~/.local/share/clipkeeper/clipboard-history.db`

**Logs:**
- Windows: `%APPDATA%\clipkeeper\clipkeeper.log`
- macOS: `~/Library/Application Support/clipkeeper/clipkeeper.log`
- Linux: `~/.local/share/clipkeeper/clipkeeper.log`

## Examples

### Basic Usage

```bash
# Start monitoring
clipkeeper start

# Copy some text, code, URLs...
# (clipkeeper captures everything automatically)

# View your history
clipkeeper list

# View only URLs you've copied
clipkeeper list --type url --limit 20

# View only code snippets
clipkeeper list --type code

# Clear old entries
clipkeeper clear

# Stop when done
clipkeeper stop
```

### Configuration Examples

```bash
# Keep history for 90 days
clipkeeper config set retention.days 90

# Check current retention setting
clipkeeper config get retention.days

# View all settings
clipkeeper config show
```

## Troubleshooting

### Service won't start

```bash
# Check if already running
clipkeeper status

# Check logs
# Windows: %APPDATA%\clipkeeper\clipkeeper.log
# macOS/Linux: ~/Library/Application Support/clipkeeper/clipkeeper.log
```

### No entries showing up

1. Make sure the service is running: `clipkeeper status`
2. Copy something to your clipboard
3. Wait a moment (default poll interval is 500ms)
4. Try `clipkeeper list` again

### Permission errors

- **Windows:** May need to run as Administrator
- **macOS/Linux:** Check file permissions in data directory

### Some clipboard content not captured

- Browser clipboard operations may temporarily lock the clipboard
- The service retries once after 100ms
- Most content will be captured on the next poll

## Development

```bash
# Clone the repository
git clone https://github.com/yourusername/clipkeeper.git
cd clipkeeper

# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Test CLI locally
node src/cli.js start
```

### Running Tests

```bash
npm test
```

Currently: **242 out of 244 tests passing** (2 skipped)

## Architecture

clipkeeper consists of several key components:

- **ClipboardMonitor** - Polls system clipboard for changes with retry logic
- **HistoryStore** - SQLite database for clipboard entries with metadata
- **PrivacyFilter** - Detects and filters sensitive content patterns
- **ContentClassifier** - Identifies content types using heuristics
- **ConfigurationManager** - Manages settings with validation
- **ServiceManager** - Background service lifecycle management
- **CLI** - Command-line interface using Commander.js

## Roadmap

### v0.2.0 (Planned)
- 🔮 Semantic search with natural language queries
- 🤖 LLM embedding integration (OpenAI, Anthropic, Ollama)
- 🎯 Vector similarity search
- 📊 Usage statistics and analytics

### v0.3.0 (Planned)
- 🔄 Sync across devices (optional)
- 🎨 GUI application
- 🔌 Plugin system
- 📱 Mobile companion app

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details

## Acknowledgments

- Built with [clipboardy](https://github.com/sindresorhus/clipboardy) for cross-platform clipboard access
- Uses [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) for fast local storage
- CLI powered by [Commander.js](https://github.com/tj/commander.js)

## Support

- 📖 [Documentation](https://github.com/yourusername/clipkeeper)
- 🐛 [Issue Tracker](https://github.com/yourusername/clipkeeper/issues)
- 💬 [Discussions](https://github.com/yourusername/clipkeeper/discussions)

---

Made with ❤️ by the clipkeeper team


