import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';

const press = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();

test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
});

test.describe('live regions', () => {
  test('both regions exist before any toast is shown', async ({ page }) => {
    await expect(page.getByRole('status')).toBeAttached();
    await expect(page.getByRole('alert')).toBeAttached();
  });

  test('errors are announced in the assertive alert region', async ({ page }) => {
    await press(page, 'Error (assertive)');
    await expect(page.getByRole('alert')).toContainText('Error: Could not save your changes.');
    await expect(page.getByRole('status')).not.toContainText('Could not save');
  });

  test('success, info and warning use the polite status region', async ({ page }) => {
    await press(page, 'Success');
    await press(page, 'Info');
    await press(page, 'Warning');
    const status = page.getByRole('status');
    await expect(status).toContainText('Success: Your changes were saved.');
    await expect(status).toContainText('Information: Heads up: this is informational.');
    await expect(status).toContainText('Warning: Your session expires soon.');
  });
});

test.describe('timing', () => {
  // The installed clock also advances in real time, so leave generous margins
  // around the 5s default instead of asserting on the exact boundary.
  test('auto-dismisses after the default 5 seconds', async ({ page }) => {
    await press(page, 'Success');
    const toast = page.locator('a11y-toast-item');
    await expect(toast).toBeVisible();
    await page.clock.runFor(2000);
    await expect(toast).toBeVisible();
    await page.clock.runFor(4000);
    await expect(toast).toHaveCount(0);
  });

  test('pauses while hovered and resumes after', async ({ page }) => {
    await press(page, 'Success');
    const toast = page.locator('a11y-toast-item');
    await toast.hover();
    await page.clock.runFor(20_000);
    await expect(toast).toBeVisible();
    await page.mouse.move(0, 0);
    await page.clock.runFor(5100);
    await expect(toast).toHaveCount(0);
  });

  test('pauses while keyboard focus is inside it', async ({ page }) => {
    await press(page, 'Success');
    await page.getByRole('button', { name: 'Dismiss notification' }).focus();
    await page.clock.runFor(20_000);
    await expect(page.locator('a11y-toast-item')).toBeVisible();
  });
});

test.describe('keyboard and actions', () => {
  test('Escape dismisses the focused toast', async ({ page }) => {
    await press(page, 'Error (assertive)');
    await page.getByRole('button', { name: 'Dismiss notification' }).focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('a11y-toast-item')).toHaveCount(0);
  });

  test('close button dismisses and a persistent toast stays until then', async ({ page }) => {
    await press(page, 'With action (persistent)');
    await page.clock.runFor(60_000);
    const toast = page.locator('a11y-toast-item');
    await expect(toast).toContainText('Item deleted.');
    await page.getByRole('button', { name: 'Dismiss notification' }).click();
    await expect(toast).toHaveCount(0);
  });

  test('action runs, then dismisses its toast', async ({ page }) => {
    await press(page, 'With action (persistent)');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.locator('a11y-toast-item', { hasText: 'Item deleted.' })).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('Deletion undone.');
  });

  test('toast controls are reachable by Tab and have a visible focus indicator', async ({ page }) => {
    await press(page, 'With action (persistent)');
    const undo = page.getByRole('button', { name: 'Undo', exact: true });
    await undo.focus();
    await page.keyboard.press('Tab');
    const close = page.getByRole('button', { name: 'Dismiss notification' });
    await expect(close).toBeFocused();
    const outline = await close.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');
  });
});

test.describe('presentation', () => {
  test('respects prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await press(page, 'Info');
    const animation = await page.locator('a11y-toast-item').evaluate((el) => getComputedStyle(el).animationName);
    expect(animation).toBe('none');
  });

  test('can be themed with CSS custom properties from outside', async ({ page }) => {
    await page.addStyleTag({ content: ':root { --a11y-toast-bg: rgb(10, 20, 30); --a11y-toast-error: rgb(1, 2, 3); }' });
    await press(page, 'Error (assertive)');
    const toast = page.locator('a11y-toast-item');
    await expect(toast).toHaveCSS('background-color', 'rgb(10, 20, 30)');
    await expect(toast).toHaveCSS('border-inline-start-color', 'rgb(1, 2, 3)');
  });

  test('stays inside a phone-sized viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await press(page, 'With action (persistent)');
    const box = await page.locator('a11y-toast-item').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
});

test.describe('axe (real browser, includes color contrast)', () => {
  test('no violations with every toast type and an action showing', async ({ page }) => {
    for (const name of ['Info', 'Success', 'Warning', 'Error (assertive)', 'With action (persistent)']) {
      await press(page, name);
    }
    await expect(page.locator('a11y-toast-item')).toHaveCount(5);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});

// Toast background per theme, from tokens/themes/*.json (inverse-surface).
const themes = [
  { name: 'light', toastBg: 'rgb(31, 41, 51)', pageBg: 'rgb(255, 255, 255)' },
  { name: 'dark', toastBg: 'rgb(228, 231, 235)', pageBg: 'rgb(18, 24, 31)' },
  { name: 'high-contrast', toastBg: 'rgb(255, 255, 255)', pageBg: 'rgb(0, 0, 0)' },
] as const;

const showEveryToast = async (page: Page) => {
  for (const name of ['Info', 'Success', 'Warning', 'Error (assertive)', 'With action (persistent)']) {
    await press(page, name);
  }
  await expect(page.locator('a11y-toast-item')).toHaveCount(5);
};

test.describe('themes', () => {
  for (const theme of themes) {
    test.describe(theme.name, () => {
      test.beforeEach(async ({ page }) => {
        // No slide-in: axe must not sample colors mid-animation.
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.getByLabel('Theme').selectOption(theme.name);
      });

      test('applies the theme to the page and the toast', async ({ page }) => {
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme.name);
        await expect(page.locator('body')).toHaveCSS('background-color', theme.pageBg);
        await press(page, 'Info');
        await expect(page.locator('a11y-toast-item')).toHaveCSS('background-color', theme.toastBg);
      });

      test('has no axe violations, including color contrast', async ({ page }) => {
        await showEveryToast(page);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
          .analyze();
        expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      });
    });
  }

  test('"System" follows the OS dark setting', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(18, 24, 31)');
  });

  test('"System" follows the OS increased-contrast setting', async ({ page }) => {
    await page.emulateMedia({ contrast: 'more' });
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  });

  test('an explicit theme wins over the OS setting', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.getByLabel('Theme').selectOption('light');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  });

  test('a theme set on a subtree reaches the toast tokens', async ({ page }) => {
    await page.evaluate(() => {
      const el = document.createElement('div');
      el.id = 'probe';
      el.dataset['theme'] = 'dark';
      el.style.cssText = 'background: var(--a11y-toast-bg)';
      el.textContent = 'probe';
      document.body.append(el);
    });
    await expect(page.locator('#probe')).toHaveCSS('background-color', 'rgb(228, 231, 235)');
  });
});

test.describe('dark mode switch', () => {
  const darkSwitch = (page: Page) => page.getByRole('switch', { name: 'Dark mode' });

  test('is a labelled switch that starts off in a light OS', async ({ page }) => {
    await expect(darkSwitch(page)).toBeVisible();
    await expect(darkSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
  });

  test('starts on when the OS prefers dark, and tracks OS changes', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(darkSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(darkSwitch(page)).toHaveAttribute('aria-checked', 'false');
  });

  test('click toggles dark and light, restyles the page and toast, and syncs the Theme menu', async ({ page }) => {
    await darkSwitch(page).click();
    await expect(darkSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(18, 24, 31)');
    await expect(page.getByLabel('Theme')).toHaveValue('dark');
    await press(page, 'Info');
    await expect(page.locator('a11y-toast-item')).toHaveCSS('background-color', 'rgb(228, 231, 235)');

    await darkSwitch(page).click();
    await expect(darkSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.getByLabel('Theme')).toHaveValue('light');
  });

  test('works from the keyboard with Space and Enter', async ({ page }) => {
    await darkSwitch(page).focus();
    await page.keyboard.press('Space');
    await expect(darkSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Enter');
    await expect(darkSwitch(page)).toHaveAttribute('aria-checked', 'false');
  });

  test('stays in step when the Theme menu changes', async ({ page }) => {
    await page.getByLabel('Theme').selectOption('dark');
    await expect(darkSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await page.getByLabel('Theme').selectOption('light');
    await expect(darkSwitch(page)).toHaveAttribute('aria-checked', 'false');
  });

  test('is disabled with an explanation in high contrast', async ({ page }) => {
    await page.getByLabel('Theme').selectOption('high-contrast');
    await expect(darkSwitch(page)).toBeDisabled();
    await expect(darkSwitch(page)).toHaveAccessibleDescription('Not available in high contrast.');
    await page.getByLabel('Theme').selectOption('light');
    await expect(darkSwitch(page)).toBeEnabled();
  });

  test('remembers the choice after a reload', async ({ page }) => {
    await darkSwitch(page).click();
    await page.reload();
    await expect(darkSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('has a visible focus indicator', async ({ page }) => {
    await darkSwitch(page).focus();
    const outline = await darkSwitch(page).evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');
  });

  for (const state of ['off', 'on'] as const) {
    test(`has no axe violations with the switch ${state}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      if (state === 'on') await darkSwitch(page).click();
      await expect(darkSwitch(page)).toHaveAttribute('aria-checked', state === 'on' ? 'true' : 'false');
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });
  }
});

test.describe('dismissing never leaves a screen reader stranded', () => {
  const activeLabel = (page: Page) =>
    page.evaluate(() => {
      const a = document.activeElement as HTMLElement;
      return a === document.body ? 'BODY' : (a.getAttribute('aria-label') ?? a.textContent ?? '').trim();
    });

  test('Escape returns focus to the button the user came from', async ({ page }) => {
    await page.getByRole('button', { name: 'Success', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('a11y-toast-item')).toBeVisible();
    // Tab from the last demo button into the toast.
    await page.getByRole('button', { name: 'With action (persistent)' }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Dismiss notification' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('a11y-toast-item')).toHaveCount(0);
    expect(await activeLabel(page)).toBe('With action (persistent)');
  });

  test('closing with the keyboard keeps focus on the page, not the body', async ({ page }) => {
    await page.getByRole('button', { name: 'Error (assertive)' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('a11y-toast-item')).toBeVisible();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Dismiss notification' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('a11y-toast-item')).toHaveCount(0);
    expect(await activeLabel(page)).not.toBe('BODY');
  });

  test('Undo returns focus and the result is announced', async ({ page }) => {
    await page.getByRole('button', { name: 'With action (persistent)' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('a11y-toast-item')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toContainText('Deletion undone.');
    expect(await activeLabel(page)).not.toBe('BODY');
  });

  test('says "Notification dismissed" when the user dismisses, but not when it times out', async ({ page }) => {
    const announcer = page.locator('.a11y-announcer');
    await press(page, 'Success');
    await page.clock.runFor(6000); // times out
    await expect(page.locator('a11y-toast-item')).toHaveCount(0);
    await expect(announcer).toHaveText('');
    await press(page, 'Info');
    await page.getByRole('button', { name: 'Dismiss notification' }).click();
    await expect(announcer).toHaveText('Notification dismissed');
  });

  test('the announcer is hidden visually but available to screen readers', async ({ page }) => {
    const announcer = page.locator('.a11y-announcer');
    await expect(announcer).toHaveAttribute('aria-live', 'polite');
    await expect(announcer).not.toHaveAttribute('aria-hidden', /.*/);
    const box = await announcer.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(1);
  });
});
