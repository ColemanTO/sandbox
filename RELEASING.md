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

## Publishing Storybook to the demos site

The Deploy Storybook workflow (`.github/workflows/deploy-storybook.yml`) builds the Storybook static site and
uploads it over SSH to `demos.coleman-creative.com/ng-a11y/`. It runs on every push to `main`, after the CI
checks pass, and can be run by hand from the Actions tab (**Deploy Storybook → Run workflow**).

It only ever writes inside the `ng-a11y` folder of the demos site. Other demos next to it are not touched.

### One-time setup

1. Generate a deploy key for this repo. Do not reuse a personal key or another project's deploy key:
   ```bash
   ssh-keygen -t ed25519 -C "sandbox-storybook-deploy" -f deploy_key -N ""
   ```
2. In the Bluehost control panel, under **SSH Access → Manage SSH Keys**, import `deploy_key.pub` and
   authorize it.
3. In this GitHub repo, under **Settings → Environments**, create an environment named `demos` and add
   these secrets to it:
   - `SSH_HOST`, `SSH_PORT`, `SSH_USER`: from the control panel's SSH Access page. Bluehost shared hosting
     usually uses port `2222`.
   - `SSH_PRIVATE_KEY`: the contents of `deploy_key` (the private half).
   - `DEPLOY_PATH`: the absolute path of the folder that `demos.coleman-creative.com` serves. The workflow
     adds `/ng-a11y` to it.
4. Delete the local `deploy_key` and `deploy_key.pub` files once the secret is saved.
5. Merge to `main`, or run the workflow by hand, and check the run in the Actions tab.

### If a deploy fails

- **"Secret ... is not set":** the `demos` environment is missing that secret.
- **Upload failed three times:** the host refused the connection. Check the key is still authorized, then
  re-run the workflow. Running it again is safe; only files that differ are sent.
