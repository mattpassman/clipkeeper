#!/usr/bin/env node

/**
 * Post-install script for clipkeeper
 * Displays welcome message and setup instructions
 */

console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   📋 clipkeeper installed successfully!                      ║
║                                                                ║
║   A smart clipboard history manager with automatic            ║
║   content classification and privacy filtering.               ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝

🚀 Quick Start:

  1. Start the background service:
     $ clipkeeper start

  2. Copy some content to your clipboard

  3. View your clipboard history:
     $ clipkeeper list

  4. Filter by content type:
     $ clipkeeper list --type url
     $ clipkeeper list --type code

  5. Check service status:
     $ clipkeeper status

📚 More Commands:

  clipkeeper stop              Stop the background service
  clipkeeper clear             Clear clipboard history
  clipkeeper config show       View all settings
  clipkeeper config set <key> <value>  Update settings
  clipkeeper --help            Show all commands

🔒 Privacy:

  All data is stored locally on your machine. Sensitive content
  (passwords, credit cards, API keys) is automatically filtered.

  Data location:
  • Windows: %LOCALAPPDATA%\\clipkeeper
  • macOS:   ~/Library/Application Support/clipkeeper
  • Linux:   ~/.local/share/clipkeeper

📖 Documentation: https://github.com/yourusername/clipkeeper

💡 Tip: Run 'clipkeeper config set retention.days 60' to keep
   history for 60 days (default is 30 days).

`);


