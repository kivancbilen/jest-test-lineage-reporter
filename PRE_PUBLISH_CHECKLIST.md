# Pre-Publish Checklist for CLI

## ✅ Things to Verify Before Publishing

### 1. **Bin Script is Executable**
```bash
# Check file permissions
ls -la bin/jest-lineage.js
# Should show: -rwxr-xr-x (executable)

# If not executable, fix it:
chmod +x bin/jest-lineage.js
```

### 2. **Shebang is Correct**
```bash
# First line of bin/jest-lineage.js should be:
#!/usr/bin/env node

# Verify:
head -n 1 bin/jest-lineage.js
```

### 3. **Files Array Includes CLI**
```json
// In package.json, verify:
{
  "files": [
    "bin/",           // ✅ Includes CLI entry point
    "src/",           // ✅ Includes all CLI code
    "babel.config.js",
    "README.md",
    "LICENSE"
  ]
}
```

### 4. **Test Local Install**
```bash
# Create test package
npm pack

# Install in a test project
mkdir /tmp/test-cli
cd /tmp/test-cli
npm init -y
npm install /path/to/jest-test-lineage-reporter-2.0.2.tgz

# Test the CLI
npx jest-lineage --version
npx jest-lineage --help
```

### 5. **Test Global Install**
```bash
# Link globally
cd /path/to/jest-test-lineage-reporter
npm link

# Test commands
jest-lineage --version
jest-lineage --help
jest-lineage test --help

# Unlink when done
npm unlink -g
```

### 6. **Verify Dependencies**
```bash
# Make sure all CLI dependencies are in "dependencies", not "devDependencies"
# Check package.json:
{
  "dependencies": {
    "chalk": "^4.1.2",       // ✅ CLI dependency
    "cli-table3": "^0.6.3",  // ✅ CLI dependency
    "commander": "^11.0.0",  // ✅ CLI dependency
    "open": "^8.4.0",        // ✅ CLI dependency
    "ora": "^5.4.1"          // ✅ CLI dependency
  }
}
```

### 7. **Test on Different Platforms** (if possible)

#### macOS/Linux:
```bash
npx jest-lineage test
```

#### Windows (Command Prompt):
```cmd
npx jest-lineage test
```

#### Windows (PowerShell):
```powershell
npx jest-lineage test
```

### 8. **Dry Run Package Contents**
```bash
# See what will be included in the package
npm pack --dry-run

# Verify output includes:
# - bin/jest-lineage.js
# - src/cli/ (all files)
# - src/TestCoverageReporter.js
# - src/MutationTester.js
# - etc.
```

### 9. **Version Bump**
```bash
# Since CLI is a new feature, bump minor version:
npm version minor
# 2.0.2 → 2.1.0

# Or manually update package.json:
{
  "version": "2.1.0"
}
```

### 10. **Update CHANGELOG.md**
```markdown
## [2.1.0] - 2026-01-06

### Added
- 🚀 **CLI Tool**: Complete command-line interface
  - `jest-lineage test` - Run Jest with lineage tracking
  - `jest-lineage mutate` - Standalone mutation testing
  - `jest-lineage report` - Generate HTML reports on-demand
  - `jest-lineage query` - Query test coverage data
  - `jest-lineage analyze` - Full workflow orchestration
- CLI dependencies: commander, ora, chalk, cli-table3, open
- Comprehensive CLI documentation in README

### Changed
- Updated package.json with bin field
- Expanded files array to include bin/ and src/cli/
```

## 🚀 Publishing Steps

### Step 1: Final Verification
```bash
# Run tests
npm test

# Check package contents
npm pack --dry-run

# Test CLI locally
npm link
jest-lineage --version
npm unlink -g
```

### Step 2: Version and Tag
```bash
# Bump version
npm version minor  # or patch, or major

# This automatically:
# - Updates package.json version
# - Creates git commit
# - Creates git tag
```

### Step 3: Publish
```bash
# Dry run first (see what would be published)
npm publish --dry-run

# Actually publish
npm publish

# For scoped packages (if needed):
npm publish --access public
```

### Step 4: Verify Published Package
```bash
# Wait a minute for npm to propagate, then:
npm view jest-test-lineage-reporter

# Check version
npm view jest-test-lineage-reporter version

# Check bin field
npm view jest-test-lineage-reporter bin

# Test install in fresh project
mkdir /tmp/test-install
cd /tmp/test-install
npm init -y
npm install jest-test-lineage-reporter
npx jest-lineage --version
```

### Step 5: Test Different Install Methods
```bash
# Global install
npm install -g jest-test-lineage-reporter
jest-lineage --version
npm uninstall -g jest-test-lineage-reporter

# npx (without installing)
npx jest-test-lineage-reporter --version
```

## ⚠️ Common Issues and Solutions

### Issue 1: "command not found" after install
**Cause**: Bin script not executable or missing shebang
**Fix**:
```bash
chmod +x bin/jest-lineage.js
# Ensure first line is: #!/usr/bin/env node
```

### Issue 2: "Cannot find module" errors
**Cause**: Dependencies in devDependencies instead of dependencies
**Fix**: Move CLI dependencies to "dependencies"

### Issue 3: CLI not included in package
**Cause**: Missing from "files" array
**Fix**: Add "bin/" and "src/cli/" to files array

### Issue 4: Windows users report issues
**Cause**: Line endings (CRLF vs LF)
**Fix**: Add .gitattributes:
```
* text=auto
*.js text eol=lf
bin/* text eol=lf
```

## 📋 Pre-Publish Checklist Summary

- [ ] bin/jest-lineage.js is executable (`chmod +x`)
- [ ] Shebang is correct (`#!/usr/bin/env node`)
- [ ] CLI dependencies in "dependencies" (not devDependencies)
- [ ] "files" array includes "bin/" and "src/"
- [ ] Tested with `npm link`
- [ ] Tested with `npm pack` + install
- [ ] Version bumped appropriately
- [ ] CHANGELOG.md updated
- [ ] README.md updated with CLI docs
- [ ] All tests passing
- [ ] Git committed and pushed

## 🎯 After Publishing

### Verify Installation Works
```bash
# Test in clean environment
npx jest-test-lineage-reporter@latest --version
```

### Update GitHub
```bash
# Create release
gh release create v2.1.0 --title "Release 2.1.0 - CLI Tool" --notes "Added comprehensive CLI interface"

# Or manually on GitHub
```

### Announce
- Update GitHub README
- Post to Twitter/social media
- Update documentation site (if any)
- Notify users in Discord/Slack (if applicable)

---

**Ready to Publish?** Follow the steps above and your CLI will work perfectly for all users! 🚀
