import { sprintDemo } from './toolkit/sprint-demo';

/**
 * Sprint 5 demo, written from demo/sprints/sprint-5.yaml by the sprint-demo skill.
 * One test per story; each step caption is one of that story's acceptance criteria, and is asserted.
 * Runs in Storybook (the demo app has no date picker).
 *
 * Left out: NGA-4 and NGA-5 (Done, but nothing on screen triggers them; see the notes in the stories file).
 */
const { test, expect } = sprintDemo({
  name: 'Sprint5Demo',
  title: 'Sprint 5 demo',
  goal: 'A keyboard-friendly date picker, a public Storybook, and toast focus fixes',
  startUrl: story('components-date-picker--default'),
});

/** A story on its own, without the Storybook UI around it. */
function story(id: string): string {
  return `/iframe.html?id=${id}&viewMode=story`;
}

/** Today plus `days`, as yyyy-MM-dd in local time (what the date picker calls today). */
function dayFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test('NGA-1 choose a date from a calendar', async ({ demo }) => {
  const page = demo.page;
  const field = page.getByLabel('Start date');
  const calendarButton = page.getByRole('button', { name: /^(Choose|Change) date/ });
  const calendar = page.getByRole('dialog', { name: 'Choose date' });

  await demo.story('NGA-1', 'Choose a date from a calendar');

  await demo.step("The calendar button opens a calendar, with today's date in focus");
  await demo.click(calendarButton);
  await expect(calendar).toBeVisible();
  await expect(page.locator(`button[data-date="${dayFromToday(0)}"]`)).toBeFocused();
  await demo.pause(1200);

  await demo.step('Arrow keys move by day and by week, and Enter fills in the date');
  await demo.press('ArrowRight');
  await demo.press('ArrowDown');
  await expect(page.locator(`button[data-date="${dayFromToday(8)}"]`)).toBeFocused();
  await demo.press('Enter');
  await expect(calendar).toBeHidden();
  await expect(field).toHaveValue(dayFromToday(8));
  await expect(calendarButton).toBeFocused();
  await demo.pause(1200);

  await demo.step('Escape closes the calendar without changing the date');
  await demo.press('Enter');
  await expect(calendar).toBeVisible();
  await demo.press('ArrowRight');
  await demo.press('Escape');
  await expect(calendar).toBeHidden();
  await expect(field).toHaveValue(dayFromToday(8));
  await demo.pause(1000);

  await demo.step('A date can still be typed into the field, and the calendar opens on it');
  await demo.type(field, '2026-12-24', { clear: true });
  await demo.click(calendarButton);
  await expect(calendar).toBeVisible();
  await expect(calendar).toContainText('December 2026');
  await expect(page.locator('button[data-date="2026-12-24"]')).toHaveAttribute('aria-pressed', 'true');
  await demo.pause(1500);
  await demo.press('Escape');

  await demo.step("Days outside the allowed range are struck through, and can't be chosen");
  await demo.goto(story('components-date-picker--min-and-max'));
  const limitedField = page.getByLabel('Start date');
  await expect(limitedField).toHaveValue('2026-11-14');
  await demo.click(calendarButton);
  await expect(calendar).toBeVisible();
  const outOfRange = page.locator('button[data-date="2026-11-24"]');
  await expect(outOfRange).toHaveAttribute('aria-disabled', 'true');
  await demo.click(outOfRange, { force: true });
  await expect(calendar).toBeVisible();
  await expect(limitedField).toHaveValue('2026-11-14');
  await demo.pause(1200);
  await demo.press('Escape');
});

test('NGA-2 browse the components in Storybook', async ({ demo }) => {
  const page = demo.page;
  const preview = page.frameLocator('#storybook-preview-iframe');

  await demo.story('NGA-2', 'Browse the components in Storybook');

  await demo.step('Each component has a docs page, with live examples and controls');
  await demo.goto('/?path=/docs/components-date-picker--docs');
  await expect(preview.getByRole('heading', { name: 'Date picker', level: 1 })).toBeVisible({ timeout: 30_000 });
  await expect(preview.getByRole('button', { name: /^(Choose|Change) date/ }).first()).toBeVisible();
  await demo.pause(2000);

  await demo.step('The paintbrush in the toolbar switches the theme, here to dark');
  await demo.click(page.getByRole('button', { name: /theme/i }).first());
  await demo.click(page.getByText('Dark', { exact: true }));
  await expect(preview.locator('html')).toHaveAttribute('data-theme', 'dark');
  await demo.pause(2000);
});

test('NGA-3 a toast stays while keyboard focus is in it', async ({ demo }) => {
  const page = demo.page;
  const toast = page.locator('a11y-toast-item');
  const dismissAll = page.getByRole('button', { name: 'Dismiss all' });

  await demo.story('NGA-3', 'A toast stays while keyboard focus is in it');
  await demo.goto(story('components-toast--success'));

  await demo.step('With focus in a toast, passing the mouse over it no longer restarts its timer');
  await demo.click(page.getByRole('button', { name: 'Show toast' }));
  await expect(toast).toBeVisible();
  await demo.press('Tab');
  await demo.press('Tab');
  await expect(page.getByRole('button', { name: 'Dismiss notification' })).toBeFocused();
  await demo.hover(toast);
  await demo.mouseAway();
  // Longer than the toast's 5 seconds, at any pace: a restarted timer would have removed it by now.
  await page.waitForTimeout(6000);
  await expect(toast).toBeVisible();

  await demo.step('Escape dismisses it, and focus goes back to where it came from');
  await demo.press('Escape');
  await expect(toast).toHaveCount(0);
  await expect(dismissAll).toBeFocused();
  await demo.pause(1500);
});
