import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  isDevMode,
  signal,
  viewChild,
} from '@angular/core';
import { ErrorMessages, ErrorSummaryControl } from './error-summary.model';

interface Entry {
  key: string;
  path: string[];
  message: string;
  el: HTMLElement | null;
}

interface Invalid {
  path: string[];
  control: ErrorSummaryControl;
}

const FOCUSABLE = 'input, select, textarea, button, [tabindex]:not([tabindex="-1"])';
const GROUP = '[formgroupname], [formarrayname]';
let nextId = 0;

/** Walks a form and returns every enabled leaf control that is invalid. Group-level errors are not listed. */
function collectInvalid(control: ErrorSummaryControl, path: string[] = [], out: Invalid[] = []): Invalid[] {
  if (control.disabled) return out;
  if (control.controls) {
    // Object.entries covers FormGroup (keys) and FormArray (indexes).
    for (const [key, child] of Object.entries(control.controls)) collectInvalid(child, [...path, key], out);
    return out;
  }
  if (control.invalid) out.push({ path, control });
  return out;
}

const hasProblems = (form: ErrorSummaryControl) => form.invalid || collectInvalid(form).length > 0;

/** Whether any control only takes its value when the form is submitted (`updateOn: 'submit'`). */
function updatesOnSubmit(control: ErrorSummaryControl): boolean {
  if (control.updateOn === 'submit') return true;
  return control.controls ? Object.values(control.controls).some(updatesOnSubmit) : false;
}

/** Every enabled leaf control whose async validator is still running. */
function collectPending(control: ErrorSummaryControl, out: ErrorSummaryControl[] = []): ErrorSummaryControl[] {
  if (control.disabled) return out;
  if (control.controls) for (const child of Object.values(control.controls)) collectPending(child, out);
  else if (control.pending) out.push(control);
  return out;
}

const attr = (value: string) => value.replace(/["\\]/g, '\\$&');

/**
 * Lists the errors on a form after a failed submit and takes the user to them.
 *
 * Place it inside the `<form>` it summarizes. After a failed submit it appears, takes focus, and each entry
 * is a link that focuses its field. Entries disappear as the user fixes them. Supports reactive forms.
 */
@Component({
  selector: 'a11y-error-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div #summary class="a11y-error-summary" role="group" tabindex="-1" [attr.aria-labelledby]="headingId">
        <div class="a11y-error-summary__title" role="heading" [attr.aria-level]="headingLevel()" [id]="headingId">
          {{ heading() }}
        </div>
        <ul class="a11y-error-summary__list">
          @for (entry of entries(); track entry.key) {
            <li>
              @if (entry.el) {
                <a [attr.href]="entry.el.id ? '#' + entry.el.id : '#'" (click)="goTo($event, entry)">{{ entry.message }}</a>
              } @else {
                {{ entry.message }}
              }
            </li>
          }
        </ul>
      </div>
    }
  `,
  styleUrl: './error-summary.css',
})
export class A11yErrorSummary {
  /** The form to summarize: a `FormGroup`, or any control with the same shape. */
  readonly form = input.required<ErrorSummaryControl>();
  /** Messages to show for each field. See {@link ErrorMessages}. */
  readonly messages = input<ErrorMessages>({});
  /** Text of the heading. */
  readonly heading = input('There is a problem');
  /** `aria-level` of the heading, so it fits your page outline. */
  readonly headingLevel = input<2 | 3 | 4 | 5 | 6>(2);

  protected readonly headingId = `a11y-error-summary-${nextId++}`;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly summary = viewChild<ElementRef<HTMLElement>>('summary');

  private formEl: HTMLFormElement | null = null;
  private readonly attempted = signal(false);
  private readonly tick = signal(0);
  private readonly warned = new Set<string>();
  /**
   * A submit happened while async validators were running; judge it when they finish. `controls` are the
   * fields that were being validated (empty when only a group-level validator was running), and `pristine`
   * is whether the form was untouched when it was submitted.
   */
  private awaiting: { controls: ErrorSummaryControl[]; pristine: boolean } | null = null;
  /** Set while a submit event is being handled for a form whose values arrive on submit. */
  private submitting: { invalidBefore: boolean; becameValid: boolean } | null = null;

  protected readonly entries = computed<Entry[]>(() => {
    this.tick(); // re-evaluate when the form's status changes or a submit is attempted
    if (!this.attempted()) return [];
    const root = this.form();
    const messages = this.messages();
    const entries = collectInvalid(root).map(({ path, control }) => {
      const el = this.fieldFor(path);
      if (!el) this.warnOnce(`field:${path.join('.')}`, `cannot tell which field belongs to "${path.join('.')}", so its entry is not a link. Either its name is bound, as in [formControlName]="name", or a group around it has no name attribute to find it by, as in [formGroupName]="i", and another field there has the same name. Add data-a11y-field="${path.join('.')}" to the field.`);
      return { key: path.join('.'), path, el, message: this.messageFor(path, control, el, messages) };
    });
    // Keep the summary in the order the fields appear on the page. Entries without an element cannot be
    // compared, so they keep their place in the list and the linked entries are ordered around them.
    const linked = entries
      .filter((entry) => entry.el)
      .sort((a, b) => (a.el!.compareDocumentPosition(b.el!) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    let next = 0;
    for (let i = 0; i < entries.length; i++) if (entries[i].el) entries[i] = linked[next++];
    if (!entries.length && root.invalid) {
      const custom = messages['$form'];
      entries.push({ key: '$form', path: [], el: null, message: typeof custom === 'string' ? custom : 'Check the form for errors' });
    }
    return entries;
  });

  protected readonly visible = computed(() => this.attempted() && this.entries().length > 0);

  constructor() {
    effect((onCleanup) => {
      const sub = this.form().statusChanges.subscribe(() => {
        const form = this.form();
        this.tick.update((n) => n + 1);
        if (this.submitting && form.valid) this.submitting.becameValid = true;
        this.settleAwaited(form);
        // Everything is fixed: stay quiet until the next failed submit, even if a field is cleared later.
        if (this.attempted() && this.form().valid) this.attempted.set(false);
      });
      onCleanup(() => sub.unsubscribe());
    });

    // Needs the DOM, so wait until the view exists (also keeps this safe for server rendering).
    afterNextRender(() => {
      const formEl = this.host.nativeElement.closest('form');
      if (!formEl) {
        if (isDevMode()) console.warn('<a11y-error-summary> must be placed inside the <form> it summarizes.');
        return;
      }
      this.formEl = formEl;
      // Listen on the document, in the capture phase, so this runs before the form's own (ngSubmit) handler.
      // That way the form is judged as the user submitted it, before an app handler can save and reset it.
      const doc = formEl.ownerDocument;
      const onSubmit = (event: Event) => {
        if (event.target === formEl) this.onSubmit();
      };
      const onSubmitted = (event: Event) => {
        if (event.target === formEl) this.onSubmitted();
      };
      const onReset = () => this.clear();
      // The second listener runs after the form's own handlers, once the event has bubbled to the document.
      doc.addEventListener('submit', onSubmit, true);
      doc.addEventListener('submit', onSubmitted);
      formEl.addEventListener('reset', onReset);
      this.destroyRef.onDestroy(() => {
        doc.removeEventListener('submit', onSubmit, true);
        doc.removeEventListener('submit', onSubmitted);
        formEl.removeEventListener('reset', onReset);
      });
    });
  }

  /** Hides the summary until the next failed submit. Call it after a programmatic `form.reset()`. */
  clear(): void {
    this.attempted.set(false);
    this.awaiting = null;
  }

  /** Judges a submit that was made while async validators were running, once they have finished. */
  private settleAwaited(form: ErrorSummaryControl): void {
    const waiting = this.awaiting;
    if (!waiting) return;
    // Wait for the validators that were running at the submit, and judge only what they found. The form's
    // own status is no guide here: it also changes when the user goes on to edit some other field, and that
    // must not pull focus into the summary. With no field to watch (a group-level validator), use the form.
    const fields = waiting.controls;
    if (fields.length ? fields.some((c) => c.pending) : form.pending) return;
    this.awaiting = null;
    // A form that was dirty at the submit and is pristine now was reset by the app; that is not a failed submit.
    if (form.pristine === true && !waiting.pristine) return;
    if (fields.length ? fields.some((c) => !c.disabled && c.invalid) : hasProblems(form)) this.judge(true);
  }

  /** Runs before the form's own submit handling. */
  private onSubmit(): void {
    const form = this.form();
    this.awaiting = null;
    if (updatesOnSubmit(form)) {
      // The values the user typed only reach the form during this event, so wait until it has been handled.
      const state = (this.submitting = { invalidBefore: hasProblems(form), becameValid: false });
      // Normally onSubmitted() runs when the event reaches the document. If something stops the event on
      // the way, judge the form on the next task instead.
      setTimeout(() => {
        if (this.submitting === state) this.onSubmitted();
      });
      return;
    }
    this.submitting = null;
    this.judge(hasProblems(form));
  }

  /** Runs after the form's own submit handling. Only needed for forms whose values arrive on submit. */
  private onSubmitted(): void {
    const state = this.submitting;
    if (!state) return;
    this.submitting = null;
    const form = this.form();
    // Pristine now means nothing was typed, or the app saved and reset the form. Then go by how the form
    // was before the submit, unless it turned valid on the way (saved, then reset). Otherwise judge it as it is.
    this.judge(form.pristine === true ? state.invalidBefore && !state.becameValid : hasProblems(form));
  }

  private judge(failed: boolean): void {
    this.attempted.set(failed); // a clean submit clears the summary, so a later form.reset() can't bring it back
    this.tick.update((n) => n + 1);
    if (failed) this.focusSummary();
    // An async validator is still running: it may yet fail, so look again when it finishes.
    else if (this.form().pending) {
      this.awaiting = { controls: collectPending(this.form()), pristine: this.form().pristine === true };
    }
  }

  private focusSummary(): void {
    const el = this.summary()?.nativeElement;
    if (el) {
      el.focus(); // already showing from an earlier attempt
      return;
    }
    afterNextRender(() => this.summary()?.nativeElement.focus(), { injector: this.injector });
  }

  protected goTo(event: Event, entry: Entry): void {
    event.preventDefault(); // focus the field; do not change the URL
    const el = this.fieldFor(entry.path) ?? entry.el;
    const target = el && (el.matches(FOCUSABLE) ? el : el.querySelector<HTMLElement>(FOCUSABLE));
    target?.focus();
  }

  /**
   * Finds the element for a control: one marked `data-a11y-field="<dotted path>"`, or else the element with its
   * `formControlName` directly inside the `formGroupName` / `formArrayName` elements its path names. A group
   * with no element of its own (a bound name, or an `<ng-container>`) is looked through, and the field is
   * then only used if it is the only one with that name there. Returns null rather than guess, because a
   * link to the wrong field is worse than no link.
   */
  private fieldFor(path: string[]): HTMLElement | null {
    const form = this.formEl;
    if (!form || !path.length) return null;
    const marked = form.querySelector<HTMLElement>(`[data-a11y-field="${attr(path.join('.'))}"]`);
    if (marked) return marked;
    // The group an element belongs to: its nearest named group, or the form itself.
    const groupOf = (el: Element): Element => {
      const group = el.parentElement?.closest(GROUP);
      return group && form.contains(group) ? group : form;
    };
    const within = (scope: Element, selector: string) =>
      Array.from(scope.querySelectorAll<HTMLElement>(selector)).filter((el) => groupOf(el) === scope);
    let scope: Element = form;
    for (const segment of path.slice(0, -1)) {
      // No element: the group's name is bound, or it sits on an <ng-container>. Its fields are then found
      // from the enclosing group, where the check below refuses any name that is not unique.
      scope = within(scope, `[formgroupname="${attr(segment)}"], [formarrayname="${attr(segment)}"]`)[0] ?? scope;
    }
    const fields = within(scope, `[formcontrolname="${attr(path.at(-1)!)}"]`);
    // Several elements with one name are one control only when they are its radio buttons. Otherwise they
    // belong to different groups that cannot be told apart, such as the rows of [formGroupName]="i".
    const one = fields.length === 1 || (fields.length > 1 && fields.every((el) => el.matches('input[type="radio"]')));
    return one ? fields[0] : null;
  }

  private warnOnce(key: string, message: string): void {
    if (!isDevMode() || this.warned.has(key)) return;
    this.warned.add(key);
    console.warn(`<a11y-error-summary>: ${message}`);
  }

  private messageFor(path: string[], control: ErrorSummaryControl, el: HTMLElement | null, messages: ErrorMessages): string {
    const entry = messages[path.join('.')] ?? messages[path.at(-1)!];
    if (typeof entry === 'string') return entry;
    if (entry) {
      for (const errorKey of Object.keys(control.errors ?? {})) if (entry[errorKey]) return entry[errorKey];
    }
    const name = this.labelFor(el) ?? path.at(-1)!.replace(/[-_]/g, ' ');
    const key = path.join('.');
    this.warnOnce(key, `no message for "${key}" (${Object.keys(control.errors ?? {}).join(', ')}). Add it to [messages].`);
    return `Check ${name}`;
  }

  private labelFor(el: HTMLElement | null): string | null {
    if (!el) return null;
    const label = el.id ? this.formEl?.querySelector(`label[for="${attr(el.id)}"]`) : null;
    return label?.textContent?.trim() || el.getAttribute('aria-label');
  }
}
