#!/usr/bin/env node

/**
 * Post-install script for ClipKeeper
 * Displays welcome message and setup instructions
 */

console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   📋 ClipKeeper installed successfully!                      ║
║                                                                ║
║   A smart clipboard history manager with automatic            ║
║   content classification and privacy filtering.               ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝

🚀 Quick Start:

  1. Start the background service:
     $ ClipKeeper start

  2. Copy some content to your clipboard

  3. View your clipboard history:
     $ ClipKeeper list

  4. Filter by content type:
     $ ClipKeeper list --type url
     $ ClipKeeper list --type code

  5. Check service status:
     $ ClipKeeper status

📚 More Commands:

  ClipKeeper stop              Stop the background service
  ClipKeeper clear             Clear clipboard history
  ClipKeeper config show       View all settings
  ClipKeeper config set <key> <value>  Update settings
  ClipKeeper --help            Show all commands

🔒 Privacy:

  All data is stored locally on your machine. Sensitive content
  (passwords, credit cards, API keys) is automatically filtered.

  Data location:
  • Windows: %LOCALAPPDATA%\\ClipKeeper
  • macOS:   ~/Library/Application Support/ClipKeeper
  • Linux:   ~/.local/share/ClipKeeper

📖 Documentation: https://github.com/yourusername/ClipKeeper

💡 Tip: Run 'ClipKeeper config set retention.days 60' to keep
   history for 60 days (default is 30 days).

`);

