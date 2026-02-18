# ClipKeeper - Quick Start Guide

## Installation

```bash
npm install -g ClipKeeper
```

## Usage

### 1. Start the Background Service

```bash
ClipKeeper start
```

This will:
- Launch ClipKeeper as a background process
- Begin monitoring your clipboard automatically
- Store all clipboard changes locally in SQLite
- Filter out sensitive content (passwords, credit cards, API keys, etc.)
- Classify content types (text, code, URL, JSON, etc.)

### 2. Check Service Status

```bash
ClipKeeper status
```

Shows whether the service is running, uptime, entry count, and breakdown by content type.

### 3. List Clipboard History

```bash
# List last 10 entries
ClipKeeper list

# List last 50 entries
ClipKeeper list --limit 50

# List only code entries
ClipKeeper list --type code

# List only URLs
ClipKeeper list --type url
```

Available content types: `text`, `code`, `url`, `json`, `xml`, `markdown`, `file_path`, `image`

### 4. Clear History

```bash
# Clear with confirmation prompt
ClipKeeper clear

# Clear without confirmation
ClipKeeper clear --confirm
```

### 5. Stop the Service

```bash
ClipKeeper stop
```

## Configuration

### View Settings

```bash
# Show all settings
ClipKeeper config show

# Get specific setting
ClipKeeper config get retention.days
```

### Update Settings

```bash
# Set retention period (days)
ClipKeeper config set retention.days 60

# Adjust polling interval (milliseconds)
ClipKeeper config set monitoring.pollInterval 500

# Enable/disable privacy filtering
ClipKeeper config set privacy.enabled true
```

## What's Working

✅ Background clipboard monitoring
✅ Automatic content classification (text, code, URLs, JSON, etc.)
✅ Privacy filtering (blocks passwords, credit cards, API keys, SSH keys)
✅ SQLite storage with metadata
✅ List recent clipboard entries
✅ Filter by content type
✅ Clear history
✅ Service start/stop/status management
✅ Cross-platform support (Windows, macOS, Linux)

## What's Not Implemented Yet

❌ Semantic search (requires embedding service)
❌ Natural language queries
❌ Configuration commands (config set/show/get)
❌ Search command

## Data Storage

Your clipboard history is stored in:
- **Windows**: `%LOCALAPPDATA%\ClipKeeper\clipboard-history.db`
- **macOS**: `~/Library/Application Support/ClipKeeper/clipboard-history.db`
- **Linux**: `~/.local/share/ClipKeeper/clipboard-history.db`

Logs are stored in:
- **Windows**: `%APPDATA%\ClipKeeper\ClipKeeper.log`
- **macOS**: `~/Library/Application Support/ClipKeeper/ClipKeeper.log`
- **Linux**: `~/.local/share/ClipKeeper/ClipKeeper.log`

## Privacy

- All data stays on your local machine
- Sensitive content is automatically filtered:
  - Passwords (8+ chars with mixed case, numbers, symbols)
  - Credit card numbers (validated with Luhn algorithm)
  - API keys (Bearer tokens, sk-* keys)
  - Private keys (PEM format)
  - SSH keys (RSA, Ed25519)
- No data is sent to external services

## Testing

Run the test suite:
```bash
npm test
```

242 out of 244 tests passing! (2 tests skipped)

## Example Workflow

```bash
# Start monitoring
node src/cli.js start

# Copy some text, code, URLs to your clipboard
# (The service captures everything automatically)

# View your history
node src/cli.js list

# View only code snippets
node src/cli.js list --type code --limit 20

# Clear old entries
node src/cli.js clear

# Stop when done
node src/cli.js stop
```

## Troubleshooting

**Service won't start:**
- Check if it's already running: `node src/cli.js status`
- Check logs in the data directory

**No entries showing:**
- Make sure the service is running: `node src/cli.js status`
- Copy something to your clipboard
- Wait a moment and try `node src/cli.js list` again

**Permission errors:**
- On Windows, you may need to run as Administrator
- On macOS/Linux, check file permissions in the data directory

## Next Steps

To add semantic search capabilities, you'll need to:
1. Implement the EmbeddingService (Task 7.x)
2. Implement the VectorStore (Task 8.x)
3. Implement the SearchEngine (Task 9.x)
4. Implement the search command (Task 16.5)

For now, you have a fully functional clipboard history manager with automatic classification and privacy filtering!

