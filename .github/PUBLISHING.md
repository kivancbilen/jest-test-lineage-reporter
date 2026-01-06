# Publishing Guide

This guide explains how to publish new versions of `jest-test-lineage-reporter` to NPM.

## Prerequisites

Before you can publish, you need to:

1. **Set up NPM_TOKEN secret in GitHub**
   - Go to [npmjs.com](https://www.npmjs.com/) and log in
   - Go to Account Settings → Access Tokens → Generate New Token
   - Choose "Automation" token type
   - Copy the token
   - Go to your GitHub repository → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: (paste your npm token)
   - Click "Add secret"

2. **Ensure you have write access** to the GitHub repository

## Publishing Process

### Automated Publishing (Recommended)

The workflow automatically publishes when you push a version tag:

```bash
# 1. Update version in package.json
npm version patch  # or minor, or major
# This creates a commit and tag like v2.0.3

# 2. Push the tag to GitHub
git push origin main --tags

# 3. GitHub Actions will automatically:
#    - Run tests on Node 14, 16, 18, 20
#    - Verify version matches tag
#    - Publish to NPM
#    - Create a GitHub Release
```

### Version Types

```bash
# Patch: bug fixes (2.0.2 → 2.0.3)
npm version patch

# Minor: new features, backward compatible (2.0.3 → 2.1.0)
npm version minor

# Major: breaking changes (2.1.0 → 3.0.0)
npm version major

# Pre-release versions
npm version prepatch --preid=beta  # 2.0.3 → 2.0.4-beta.0
npm version prerelease --preid=beta  # 2.0.4-beta.0 → 2.0.4-beta.1
```

### Manual Publishing

You can also trigger publishing manually from GitHub:

1. Go to **Actions** tab in GitHub
2. Click **Publish to NPM** workflow
3. Click **Run workflow**
4. Choose:
   - Branch: `main`
   - Tag: `latest` (or `beta`, `next`, etc.)
5. Click **Run workflow**

## Publishing Workflow

The `publish.yml` workflow does the following:

1. **Test Stage**
   - Runs tests on Node.js 14, 16, 18, 20
   - Ensures package quality before publishing

2. **Publish Stage**
   - Extracts version from git tag
   - Verifies package.json version matches tag
   - Checks if version already published (prevents duplicates)
   - Publishes to NPM with provenance
   - Creates GitHub Release with notes

## Publishing Different Tags

### Latest (Stable Release)
```bash
npm version patch
git push origin main --tags
# Publishes as: npm install jest-test-lineage-reporter@latest
```

### Beta Release
```bash
npm version prerelease --preid=beta
git push origin main --tags
# Publishes as: npm install jest-test-lineage-reporter@beta
```

### Next/Canary Release
```bash
# For experimental features
npm version prerelease --preid=next
git push origin main --tags
# Install with: npm install jest-test-lineage-reporter@next
```

## Continuous Integration

The `ci.yml` workflow runs on every push and PR:

- Tests on Ubuntu, Windows, macOS
- Multiple Node.js versions (14, 16, 18, 20)
- Validates package structure
- Uploads coverage to Codecov

## Troubleshooting

### Error: "Version already published"
This means the version already exists on NPM. Update the version:
```bash
npm version patch
git push origin main --tags
```

### Error: "Version mismatch"
The version in `package.json` doesn't match the git tag. Fix it:
```bash
# Edit package.json to match the tag version
git add package.json
git commit --amend --no-edit
git tag -f v2.0.3  # Force update tag
git push origin main --tags --force
```

### Error: "Unauthorized"
Your NPM_TOKEN is missing or invalid:
1. Generate a new token on npmjs.com
2. Update the GitHub secret

### Tests failing
Fix the tests before publishing:
```bash
npm run test:fast
npm run validate
```

## Best Practices

1. **Always run tests locally first**
   ```bash
   npm run test:fast
   npm run validate
   ```

2. **Update CHANGELOG.md** before releasing
   - Document all changes
   - Follow [Keep a Changelog](https://keepachangelog.com/) format

3. **Use semantic versioning**
   - MAJOR: Breaking changes
   - MINOR: New features (backward compatible)
   - PATCH: Bug fixes

4. **Test pre-release versions** before stable release
   ```bash
   # Publish beta first
   npm version prerelease --preid=beta
   git push origin main --tags

   # Test it thoroughly
   npm install jest-test-lineage-reporter@beta

   # Then publish stable
   npm version patch
   git push origin main --tags
   ```

5. **Write clear release notes**
   - The workflow auto-creates releases
   - Edit them to add more details about changes

## Post-Publishing Checklist

After a successful publish:

- [ ] Verify package on [npmjs.com](https://www.npmjs.com/package/jest-test-lineage-reporter)
- [ ] Test installation: `npm install jest-test-lineage-reporter@latest`
- [ ] Check GitHub Release notes
- [ ] Update documentation if needed
- [ ] Announce on social media/Discord/Slack (if applicable)

## Emergency: Unpublishing

If you need to unpublish a version (within 72 hours):

```bash
# Unpublish specific version
npm unpublish jest-test-lineage-reporter@2.0.3

# Note: This is discouraged by npm
# Better to publish a new patch version with fixes
```

## Questions?

- Check [GitHub Actions logs](../../actions) for detailed error messages
- Review [NPM documentation](https://docs.npmjs.com/cli/v9/commands/npm-publish)
- Open an issue if you need help
