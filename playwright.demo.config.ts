import { defineConfig, devices } from '@playwright/test';

/**
 * Sprint demo videos (see .claude/skills/sprint-demo). Kept apart from playwright.config.ts so the regular e2e run
 * never plays them. Run one with: npx playwright test -c playwright.demo.config.ts sprint-5
 */
export default defineConfig({
  testDir: './demo',
  testMatch: '**/*.demo.ts',
  outputDir: './demo/output/test-results',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 5 * 60_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:6006',
    actionTimeout: 15_000,
    // Headed with DEMO_HEADED=1 to watch it; recording works either way.
    headless: process.env['DEMO_HEADED'] !== '1',
  },
  projects: [
    {
      name: 'demo',
      // Installed Chrome; the screencast and the WebCodecs encoder need Chromium.
      use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1280, height: 720 } },
    },
  ],
  webServer: {
    command: 'npm run tokens && npx ng run sandbox:storybook --no-open',
    url: 'http://localhost:6006',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
