import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  isDevMode,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  addDays,
  addMonths,
  asDate,
  firstDayOfWeek,
  formatDate,
  parseDate,
  todayIso,
  toIso,
  weekday,
} from './date-picker.dates';
import { A11yDatePickerLabels, DEFAULT_DATE_PICKER_LABELS } from './date-picker.model';

interface Day {
  iso: string;
  day: number;
  /** The date written out in full, such as "Saturday 14 November 2026". */
  label: string;
  disabled: boolean;
}

let nextId = 0;

/**
 * Adds a calendar to a date field the user can also type in.
 *
 * Wrap your own text input, with its own label:
 *
 * ```html
 * <label for="start">Start date</label>
 * <a11y-date-picker format="dd/MM/yyyy">
 *   <input id="start" formControlName="start" autocomplete="off" />
 * </a11y-date-picker>
 * ```
 *
 * The input stays yours, so it works with reactive forms, template-driven forms or no forms at all. The
 * calendar button opens a dialog; choosing a day writes it to the input in `format` and closes the dialog.
 * Follows the WAI-ARIA Authoring Practices date picker dialog pattern.
 */
@Component({
  selector: 'a11y-date-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(input)': 'readInput()',
    '(change)': 'readInput()',
    '(focusin)': 'readInput()',
    '(document:mousedown)': 'onOutside($event)',
  },
  template: `
    <ng-content />
    <button
      #toggle
      type="button"
      class="a11y-date-picker__toggle"
      aria-haspopup="dialog"
      [attr.aria-expanded]="open()"
      [attr.aria-label]="toggleLabel()"
      [disabled]="inputDisabled()"
      (click)="open() ? close(true) : show()"
    >
      <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="24" height="24">
        <path fill="currentColor" d="M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zm12 8v10H5V10zM5 8V6h14v2z" />
      </svg>
    </button>
    @if (open()) {
      <div class="a11y-date-picker__dialog" role="dialog" aria-modal="true" [attr.aria-label]="text().dialog" (keydown)="onDialogKeydown($event)">
        <div class="a11y-date-picker__header">
          <button type="button" class="a11y-date-picker__nav" [attr.aria-label]="text().previousYear" (click)="shift(-12)">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M18.4 7.4 17 6l-6 6 6 6 1.4-1.4L13.8 12zm-6 0L11 6l-6 6 6 6 1.4-1.4L7.8 12z" /></svg>
          </button>
          <button type="button" class="a11y-date-picker__nav" [attr.aria-label]="text().previousMonth" (click)="shift(-1)">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z" /></svg>
          </button>
          <!-- Polite live region: says the new month when a button above changes it. -->
          <div class="a11y-date-picker__title" [id]="titleId" aria-live="polite">{{ title() }}</div>
          <button type="button" class="a11y-date-picker__nav" [attr.aria-label]="text().nextMonth" (click)="shift(1)">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M8.6 16.6 10 18l6-6-6-6-1.4 1.4 4.6 4.6z" /></svg>
          </button>
          <button type="button" class="a11y-date-picker__nav" [attr.aria-label]="text().nextYear" (click)="shift(12)">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M5.6 16.6 7 18l6-6-6-6-1.4 1.4 4.6 4.6zm6 0L13 18l6-6-6-6-1.4 1.4 4.6 4.6z" /></svg>
          </button>
        </div>
        <table class="a11y-date-picker__grid" role="grid" [attr.aria-labelledby]="titleId">
          <thead>
            <tr>
              @for (name of weekdays(); track name.long) {
                <th scope="col" [attr.abbr]="name.long">{{ name.short }}</th>
              }
            </tr>
          </thead>
          <tbody (keydown)="onGridKeydown($event)">
            @for (week of weeks(); track $index) {
              <tr>
                @for (day of week; track $index) {
                  <td>
                    @if (day) {
                      <!-- One day is in the tab order; the arrow keys move between days. -->
                      <button
                        type="button"
                        class="a11y-date-picker__day"
                        [attr.data-date]="day.iso"
                        [attr.tabindex]="day.iso === focused() ? 0 : -1"
                        [attr.aria-label]="day.label"
                        [attr.aria-pressed]="day.iso === selected()"
                        [attr.aria-current]="day.iso === today() ? 'date' : null"
                        [attr.aria-disabled]="day.disabled ? 'true' : null"
                        (click)="choose(day)"
                      >
                        {{ day.day }}
                      </button>
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
        <div class="a11y-date-picker__footer">
          <button type="button" class="a11y-date-picker__close" (click)="close(true)">{{ text().close }}</button>
        </div>
      </div>
    }
  `,
  styleUrl: './date-picker.css',
})
export class A11yDatePicker {
  /** How the date is written in the input, made of `dd`, `MM` and `yyyy`: `yyyy-MM-dd`, `dd/MM/yyyy`, `MM/dd/yyyy`. */
  readonly format = input('yyyy-MM-dd');
  /** Earliest date that can be chosen, as `yyyy-MM-dd`. */
  readonly min = input<string | null>(null);
  /** Latest date that can be chosen, as `yyyy-MM-dd`. */
  readonly max = input<string | null>(null);
  /** Locale for month and day names, such as `en-GB`. Defaults to the browser's. */
  readonly locale = input<string | undefined>(undefined);
  /** First day of the week, 0 (Sunday) to 6 (Saturday). Defaults to the locale's. */
  readonly weekStartsOn = input<number | undefined>(undefined);
  /** Text to translate or reword. See {@link A11yDatePickerLabels}. */
  readonly labels = input<Partial<A11yDatePickerLabels>>({});
  /** Emits the date, as `yyyy-MM-dd`, when the user chooses a day in the calendar. */
  readonly chosen = output<string>();

  protected readonly titleId = `a11y-date-picker-${nextId++}`;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly toggle = viewChild.required<ElementRef<HTMLButtonElement>>('toggle');

  protected readonly open = signal(false);
  /** The day that has, or will get, keyboard focus. The calendar shows its month. */
  protected readonly focused = signal(todayIso());
  /** The date in the input, if it holds a real one. */
  protected readonly selected = signal<string | null>(null);
  protected readonly today = signal(todayIso());
  protected readonly inputDisabled = signal(false);

  protected readonly text = computed<A11yDatePickerLabels>(() => ({ ...DEFAULT_DATE_PICKER_LABELS, ...this.labels() }));
  private readonly fullDate = computed(() => new Intl.DateTimeFormat(this.locale(), { dateStyle: 'full', timeZone: 'UTC' }));

  protected readonly toggleLabel = computed(() => {
    const selected = this.selected();
    return selected ? this.text().change(this.fullDate().format(asDate(selected))) : this.text().choose;
  });

  protected readonly title = computed(() =>
    new Intl.DateTimeFormat(this.locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(asDate(this.focused())),
  );

  private readonly firstDay = computed(() => this.weekStartsOn() ?? firstDayOfWeek(this.locale()));

  protected readonly weekdays = computed(() => {
    const long = new Intl.DateTimeFormat(this.locale(), { weekday: 'long', timeZone: 'UTC' });
    const short = new Intl.DateTimeFormat(this.locale(), { weekday: 'short', timeZone: 'UTC' });
    // 1 January 2023 was a Sunday.
    return Array.from({ length: 7 }, (_, i) => asDate(addDays('2023-01-01', this.firstDay() + i))).map((date) => ({
      long: long.format(date),
      short: short.format(date),
    }));
  });

  /** The focused month as rows of seven, with null before the 1st and after the last day. */
  protected readonly weeks = computed<(Day | null)[][]>(() => {
    const [year, month] = this.focused().split('-').map(Number);
    const first = toIso(year, month, 1);
    const cells: (Day | null)[] = Array.from({ length: (weekday(first) - this.firstDay() + 7) % 7 }, () => null);
    for (let iso = first; iso.slice(0, 7) === first.slice(0, 7); iso = addDays(iso, 1)) {
      cells.push({ iso, day: Number(iso.slice(8)), label: this.fullDate().format(asDate(iso)), disabled: !this.allowed(iso) });
    }
    while (cells.length % 7) cells.push(null);
    return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    // Needs the DOM, so wait until the view exists (also keeps this safe for server rendering).
    afterNextRender(() => {
      if (!this.field()) {
        if (isDevMode()) console.warn('<a11y-date-picker> must wrap the <input> the date is typed in.');
        return;
      }
      this.readInput();
      // The calendar button follows the input: a disabled or read-only field cannot be changed from the calendar.
      if (typeof MutationObserver === 'undefined') return;
      const observer = new MutationObserver(() => this.readInput());
      observer.observe(this.host.nativeElement, { attributes: true, attributeFilter: ['disabled', 'readonly'], subtree: true });
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  /** The input the user types the date in. Looked up each time, so it may be rendered late or replaced. */
  private field(): HTMLInputElement | null {
    return this.host.nativeElement.querySelector<HTMLInputElement>('input:not([type="hidden"])');
  }

  private allowed(iso: string): boolean {
    const [min, max] = [this.min(), this.max()];
    return (!min || iso >= min) && (!max || iso <= max);
  }

  /** Keeps what the picker knows about the input up to date: its date, and whether it can be changed. */
  protected readInput(): void {
    const field = this.field();
    if (!field) return;
    this.selected.set(parseDate(field.value, this.format()));
    this.inputDisabled.set(field.disabled || field.readOnly);
  }

  protected show(): void {
    this.readInput();
    if (!this.field() || this.inputDisabled()) return;
    const today = todayIso();
    this.today.set(today);
    // Start on the date in the field, or else today, moved inside min and max if it is outside them.
    let start = this.selected() ?? today;
    const [min, max] = [this.min(), this.max()];
    if (min && start < min) start = min;
    if (max && start > max) start = max;
    this.focused.set(start);
    this.open.set(true);
    this.focusDay();
  }

  /** Closes the calendar. Focus goes back to the calendar button unless the user has moved on elsewhere. */
  protected close(returnFocus: boolean): void {
    if (!this.open()) return;
    this.open.set(false);
    if (returnFocus) this.toggle().nativeElement.focus();
  }

  protected choose(day: Day): void {
    const field = this.field();
    if (day.disabled || !field) return;
    field.value = formatDate(day.iso, this.format());
    // Forms and the app listen for these, as if the date had been typed.
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    this.selected.set(day.iso);
    this.chosen.emit(day.iso);
    this.close(true);
  }

  /** Moves the calendar by months, from the buttons above it. Focus stays on the button. */
  protected shift(months: number): void {
    this.focused.update((iso) => addMonths(iso, months));
  }

  protected onGridKeydown(event: KeyboardEvent): void {
    const from = this.focused();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    const column = (weekday(from) - this.firstDay() + 7) % 7;
    let to: string | null = null;
    switch (event.key) {
      case 'ArrowLeft': to = addDays(from, rtl ? 1 : -1); break;
      case 'ArrowRight': to = addDays(from, rtl ? -1 : 1); break;
      case 'ArrowUp': to = addDays(from, -7); break;
      case 'ArrowDown': to = addDays(from, 7); break;
      case 'Home': to = addDays(from, -column); break;
      case 'End': to = addDays(from, 6 - column); break;
      case 'PageUp': to = addMonths(from, event.shiftKey ? -12 : -1); break;
      case 'PageDown': to = addMonths(from, event.shiftKey ? 12 : 1); break;
    }
    if (!to) return;
    event.preventDefault(); // these keys would otherwise scroll the page
    this.focused.set(to);
    this.focusDay();
  }

  protected onDialogKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation(); // do not also close a dialog this picker sits in
      this.close(true);
      return;
    }
    if (event.key !== 'Tab') return;
    // Keep Tab inside the dialog while it is open, as aria-modal promises.
    const dialog = event.currentTarget as HTMLElement;
    const stops = Array.from(dialog.querySelectorAll<HTMLElement>('button')).filter((el) => el.tabIndex >= 0);
    const [first, last] = [stops[0], stops.at(-1)!];
    const active = dialog.ownerDocument.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /** A click or tap anywhere else closes the calendar and leaves focus where the user put it. */
  protected onOutside(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node | null)) this.close(false);
  }

  /** Moves keyboard focus to the focused day, once the calendar has rendered its month. */
  private focusDay(): void {
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>(`button[data-date="${this.focused()}"]`)?.focus(),
      { injector: this.injector },
    );
  }
}
