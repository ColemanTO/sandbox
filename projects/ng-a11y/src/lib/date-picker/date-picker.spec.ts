import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import axe from 'axe-core';
import { A11yDatePicker } from './date-picker';
import { A11yDatePickerLabels } from './date-picker.model';

@Component({
  imports: [ReactiveFormsModule, A11yDatePicker],
  template: `
    <button id="before" type="button">Before</button>
    <form [formGroup]="form">
      <label for="start">Start date</label>
      <a11y-date-picker format="dd/MM/yyyy" locale="en-GB" [min]="min()" [max]="max()" [labels]="labels()" (chosen)="chosen.push($event)">
        <input id="start" formControlName="start" autocomplete="off" />
      </a11y-date-picker>
    </form>
  `,
})
class Host {
  form = new FormGroup({ start: new FormControl('') });
  min = signal<string | null>(null);
  max = signal<string | null>(null);
  labels = signal<Partial<A11yDatePickerLabels>>({});
  chosen: string[] = [];
}

describe('A11yDatePicker', () => {
  let fixture: ComponentFixture<Host>;
  const el = () => fixture.nativeElement as HTMLElement;
  const input = () => el().querySelector('#start') as HTMLInputElement;
  const toggle = () => el().querySelector('.a11y-date-picker__toggle') as HTMLButtonElement;
  const dialog = () => el().querySelector('[role="dialog"]') as HTMLElement | null;
  const day = (iso: string) => el().querySelector(`button[data-date="${iso}"]`) as HTMLButtonElement | null;
  const title = () => el().querySelector('.a11y-date-picker__title')!.textContent!.trim();
  const active = () => document.activeElement as HTMLElement;
  /** The date in full as Intl writes it for en-GB, e.g. "Saturday 14 November 2026" (punctuation varies by runtime). */
  const full = (iso: string) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function open(): Promise<void> {
    toggle().click();
    await settle();
  }

  async function press(key: string, init: KeyboardEventInit = {}): Promise<KeyboardEvent> {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    active().dispatchEvent(event);
    await settle();
    return event;
  }

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 14, 12)); // Saturday 14 November 2026
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    document.body.append(fixture.nativeElement); // focus only works on elements in the document
    await settle();
  });

  afterEach(() => {
    fixture.nativeElement.remove();
    vi.useRealTimers();
  });

  describe('the calendar button', () => {
    it('is named "Choose date", and says it opens a dialog that is closed', () => {
      expect(toggle().getAttribute('aria-label')).toBe('Choose date');
      expect(toggle().getAttribute('aria-haspopup')).toBe('dialog');
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
      expect(dialog()).toBeNull();
    });

    it('includes the date, written out, once the field has one', async () => {
      input().value = '5/3/2026';
      input().dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
      expect(toggle().getAttribute('aria-label')).toBe(`Change date, ${full('2026-03-05')}`);
    });

    it('is disabled while the field is disabled', async () => {
      fixture.componentInstance.form.controls.start.disable();
      await settle();
      await new Promise((resolve) => setTimeout(resolve)); // the attribute change is observed asynchronously
      await settle();
      expect(toggle().disabled).toBe(true);
      fixture.componentInstance.form.controls.start.enable();
      await settle();
      await new Promise((resolve) => setTimeout(resolve));
      await settle();
      expect(toggle().disabled).toBe(false);
    });
  });

  describe('opening', () => {
    it('opens a modal dialog on today, and moves focus to it', async () => {
      await open();
      expect(dialog()!.getAttribute('aria-modal')).toBe('true');
      expect(dialog()!.getAttribute('aria-label')).toBe('Choose date');
      expect(toggle().getAttribute('aria-expanded')).toBe('true');
      expect(title()).toBe('November 2026');
      expect(active()).toBe(day('2026-11-14'));
      expect(active().getAttribute('aria-current')).toBe('date');
      expect(active().getAttribute('aria-label')).toBe(full('2026-11-14'));
      expect(full('2026-11-14')).toMatch(/^Saturday,? 14 November 2026$/);
    });

    it('opens on the date already in the field, and marks it as pressed', async () => {
      fixture.componentInstance.form.controls.start.setValue('05/03/2026'); // set by the app: no input event
      await settle();
      await open();
      expect(title()).toBe('March 2026');
      expect(active()).toBe(day('2026-03-05'));
      expect(active().getAttribute('aria-pressed')).toBe('true');
      expect(day('2026-03-06')!.getAttribute('aria-pressed')).toBe('false');
    });

    it('opens on today when the field holds something that is not a date', async () => {
      fixture.componentInstance.form.controls.start.setValue('tomorrow');
      await settle();
      await open();
      expect(active()).toBe(day('2026-11-14'));
    });

    it('lays the month out as a grid named by the month, with full day names for screen readers', async () => {
      await open();
      const grid = el().querySelector('[role="grid"]')!;
      expect(document.getElementById(grid.getAttribute('aria-labelledby')!)!.textContent!.trim()).toBe('November 2026');
      const headers = Array.from(grid.querySelectorAll('th'));
      expect(headers.map((th) => th.textContent!.trim())).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
      expect(headers[0].getAttribute('abbr')).toBe('Monday');
      expect(grid.querySelectorAll('button[data-date]')).toHaveLength(30);
      // 1 November 2026 is a Sunday, so it is the last cell of the first row.
      expect(grid.querySelector('tbody tr')!.querySelectorAll('td')[6].textContent!.trim()).toBe('1');
    });

    it('has exactly one day in the tab order', async () => {
      await open();
      const stops = Array.from(el().querySelectorAll<HTMLElement>('button[data-date]')).filter((b) => b.tabIndex === 0);
      expect(stops).toEqual([day('2026-11-14')]);
    });
  });

  describe('keyboard', () => {
    beforeEach(open);

    it('moves by day with the left and right arrows', async () => {
      await press('ArrowRight');
      expect(active()).toBe(day('2026-11-15'));
      await press('ArrowLeft');
      await press('ArrowLeft');
      expect(active()).toBe(day('2026-11-13'));
    });

    it('moves by week with the up and down arrows, into the next month when needed', async () => {
      await press('ArrowUp');
      expect(active()).toBe(day('2026-11-07'));
      await press('ArrowDown');
      await press('ArrowDown');
      await press('ArrowDown');
      await press('ArrowDown');
      expect(active()).toBe(day('2026-12-05'));
      expect(title()).toBe('December 2026');
    });

    it('goes to the start and end of the week with Home and End', async () => {
      await press('Home');
      expect(active()).toBe(day('2026-11-09')); // Monday
      await press('End');
      expect(active()).toBe(day('2026-11-15')); // Sunday
    });

    it('moves by month with Page Up and Page Down, and by year with Shift', async () => {
      await press('PageDown');
      expect(active()).toBe(day('2026-12-14'));
      await press('PageUp');
      await press('PageUp');
      expect(active()).toBe(day('2026-10-14'));
      await press('PageDown', { shiftKey: true });
      expect(active()).toBe(day('2027-10-14'));
      await press('PageUp', { shiftKey: true });
      expect(active()).toBe(day('2026-10-14'));
    });

    it('stops the navigation keys from scrolling the page', async () => {
      expect((await press('ArrowDown')).defaultPrevented).toBe(true);
      expect((await press('PageDown')).defaultPrevented).toBe(true);
      expect((await press('a')).defaultPrevented).toBe(false);
    });

    it('closes with Escape, returns focus to the calendar button, and leaves the field alone', async () => {
      const event = await press('Escape');
      expect(dialog()).toBeNull();
      expect(active()).toBe(toggle());
      expect(input().value).toBe('');
      expect(event.defaultPrevented).toBe(true);
    });

    it('keeps Tab inside the dialog', async () => {
      const close = el().querySelector('.a11y-date-picker__close') as HTMLButtonElement;
      const first = el().querySelector('.a11y-date-picker__nav') as HTMLButtonElement;
      close.focus();
      expect((await press('Tab')).defaultPrevented).toBe(true);
      expect(active()).toBe(first);
      expect((await press('Tab', { shiftKey: true })).defaultPrevented).toBe(true);
      expect(active()).toBe(close);
      day('2026-11-14')!.focus();
      expect((await press('Tab')).defaultPrevented).toBe(false); // the browser moves on to Close itself
    });
  });

  describe('choosing a day', () => {
    it('writes the date to the field in the format, tells the form, closes, and returns focus', async () => {
      const events: string[] = [];
      input().addEventListener('input', () => events.push('input'));
      input().addEventListener('change', () => events.push('change'));
      await open();
      day('2026-11-20')!.click();
      await settle();
      expect(input().value).toBe('20/11/2026');
      expect(fixture.componentInstance.form.value.start).toBe('20/11/2026');
      expect(fixture.componentInstance.form.dirty).toBe(true);
      expect(events).toEqual(['input', 'change']);
      expect(fixture.componentInstance.chosen).toEqual(['2026-11-20']);
      expect(dialog()).toBeNull();
      expect(active()).toBe(toggle());
      expect(toggle().getAttribute('aria-label')).toBe(`Change date, ${full('2026-11-20')}`);
    });
  });

  describe('the month and year buttons', () => {
    beforeEach(open);
    const nav = (name: string) => el().querySelector(`.a11y-date-picker__nav[aria-label="${name}"]`) as HTMLButtonElement;

    it('change the month and keep focus on the button', async () => {
      nav('Next month').focus();
      nav('Next month').click();
      await settle();
      expect(title()).toBe('December 2026');
      expect(active()).toBe(nav('Next month'));
      nav('Previous year').click();
      await settle();
      expect(title()).toBe('December 2025');
      nav('Previous month').click();
      nav('Next year').click();
      await settle();
      expect(title()).toBe('November 2026');
    });

    it('announce the new month politely', () => {
      expect(el().querySelector('.a11y-date-picker__title')!.getAttribute('aria-live')).toBe('polite');
    });

    it('keep one day in the tab order after the month changes', async () => {
      nav('Next month').click();
      await settle();
      expect(day('2026-12-14')!.tabIndex).toBe(0);
    });
  });

  describe('min and max', () => {
    beforeEach(async () => {
      fixture.componentInstance.min.set('2026-11-10');
      fixture.componentInstance.max.set('2026-11-20');
      await settle();
    });

    it('marks days outside the range as disabled, and does not choose them', async () => {
      await open();
      expect(day('2026-11-09')!.getAttribute('aria-disabled')).toBe('true');
      expect(day('2026-11-10')!.getAttribute('aria-disabled')).toBeNull();
      expect(day('2026-11-21')!.getAttribute('aria-disabled')).toBe('true');
      day('2026-11-09')!.click();
      await settle();
      expect(input().value).toBe('');
      expect(dialog()).not.toBeNull();
    });

    it('opens inside the range when today is outside it', async () => {
      fixture.componentInstance.max.set('2026-11-12');
      await settle();
      await open();
      expect(active()).toBe(day('2026-11-12'));
    });
  });

  it('closes on a click outside, without taking focus', async () => {
    await open();
    const before = el().querySelector('#before') as HTMLButtonElement;
    before.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    before.focus();
    await settle();
    expect(dialog()).toBeNull();
    expect(active()).toBe(before);
  });

  it('stays open on a click inside the dialog', async () => {
    await open();
    el().querySelector('.a11y-date-picker__title')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await settle();
    expect(dialog()).not.toBeNull();
  });

  it('closes when the calendar button is pressed again', async () => {
    await open();
    toggle().click();
    await settle();
    expect(dialog()).toBeNull();
  });

  it('lets the app translate its text', async () => {
    fixture.componentInstance.labels.set({ choose: 'Choisir une date', close: 'Fermer', nextMonth: 'Mois suivant' });
    await settle();
    expect(toggle().getAttribute('aria-label')).toBe('Choisir une date');
    await open();
    expect(el().querySelector('.a11y-date-picker__close')!.textContent!.trim()).toBe('Fermer');
    expect(el().querySelector('[aria-label="Mois suivant"]')).not.toBeNull();
    expect(el().querySelector('[aria-label="Previous month"]')).not.toBeNull(); // the rest keep their defaults
  });

  describe('accessibility (axe)', () => {
    // axe finds only some problems, and jsdom has no layout, so color contrast is checked in the token build instead.
    async function violations() {
      const results = await axe.run(el(), {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
        rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
      });
      return results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target).join(', ')})`);
    }

    it('has no violations when closed', async () => {
      vi.useRealTimers();
      expect(await violations()).toEqual([]);
    });

    it('has no violations when open, with a date chosen and a range set', async () => {
      fixture.componentInstance.form.controls.start.setValue('12/11/2026');
      fixture.componentInstance.min.set('2026-11-10');
      await settle();
      await open();
      vi.useRealTimers();
      expect(await violations()).toEqual([]);
    });
  });
});
