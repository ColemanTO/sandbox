# Releasing @colemanto/ng-a11y

Releases are published by GitHub Actions when a version tag is pushed. There is no npm token to
store or rotate: npm "trusted publishing" lets the workflow prove its identity, and every release
gets a provenance statement linking the package to this repository and commit.

## One-time setup

1. On npmjs.com open the package: **@colemanto/ng-a11y → Settings → Trusted publisher → GitHub Actions**.
2. Fill in:
   - Organization or user: `ColemanTO`
   - Repository: `sandbox`
   - Workflow filename: `release.yml`
   - Environment: leave blank
3. Save. (npm may ask for your 2FA.)
4. Optional hardening: in the package's **Publishing access** settings, choose
   "Require two-factor authentication and disallow tokens", so the workflow is the only way to publish.

If you rename this repository later, update the trusted publisher entry and the `repository`
field in `projects/ng-a11y/package.json`; both must match the repository that runs the workflow.

## Releasing a version

1. Change `version` in `projects/ng-a11y/package.json` (semver; use `0.2.0-beta.1` style for pre-releases).
2. Commit and push to `main`, and wait for CI to pass:
   ```bash
   git commit -am "Release 0.1.1"
   git push origin main
   ```
3. Tag that commit and push the tag:
   ```bash
   git tag -a v0.1.1 -m "@colemanto/ng-a11y 0.1.1"
   git push origin v0.1.1
   ```

The Release workflow then:

1. Reruns all CI checks (token contrast check, unit and axe tests, Playwright in Chromium and WebKit).
2. Refuses to continue if the tag is not on `main`, does not match the package version, the `repository`
   field does not match this repo, or that version is already on npm.
3. Builds the tokens and library, and runs `npm publish --provenance`. Pre-release versions go to the
   `next` dist-tag, never `latest`.
4. Creates a GitHub release with generated notes.

## If a release fails

- **Tests failed:** fix on `main`, then delete and recreate the tag on the new commit
  (`git push --delete origin v0.1.1`, `git tag -d v0.1.1`, tag again). Nothing was published.
- **Publish failed after tests passed:** check the trusted publisher settings above. Re-run the failed
  workflow from the Actions tab once fixed.
- **Never reuse a version number** that reached npm; bump to the next patch instead.
