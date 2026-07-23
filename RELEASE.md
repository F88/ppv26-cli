---
lang: en
title: Release Guide
title-en: Release Guide
title-ja: リリースガイド
related:
    - ./README.md "Project Overview"
    - ./DEVELOPMENT.md "Development Guide"
    - ./CHANGELOG.md "Changelog"
instructions-for-ais:
    - This document should be written in English for AI readability.
    - Content within code fences may be written in languages other than English.
    - Prohibit updating this front-matter.
    - Prohibit updating title line (1st line) in this document.
---

# Release Guide

This document describes the release procedures for package maintainers.

**Package Distribution:** This package is published to
[npmjs.com](https://www.npmjs.com/package/ppv26-cli) (`ppv26-cli`).

Releases are automatically published when a GitHub Release is created.

## Conventions

- The release commit (version bump + CHANGELOG) is pushed **directly to
  `main`** - no pull request is needed for release commits. All other
  changes go through pull requests as usual.
- Commit message format: `chore(release): x.y.z`
  ([Conventional Commits](https://www.conventionalcommits.org/)).
- Tag format: annotated tag `vx.y.z` with message `Release vx.y.z`.
- Force-pushing is never allowed (also enforced by a repository
  ruleset). If something went wrong, fix it with a follow-up commit or
  a new patch release, not by rewriting history.
- Commit messages, CHANGELOG entries, and Release notes are written in
  English.

## Release Procedures

### 1. Pre-Release Checklist

Execute all of the following checks before releasing:

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

Ensure all checks pass, and that the latest CI run on `main` is green.

### 2. Version Update

Update the version following Semantic Versioning:

- **MAJOR** (x.0.0): Breaking changes
- **MINOR** (0.x.0): New features (backward compatible)
- **PATCH** (0.0.x): Bug fixes

```bash
npm version patch --no-git-tag-version  # or minor, major
```

This updates both `package.json` and `package-lock.json` (the root
`version` and `packages[""].version` entries) in one step.

If you edited `package.json` manually instead, sync the lockfile with:

```bash
npm install --package-lock-only
```

> **Note:** No source file carries the version. `package.json` is the
> single source of truth: `ppv-cli` reads it at runtime, and the bundled
> `ppex` / `pptop` binaries get it baked in at build time via an esbuild
> define (see `src/core/version.ts`). The publish workflow builds after
> checkout, so the published binaries always match the release commit.

### 3. Update CHANGELOG.md

Move the `[Unreleased]` content into a new `## [x.y.z] - YYYY-MM-DD`
section (Keep a Changelog format), leaving an empty `## [Unreleased]`
heading on top.

### 4. Commit and Create Tag

The release commit is pushed directly to `main` (no PR) by convention.

```bash
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore(release): x.y.z"

git tag -a vx.y.z -m "Release vx.y.z"

git push origin main
git push origin vx.y.z
```

The tag must be `v` + the exact `package.json` version: the publish
workflow publishes whatever `package.json` says, so a mismatched tag
silently ships a different version number than the tag suggests.

### 5. Create GitHub Release

1. Navigate to the repository's Releases page
2. Click "Draft a new release"
3. Select tag: `vx.y.z`
4. Enter release title: `vx.y.z`
5. Copy the relevant version content from CHANGELOG.md
6. Click "Publish release"

**Automated Publishing:** When the release is published, the
[GitHub Actions workflow](.github/workflows/publish-package-to-npmjs.yml)
automatically:

1. Runs typecheck, format check, lint, and tests (build job)
2. Builds the package and publishes to npmjs.com via Trusted Publishing
   (OIDC) with provenance (publish job)

No manual `npm publish` is required. Verify the result with:

```bash
npm view ppv26-cli version
```

> Trusted Publishing requires npm 11.5.1 or later, which the workflow
> provisions.

## Troubleshooting

### Release Workflow Failed

If the GitHub Actions workflow fails:

1. Check the workflow run logs in the "Actions" tab
2. Verify `package.json` version matches the release tag
3. Verify `package.json` has `"prepublishOnly": "npm run build"` (a
   publish-blocking guard here fails the publish by design)
4. Ensure all CI checks passed before creating the release
5. Verify the Trusted Publishing configuration on npmjs (the package's
   trusted publisher must reference this repository and the
   `publish-package-to-npmjs.yml` workflow filename)

### Tag Already Exists

If you need to recreate a tag:

```bash
# Delete local tag
git tag -d vx.y.z

# Delete remote tag
git push origin :refs/tags/vx.y.z

# Create new tag
git tag -a vx.y.z -m "Release vx.y.z"
git push origin vx.y.z
```

## References

- [Semantic Versioning](https://semver.org/)
- [GitHub Releases Documentation](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [npm Trusted Publishers](https://docs.npmjs.com/trusted-publishers)
