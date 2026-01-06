# How the CLI Works After NPM Installation

## 📦 For End Users (After You Publish)

### Installation

```bash
# Install as dev dependency (recommended)
npm install jest-test-lineage-reporter --save-dev
```

### What Happens During Installation

1. **NPM downloads the package** to `node_modules/jest-test-lineage-reporter/`

2. **NPM creates a symlink** in `node_modules/.bin/`:
   ```
   node_modules/.bin/jest-lineage → node_modules/jest-test-lineage-reporter/bin/jest-lineage.js
   ```

3. **On Windows**, npm creates wrapper scripts:
   - `node_modules/.bin/jest-lineage.cmd` (for cmd.exe)
   - `node_modules/.bin/jest-lineage` (for Git Bash/WSL)

### How Users Run the CLI

#### Method 1: Using npx (Recommended ⭐)
```bash
# npx automatically finds the command in node_modules/.bin/
npx jest-lineage test
npx jest-lineage mutate --threshold 85
npx jest-lineage report --open
```

**Why this is best:**
- ✅ Works on all platforms (Windows, Mac, Linux)
- ✅ Doesn't require modifying package.json
- ✅ Clear and explicit
- ✅ Most familiar to developers

#### Method 2: npm Scripts in package.json
```json
{
  "scripts": {
    "test": "jest",
    "test:lineage": "jest-lineage test",
    "test:mutate": "jest-lineage mutate",
    "report": "jest-lineage report --open",
    "analyze": "jest-lineage analyze --open"
  }
}
```

Then run:
```bash
npm run test:lineage
npm run test:mutate
npm run analyze
```

**Why this is useful:**
- ✅ Short commands (`npm run analyze` vs `npx jest-lineage analyze`)
- ✅ Easy to document in README
- ✅ Consistent with other npm scripts

#### Method 3: Direct Path
```bash
# Works but verbose
./node_modules/.bin/jest-lineage test

# On Windows (cmd.exe):
.\node_modules\.bin\jest-lineage.cmd test

# On Windows (PowerShell):
& ".\node_modules\.bin\jest-lineage.cmd" test
```

**When to use:**
- Only if npx is not available (rare)

### Global Installation (Optional)

```bash
# Install globally
npm install -g jest-test-lineage-reporter

# Now the command is available everywhere
jest-lineage --version
jest-lineage test
jest-lineage analyze --open
```

**When to use global install:**
- ✅ If you want to use the tool across multiple projects
- ✅ If you're using it as a standalone tool
- ❌ Not recommended for project-specific testing (use local install)

## 🎯 Example User Workflow

### New User Getting Started

```bash
# 1. Install in their project
cd my-awesome-project
npm install jest-test-lineage-reporter --save-dev

# 2. Set up Jest config (if not already done)
# Edit jest.config.js to add the reporter

# 3. Run tests with lineage tracking
npx jest-lineage test

# 4. View the results
# - Check console output
# - Open test-lineage-report.html

# 5. Run mutation testing
npx jest-lineage mutate

# 6. Query coverage for a specific file
npx jest-lineage query src/components/Button.tsx

# 7. Full workflow in one command
npx jest-lineage analyze --open
```

### Power User with npm Scripts

```json
// package.json
{
  "scripts": {
    "test": "jest",
    "test:full": "jest-lineage analyze --open",
    "test:quick": "jest-lineage test --no-mutation",
    "coverage:query": "jest-lineage query"
  }
}
```

```bash
# Run full analysis
npm run test:full

# Quick test without mutation
npm run test:quick

# Query coverage
npm run coverage:query src/utils/api.ts
```

## 🌍 Cross-Platform Behavior

### macOS/Linux
```bash
# Everything works out of the box
npx jest-lineage test
```

The symlink works perfectly:
```
node_modules/.bin/jest-lineage → ../jest-test-lineage-reporter/bin/jest-lineage.js
```

### Windows (Command Prompt)
```cmd
REM npm creates jest-lineage.cmd wrapper automatically
npx jest-lineage test

REM Or use npm scripts
npm run test:lineage
```

### Windows (PowerShell)
```powershell
# Works exactly the same as cmd
npx jest-lineage test

# npm scripts also work
npm run test:lineage
```

### Windows (Git Bash / WSL)
```bash
# npm creates both .cmd and no-extension versions
npx jest-lineage test
```

## 🔍 How NPM Finds the Command

When a user runs `npx jest-lineage`, npm/npx:

1. **Checks `node_modules/.bin/`** for `jest-lineage`
2. **Finds the symlink** to your package's bin script
3. **Executes with Node.js**: `node node_modules/jest-test-lineage-reporter/bin/jest-lineage.js`
4. **Your shebang** (`#!/usr/bin/env node`) ensures it runs with Node

## 📋 What Users See

### Help Output
```bash
$ npx jest-lineage --help

Usage: jest-lineage [options] [command]

Comprehensive test analytics with lineage tracking and mutation testing

Options:
  -v, --version                  Display version number
  -h, --help                     display help for command

Commands:
  test [options] [jest-args...]  Run Jest tests with lineage tracking enabled
  mutate [options]               Run mutation testing on existing lineage data
  report [options]               Generate HTML report from existing lineage data
  query [options] <file> [line]  Query which tests cover specific files or lines
  analyze [options]              Full workflow: test + mutation + report
  help [command]                 display help for command
```

### Version Output
```bash
$ npx jest-lineage --version
2.1.0
```

### Command Output
```bash
$ npx jest-lineage test

🧪 Running Jest with lineage tracking...
Command: jest --coverage

 PASS  src/__tests__/calculator.test.ts
  ✓ should add numbers (5 ms)
  ✓ should subtract numbers (3 ms)

Tests: 2 passed, 2 total
Coverage: 85% statements

✅ Tests completed successfully
ℹ️  Lineage data saved to: .jest-lineage-data.json
   - 2 tests tracked
   - 3 files analyzed
```

## 🚀 In CI/CD

### GitHub Actions
```yaml
name: Test with Lineage

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests with lineage
        run: npx jest-lineage test

      - name: Run mutation testing
        run: npx jest-lineage mutate --threshold 80

      - name: Generate report
        run: npx jest-lineage report

      - name: Upload report
        uses: actions/upload-artifact@v3
        with:
          name: test-lineage-report
          path: test-lineage-report.html
```

### GitLab CI
```yaml
test:
  script:
    - npm ci
    - npx jest-lineage analyze
  artifacts:
    paths:
      - test-lineage-report.html
```

## 💡 Troubleshooting for Users

### "Command not found: jest-lineage"

**Solution 1:** Use npx
```bash
npx jest-lineage test
```

**Solution 2:** Check installation
```bash
# Verify package is installed
npm list jest-test-lineage-reporter

# Reinstall if needed
npm install jest-test-lineage-reporter --save-dev
```

**Solution 3:** Use full path
```bash
./node_modules/.bin/jest-lineage test
```

### "Permission denied"

**On Linux/macOS:**
```bash
# The bin script should already be executable, but if not:
chmod +x node_modules/jest-test-lineage-reporter/bin/jest-lineage.js
```

**On Windows:**
```cmd
REM Use npm scripts or npx instead
npx jest-lineage test
```

### "Cannot find module 'commander'"

**Cause:** Dependencies not installed properly

**Solution:**
```bash
# Remove and reinstall
rm -rf node_modules package-lock.json
npm install
```

## ✅ Summary

After you publish to npm, users will be able to:

1. **Install**: `npm install jest-test-lineage-reporter --save-dev`
2. **Run**: `npx jest-lineage <command>`
3. **Use**: Works seamlessly on Windows, macOS, and Linux
4. **Integrate**: Easy to add to CI/CD pipelines

The `bin` field in package.json makes it all work automatically! 🎉
