# Release Process

This project uses GitHub Actions to automate the release process to npm.

## How to Create a Release

### 1. Update version in package.json

```bash
npm version patch|minor|major
```

This command will:
- Update version in package.json
- Create a git tag
- Commit the changes

Examples:
```bash
npm version patch    # 1.0.0 → 1.0.1
npm version minor    # 1.0.0 → 1.1.0
npm version major    # 1.0.0 → 2.0.0
```

### 2. Push to GitHub

```bash
git push origin main
git push origin --tags
```

### 3. GitHub Actions Workflow

When you push a tag (e.g., `v1.0.1`), the release workflow will:

1. ✅ Checkout code
2. ✅ Setup Node.js 18
3. ✅ Install dependencies
4. ✅ Run type checks
5. ✅ Build the project
6. ✅ Publish to npm
7. ✅ Create a GitHub release

## Setup Required

### 1. Create NPM Token

1. Go to https://www.npmjs.com/settings/tokens
2. Create new "Automation" token
3. Copy the token

### 2. Add to GitHub Secrets

1. Go to your repo: Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `NPM_TOKEN`
4. Value: (paste your npm token)

### 3. Verify Permissions

Make sure your npm account has permissions to publish `k6-perf-reporter`

## Manual Release (Alternative)

If you need to publish manually:

```bash
npm login
npm publish
```

## Release Types

| Command | Before | After | Use Case |
| --- | --- | --- | --- |
| `npm version patch` | 1.0.0 | 1.0.1 | Bug fixes |
| `npm version minor` | 1.0.0 | 1.1.0 | New features |
| `npm version major` | 1.0.0 | 2.0.0 | Breaking changes |

## Release Checklist

- [ ] Review all commits since last release
- [ ] Update CHANGELOG.md (optional)
- [ ] Test the build locally: `npm run build`
- [ ] Run tests: `npm run type-check`
- [ ] Bump version: `npm version patch|minor|major`
- [ ] Push to GitHub: `git push origin main --tags`
- [ ] Check GitHub Actions workflow completes
- [ ] Verify on npm: https://www.npmjs.com/package/k6-perf-reporter
- [ ] Create GitHub Release with changelog

## Workflow Files

- `.github/workflows/release.yml` - Publishes to npm on tag push
- `.github/workflows/ci.yml` - Runs tests on push/PR to main/develop

## Troubleshooting

### Publish failed with authentication error

- [ ] Check NPM_TOKEN is set in GitHub secrets
- [ ] Verify token is still valid (tokens expire)
- [ ] Token should be "Automation" type, not "Read-only"

### Version already published

The tag and release were created but npm publish failed. To retry:

```bash
npm publish
```

Or delete the tag and try again:

```bash
git tag -d v1.0.1
git push origin :v1.0.1
npm version patch
git push origin main --tags
```

### Build failed in GitHub Actions

Check the workflow log in Actions tab. Common issues:
- Node version mismatch
- Missing dependencies
- TypeScript errors

Fix locally first:
```bash
npm ci
npm run type-check
npm run build
```

## CI/CD Features

### Continuous Integration (ci.yml)

Runs on every push and PR to `main` and `develop`:
- Tests on Node.js 16, 18, 20 (matrix)
- Type checking
- Linting
- Build verification
- Dist folder validation

### Release (release.yml)

Runs only on version tags (v1.0.0, v1.1.0, etc):
- Publishes to npm
- Creates GitHub Release
- Generates release notes

## Next Steps

1. Set up NPM_TOKEN secret in GitHub
2. Create your first release:
   ```bash
   npm version patch
   git push origin main --tags
   ```
3. Monitor the GitHub Actions workflow
4. Check npm package: https://www.npmjs.com/package/k6-perf-reporter
