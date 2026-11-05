import { expect, test } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

// Tests the built package in dist/ng-a11y (run `npm run build:lib` first; the
// Playwright web server command does this for you).
const dist = 'dist/ng-a11y';
const themeFiles = ['all', 'primitives', 'theme-light', 'theme-dark', 'theme-high-contrast', 'components'];

test.describe('published package contents', () => {
  test('ships every theme file and exposes them through exports', () => {
    for (const f of themeFiles) expect(existsSync(`${dist}/themes/${f}.css`), `${f}.css`).toBe(true);
    const pkg = JSON.parse(readFileSync(`${dist}/package.json`, 'utf8'));
    expect(pkg.exports['./themes/*']).toBe('./themes/*');
    expect(pkg.exports['.']).toBeDefined();
    expect(pkg.sideEffects).toEqual(['*.css']);
  });

  test('ships the license text and the changelog', () => {
    expect(readFileSync(`${dist}/LICENSE`, 'utf8')).toContain('Permission is hereby granted');
    expect(readFileSync(`${dist}/LICENSE`, 'utf8')).toContain('"AS IS"');
    expect(existsSync(`${dist}/CHANGELOG.md`)).toBe(true);
  });

  const expected = [
    { theme: 'light', bg: 'rgb(31, 41, 51)' },
    { theme: 'dark', bg: 'rgb(228, 231, 235)' },
    { theme: 'high-contrast', bg: 'rgb(255, 255, 255)' },
  ];

  for (const { theme, bg } of expected) {
    test(`themes/all.css resolves toast tokens for ${theme}`, async ({ page }) => {
      const css = readFileSync(`${dist}/themes/all.css`, 'utf8');
      await page.setContent(`<style>${css}</style><div id="probe" style="background: var(--a11y-toast-bg)">probe</div>`);
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await expect(page.locator('#probe')).toHaveCSS('background-color', bg);
    });
  }

  test('all.css has the cascade order the themes depend on', () => {
    const css = readFileSync(`${dist}/themes/all.css`, 'utf8');
    const at = (needle: string) => css.indexOf(needle);
    expect(at('--a11y-color-neutral-0:')).toBeGreaterThan(-1);
    expect(at('--a11y-color-neutral-0:')).toBeLessThan(at('[data-theme="light"]'));
    expect(at('[data-theme="light"]')).toBeLessThan(at('[data-theme="dark"]'));
    expect(at('[data-theme="dark"]')).toBeLessThan(at('[data-theme="high-contrast"]'));
    expect(at('[data-theme="high-contrast"]')).toBeLessThan(at('--a11y-toast-bg:'));
  });
});
