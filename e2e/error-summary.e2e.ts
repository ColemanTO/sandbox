import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';

const submit = (page: Page) => page.getByRole('button', { name: 'Create account' });
const summary = (page: Page) => page.getByRole('group', { name: 'There is a problem' });
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });

const fillValid = async (page: Page) => {
  await field(page, 'Full name').fill('Tom Coleman');
  await field(page, 'Email').fill('tom@example.com');
  await field(page, 'Password').fill('longenough1');
  await field(page, 'I agree to the terms').check();
};

const ALL_MESSAGES = [
  'Enter your full name',
  'Enter your email address',
  'Enter a password',
  'Agree to the terms to continue',
];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('showing the summary', () => {
  test('is not there before a submit, even though the form is invalid', async ({ page }) => {
    await expect(summary(page)).toHaveCount(0);
  });

  test('a valid submit shows no summary, even though the app then resets the form', async ({ page }) => {
    await fillValid(page);
    await submit(page).click();
    await expect(page.locator('a11y-toast-item', { hasText: 'Account created.' })).toBeVisible();
    await expect(field(page, 'Full name')).toHaveValue(''); // the demo reset the form, so required fields are invalid again
    await expect(summary(page)).toHaveCount(0);
  });

  test('stays quiet after a fix even if a field is cleared again', async ({ page }) => {
    await submit(page).click();
    await expect(summary(page)).toBeVisible();
    await fillValid(page);
    await expect(summary(page)).toHaveCount(0);
    await field(page, 'Full name').fill('');
    await expect(summary(page)).toHaveCount(0);
  });

  test('a failed submit lists every invalid field in page order with the app\'s messages', async ({ page }) => {
    await submit(page).click();
    await expect(summary(page).getByRole('link')).toHaveText(ALL_MESSAGES);
  });

  test('uses the message for the validator that failed', async ({ page }) => {
    await field(page, 'Full name').fill('Tom');
    await field(page, 'Email').fill('nope');
    await field(page, 'Password').fill('abc');
    await field(page, 'I agree to the terms').check();
    await submit(page).click();
    await expect(summary(page).getByRole('link')).toHaveText([
      'Enter an email address like name@example.com',
      'Password must be at least 8 characters',
    ]);
  });

  test('is a group named by its heading', async ({ page }) => {
    await submit(page).click();
    await expect(page.getByRole('heading', { name: 'There is a problem' })).toBeVisible();
    await expect(summary(page)).toBeVisible();
  });

  test('is not announced as an alert or a status, because focus announces it', async ({ page }) => {
    await submit(page).click();
    await expect(summary(page)).toBeVisible();
    await expect(page.locator('[role="alert"], [role="status"]')).toHaveCount(0);
    await expect(summary(page)).not.toHaveAttribute('aria-live', /.*/);
  });
});

test.describe('focus and keyboard', () => {
  test('moves focus to the summary after a failed submit', async ({ page }) => {
    await submit(page).click();
    await expect(summary(page)).toBeFocused();
  });

  test('moves focus to the summary again on the next failed submit', async ({ page }) => {
    await submit(page).click();
    await expect(summary(page)).toBeFocused();
    await field(page, 'Email').focus();
    await submit(page).click();
    await expect(summary(page)).toBeFocused();
  });

  test('a link focuses its field and leaves the URL alone', async ({ page }) => {
    const before = page.url();
    await submit(page).click();
    await summary(page).getByRole('link', { name: 'Enter your email address' }).click();
    await expect(field(page, 'Email')).toBeFocused();
    expect(page.url()).toBe(before);
  });

  test('works from the keyboard: submit with Enter, activate a link with Enter', async ({ page }) => {
    await submit(page).focus();
    await page.keyboard.press('Enter');
    await expect(summary(page)).toBeFocused();
    await summary(page).getByRole('link', { name: 'Enter your full name' }).focus();
    await page.keyboard.press('Enter');
    await expect(field(page, 'Full name')).toBeFocused();
  });

  test('Tab from the summary reaches its first link', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Safari does not Tab to links by default (people use Option+Tab).');
    await submit(page).click();
    await expect(summary(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(summary(page).getByRole('link', { name: 'Enter your full name' })).toBeFocused();
  });

  test('a link can reach a checkbox', async ({ page }) => {
    await submit(page).click();
    await summary(page).getByRole('link', { name: 'Agree to the terms to continue' }).click();
    await expect(field(page, 'I agree to the terms')).toBeFocused();
  });

  test('has a visible focus indicator', async ({ page }) => {
    await submit(page).click();
    await expect(summary(page)).toBeFocused();
    const outline = await summary(page).evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });
    expect(outline.style).not.toBe('none');
    expect(outline.width).toBeGreaterThanOrEqual(2);
  });
});

test.describe('fixing errors', () => {
  test('entries disappear as fields are fixed, without moving focus, and the summary goes when none are left', async ({ page }) => {
    await submit(page).click();
    await field(page, 'Full name').fill('Tom Coleman');
    await expect(field(page, 'Full name')).toBeFocused();
    await expect(summary(page).getByRole('link')).toHaveText(ALL_MESSAGES.slice(1));
    // (Safari does not focus a checkbox when it is clicked, so check it before the last text field.)
    await field(page, 'I agree to the terms').check();
    await field(page, 'Email').fill('tom@example.com');
    await field(page, 'Password').fill('longenough1');
    await expect(summary(page)).toHaveCount(0);
    await expect(field(page, 'Password')).toBeFocused();
  });
});

test.describe('the pattern the README recommends for the fields themselves', () => {
  test('invalid fields are marked and described by their inline message', async ({ page }) => {
    await submit(page).click();
    const name = field(page, 'Full name');
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await expect(name).toHaveAccessibleDescription('Error: Enter your full name');
    await name.fill('Tom');
    await expect(name).not.toHaveAttribute('aria-invalid', 'true');
  });
});

const themes = [
  { name: 'light', link: 'rgb(179, 38, 30)' },
  { name: 'dark', link: 'rgb(255, 123, 114)' },
  { name: 'high-contrast', link: 'rgb(255, 123, 114)' },
] as const;

test.describe('themes', () => {
  for (const theme of themes) {
    test.describe(theme.name, () => {
      test.beforeEach(async ({ page }) => {
        await page.getByLabel('Theme').selectOption(theme.name);
        await submit(page).click();
        await expect(summary(page)).toBeVisible();
      });

      test('uses the theme colors', async ({ page }) => {
        await expect(summary(page).getByRole('link').first()).toHaveCSS('color', theme.link);
      });

      test('has no axe violations, including color contrast', async ({ page }) => {
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
          .analyze();
        expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      });
    });
  }
});

test('stays inside a phone-sized viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await submit(page).click();
  const box = await summary(page).boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});
