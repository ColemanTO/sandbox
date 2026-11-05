import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';


// Records every non-empty text written to the hidden live regions, so tests can check what a screen reader is
// told (and that it is told once, as one piece) without depending on how long the text stays on screen.
const recordAnnouncements = (page: Page) =>
  page.evaluate(() => {
    const spoken: Record<string, string[]> = { polite: [], assertive: [] };
    (window as unknown as { __spoken: typeof spoken }).__spoken = spoken;
    document.querySelectorAll('.a11y-announcer').forEach((el) => {
      const kind = el.getAttribute('aria-live')!;
      new MutationObserver(() => {
        const text = el.textContent!.trim();
        if (text) spoken[kind].push(text);
      }).observe(el, { childList: true, characterData: true, subtree: true });
    });
  });
const spoken = (page: Page, kind: 'polite' | 'assertive') =>
  page.evaluate((k) => (window as unknown as { __spoken: Record<string, string[]> }).__spoken[k], kind);

const press = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();

test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
});

test.describe('live regions', () => {
  test('both hidden live regions exist before any toast is shown', async ({ page }) => {
    await expect(page.locator('.a11y-announcer[aria-live="polite"]')).toBeAttached();
    await expect(page.locator('.a11y-announcer[aria-live="assertive"]')).toBeAttached();
  });

  test('errors are announced in the assertive region', async ({ page }) => {
    await recordAnnouncements(page);
    await press(page, 'Error (assertive)');
    await expect.poll(() => spoken(page, 'assertive')).toEqual(['Error: Could not save your changes.']);
    expect(await spoken(page, 'polite')).toEqual([]);
  });

  test('success, info and warning are announced politely, one after another', async ({ page }) => {
    await recordAnnouncements(page);
    await press(page, 'Success');
    await press(page, 'Info');
    await press(page, 'Warning');
    await expect.poll(() => spoken(page, 'polite')).toEqual([
      'Success: Your changes were saved.',
      'Information: Heads up: this is informational.',
      'Warning: Your session expires soon.',
    ]);
    // ...while the visible toasts are all there, in the order they were shown.
    await expect(page.locator('a11y-toast-item')).toHaveCount(3);
  });

  test('a toast is announced once, as one piece of text, not built up piece by piece', async ({ page }) => {
    await recordAnnouncements(page);
    await press(page, 'Success');
    await expect.poll(() => spoken(page, 'polite')).toEqual(['Success: Your changes were saved.']);
    await page.waitForTimeout(800); // anything that would repeat it has had time to
    expect(await spoken(page, 'polite')).toEqual(['Success: Your changes were saved.']);
  });

  test('a toast with an action says that an action is available', async ({ page }) => {
    await recordAnnouncements(page);
    await press(page, 'With action (persistent)');
    await expect
      .poll(() => spoken(page, 'polite'))
      .toEqual(['Information: Item deleted. Action available: Undo.']);
  });

  test('the visible toasts sit in a "Notifications" landmark that exists only while toasts show', async ({ page }) => {
    const landmark = page.getByRole('region', { name: 'Notifications' });
    await expect(landmark).toHaveCount(0);
    await press(page, 'With action (persistent)');
    await expect(landmark).toBeVisible();
    await expect(landmark.locator('a11y-toast-item')).toHaveCount(1);
    await page.getByRole('button', { name: 'Dismiss notification' }).click();
    await expect(landmark).toHaveCount(0);
  });

  test('the visible toasts are not live regions, and nothing on the page is a status or alert role', async ({ page }) => {
    await press(page, 'Success');
    await expect(page.locator('a11y-toast-item')).toBeVisible();
    await expect(page.locator('.a11y-toast-region')).not.toHaveAttribute('aria-live', /.*/);
    await expect(page.locator('[role="status"], [role="alert"]')).toHaveCount(0);
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

  test('a toast with an action is still there after a long time, with no duration set', async ({ page }) => {
    await press(page, 'With action (persistent)');
    await page.clock.runFor(10 * 60_000);
    await expect(page.locator('a11y-toast-item', { hasText: 'Item deleted.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
  });

  test('action runs, then dismisses its toast', async ({ page }) => {
    await press(page, 'With action (persistent)');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.locator('a11y-toast-item', { hasText: 'Item deleted.' })).toHaveCount(0);
    await expect(page.locator('a11y-toast-item', { hasText: 'Deletion undone.' })).toBeVisible();
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
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
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
    await page.getByRole('button', { name: 'With action (persistent)' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('a11y-toast-item')).toBeVisible();
    // The toast is last in the page, so move into it from the button the user came from.
    await page.getByRole('button', { name: 'Dismiss notification' }).focus();
    await expect(page.getByRole('button', { name: 'Dismiss notification' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('a11y-toast-item')).toHaveCount(0);
    expect(await activeLabel(page)).toBe('With action (persistent)');
  });

  test('closing with the keyboard keeps focus on the page, not the body', async ({ page }) => {
    await page.getByRole('button', { name: 'Error (assertive)' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('a11y-toast-item')).toBeVisible();
    await page.getByRole('button', { name: 'Dismiss notification' }).focus();
    await expect(page.getByRole('button', { name: 'Dismiss notification' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('a11y-toast-item')).toHaveCount(0);
    expect(await activeLabel(page)).not.toBe('BODY');
  });

  test('Undo returns focus and the result is announced', async ({ page }) => {
    await recordAnnouncements(page);
    await page.getByRole('button', { name: 'With action (persistent)' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('a11y-toast-item')).toBeVisible();
    await page.getByRole('button', { name: 'Undo', exact: true }).focus();
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(() => spoken(page, 'polite')).toContain('Success: Deletion undone.');
    expect(await activeLabel(page)).not.toBe('BODY');
  });

  test('says "Notification dismissed" when the user dismisses, but not when it times out', async ({ page }) => {
    await recordAnnouncements(page);
    await press(page, 'Success');
    await page.clock.runFor(6000); // times out
    await expect(page.locator('a11y-toast-item')).toHaveCount(0);
    expect(await spoken(page, 'polite')).not.toContain('Notification dismissed');
    await press(page, 'Info');
    await page.getByRole('button', { name: 'Dismiss notification' }).click();
    await expect.poll(() => spoken(page, 'polite')).toContain('Notification dismissed');
  });

  test('the announcer is hidden visually but available to screen readers', async ({ page }) => {
    for (const kind of ['polite', 'assertive']) {
      const announcer = page.locator(`.a11y-announcer[aria-live="${kind}"]`);
      await expect(announcer).not.toHaveAttribute('aria-hidden', /.*/);
      const box = await announcer.boundingBox();
      expect(box!.width).toBeLessThanOrEqual(1);
    }
  });
});
