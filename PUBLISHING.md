# Publishing Checklist for clipkeeper

This document contains the final steps to publish clipkeeper to npm.

## Pre-Publication Checklist

### ✅ Completed Tasks

- [x] **Package.json metadata** - Added author, repository, bugs, homepage URLs
- [x] **LICENSE file** - Created MIT license file
- [x] **CLI executable** - Verified shebang line and global command works
- [x] **README updated** - Removed unimplemented features, focused on MVP scope
- [x] **CHANGELOG created** - Documented v0.1.0 features and limitations
- [x] **Post-install script** - Created welcome message with quick start
- [x] **Tests passing** - 242 out of 244 tests passing (2 skipped)
- [x] **Global installation tested** - `npm link` works, `clipkeeper` command functional
- [x] **.npmignore created** - Excludes test files and development artifacts
- [x] **QUICKSTART updated** - Uses global `clipkeeper` command

### ⚠️ Before Publishing - Update These

1. **package.json** - Update author information:
   ```json
   "author": "Your Name <your.email@example.com>"
   ```

2. **package.json** - Update repository URLs:
   ```json
   "repository": {
     "type": "git",
     "url": "https://github.com/yourusername/clipkeeper.git"
   },
   "bugs": {
     "url": "https://github.com/yourusername/clipkeeper/issues"
   },
   "homepage": "https://github.com/yourusername/clipkeeper#readme"
   ```

3. **README.md** - Update all GitHub URLs (search for `yourusername`)

4. **scripts/postinstall.js** - Update documentation URL

5. **CHANGELOG.md** - Update release URL at bottom

## Package Name Availability

Before publishing, check if the package name is available:

```bash
npm search clipkeeper
```

If the name is taken, consider alternatives:
- `clipboard-gpt`
- `clipboard-history-manager`
- `smart-clipboard`
- `clipgpt`

Update `package.json` name field if needed.

## Final Testing

### 1. Test Local Installation

```bash
# Create a test tarball
npm pack

# This creates clipkeeper-0.1.0.tgz
# Install it globally to test
npm install -g ./clipkeeper-0.1.0.tgz

# Test the commands
clipkeeper --version
clipkeeper --help
clipkeeper start
clipkeeper status
clipkeeper list
clipkeeper stop

# Uninstall test version
npm uninstall -g clipkeeper
```

### 2. Verify Package Contents

```bash
# Extract and inspect the tarball
tar -tzf clipkeeper-0.1.0.tgz

# Verify it includes:
# - src/ directory
# - config/ directory
# - scripts/ directory
# - LICENSE
# - README.md
# - CHANGELOG.md
# - package.json

# Verify it EXCLUDES:
# - test/ directory
# - .kiro/ directory
# - node_modules/
# - *.log files
```

### 3. Test on Clean System (Optional but Recommended)

If possible, test installation on a clean system or VM:
- Windows VM
- macOS (if available)
- Linux VM

## Git Preparation

### 1. Commit All Changes

```bash
git add .
git commit -m "chore: prepare v0.1.0 for npm publication"
```

### 2. Create Git Tag

```bash
git tag -a v0.1.0 -m "Release version 0.1.0"
git push origin main
git push origin v0.1.0
```

## npm Publication

### 1. Login to npm

```bash
npm login
```

Enter your npm credentials.

### 2. Verify npm User

```bash
npm whoami
```

### 3. Dry Run (Recommended)

```bash
npm publish --dry-run
```

This shows what will be published without actually publishing.

### 4. Publish to npm

```bash
npm publish
```

For first-time publication, you may need:
```bash
npm publish --access public
```

### 5. Verify Publication

```bash
# Check on npm website
open https://www.npmjs.com/package/clipkeeper

# Or install from npm
npm install -g clipkeeper
```

## Post-Publication

### 1. Announce Release

- Create GitHub release with CHANGELOG content
- Share on social media (Twitter, Reddit, etc.)
- Post in relevant communities

### 2. Monitor Issues

- Watch for installation issues
- Respond to bug reports
- Update documentation as needed

### 3. Plan Next Release

See CHANGELOG.md for planned features in v0.2.0:
- Semantic search
- LLM embedding integration
- Vector similarity search

## Troubleshooting

### Package Name Already Taken

If `clipkeeper` is taken:
1. Choose alternative name
2. Update `package.json` name field
3. Update all documentation references
4. Update repository name if needed

### Publication Fails

Common issues:
- Not logged in: Run `npm login`
- Package name taken: Choose different name
- Version already published: Bump version number
- Missing required fields: Check package.json

### Installation Issues

If users report installation issues:
1. Check Node.js version requirement (>=18.0.0)
2. Verify platform compatibility
3. Check for missing dependencies
4. Review installation logs

## Version Bumping (Future Releases)

For future releases:

```bash
# Patch release (0.1.0 -> 0.1.1)
npm version patch

# Minor release (0.1.0 -> 0.2.0)
npm version minor

# Major release (0.1.0 -> 1.0.0)
npm version major
```

This automatically:
- Updates package.json version
- Creates git commit
- Creates git tag

Then:
```bash
git push origin main --tags
npm publish
```

## Support Channels

Set up support channels:
- GitHub Issues for bug reports
- GitHub Discussions for questions
- Email for security issues
- Discord/Slack for community (optional)

---

## Quick Publish Command Sequence

Once everything is ready:

```bash
# 1. Final test
npm test

# 2. Create tarball and test
npm pack
npm install -g ./clipkeeper-0.1.0.tgz
clipkeeper --version
npm uninstall -g clipkeeper

# 3. Commit and tag
git add .
git commit -m "chore: prepare v0.1.0 for publication"
git tag -a v0.1.0 -m "Release version 0.1.0"
git push origin main --tags

# 4. Publish
npm login
npm publish --dry-run
npm publish

# 5. Verify
npm view clipkeeper
npm install -g clipkeeper
clipkeeper --version
```

---

**Ready to publish!** 🚀

Just update the author/repository information and you're good to go!

