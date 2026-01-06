# GitHub Configuration

This directory contains GitHub-specific configuration files for the jest-test-lineage-reporter project.

## 📁 Directory Structure

```
.github/
├── workflows/
│   ├── publish.yml      # Automated NPM publishing on version tags
│   ├── ci.yml          # Continuous Integration tests
│   └── release.yml     # Create release PRs (manual)
├── ISSUE_TEMPLATE/
│   ├── bug_report.yml      # Bug report template
│   └── feature_request.yml # Feature request template
├── PUBLISHING.md       # Complete guide for publishing releases
└── README.md          # This file
```

## 🚀 Quick Start

### For Regular Development

Every push/PR automatically runs:
- Tests on Node.js 14, 16, 18, 20
- Tests on Ubuntu, Windows, macOS
- Package validation

No setup needed - just push your code!

### For Publishing New Versions

**Option 1: Automatic (Recommended)**
```bash
# Bump version and create tag
npm version patch  # or minor/major
git push origin main --tags

# GitHub Actions automatically:
# ✓ Runs tests
# ✓ Publishes to NPM
# ✓ Creates GitHub Release
```

**Option 2: Create Release PR**
1. Go to Actions → "Create Release PR"
2. Click "Run workflow"
3. Select version type (patch/minor/major)
4. Review and merge the PR
5. Tag and push to trigger publishing

## 📋 Workflows

### 🔄 CI Workflow (`ci.yml`)
**Triggers**: Push/PR to main or develop branches

**What it does**:
- Runs tests on multiple Node.js versions (14, 16, 18, 20)
- Tests on multiple OS (Ubuntu, Windows, macOS)
- Validates package structure
- Uploads coverage to Codecov

### 📦 Publish Workflow (`publish.yml`)
**Triggers**: Push of version tags (v*)

**What it does**:
- Runs full test suite
- Verifies version matches tag
- Checks if already published (prevents duplicates)
- Publishes to NPM with provenance
- Creates GitHub Release with notes

### 🏷️ Release Workflow (`release.yml`)
**Triggers**: Manual dispatch

**What it does**:
- Bumps version in package.json
- Updates CHANGELOG.md
- Creates a release PR for review
- Provides instructions for final publishing

## 🔑 Required Secrets

To use these workflows, configure the following GitHub secrets:

### NPM_TOKEN (Required for publishing)
1. Go to [npmjs.com](https://www.npmjs.com/) → Account Settings → Access Tokens
2. Generate new "Automation" token
3. Add to GitHub: Settings → Secrets → Actions → New secret
   - Name: `NPM_TOKEN`
   - Value: (your npm token)

### GITHUB_TOKEN (Automatic)
- Automatically provided by GitHub Actions
- Used for creating releases and comments

## 📝 Issue Templates

### Bug Report
Structured template for bug reports with:
- Environment details
- Reproduction steps
- Expected vs actual behavior

### Feature Request
Template for feature suggestions with:
- Problem statement
- Proposed solution
- Use cases
- Priority level

## 📚 Documentation

- **[PUBLISHING.md](./PUBLISHING.md)**: Complete guide for publishing releases
- **[../CHANGELOG.md](../CHANGELOG.md)**: Version history and release notes

## 🛠️ Customization

### Adding More Tests

Edit `ci.yml` to add more test scenarios:
```yaml
- name: Run custom test
  run: npm run test:custom
```

### Changing Publish Behavior

Edit `publish.yml` to customize:
- Node.js versions to test
- Release note format
- Pre-release detection logic

### Adding Workflows

Create new workflow files in `.github/workflows/`:
- Follow existing patterns
- Use descriptive names
- Document in this README

## 🐛 Troubleshooting

### Workflow not triggering?
- Check branch protection rules
- Verify workflow file syntax (YAML)
- Check GitHub Actions settings

### Tests failing?
- Check logs in Actions tab
- Run tests locally first
- Ensure dependencies are up to date

### Publishing fails?
- Verify NPM_TOKEN secret is set
- Check version isn't already published
- Ensure package.json version matches tag

## 📞 Getting Help

- Check workflow logs in GitHub Actions tab
- Review [PUBLISHING.md](./PUBLISHING.md) for detailed guide
- Open an issue if you need assistance

## 🎯 Best Practices

1. **Always run tests locally** before pushing
2. **Keep CHANGELOG.md updated** with changes
3. **Use semantic versioning** (major.minor.patch)
4. **Test pre-release versions** before stable releases
5. **Review CI logs** if tests fail

---

Last updated: 2024-01-06
