import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  inject,
  input,
  output,
} from '@angular/core';
import { TOAST_TYPE_LABEL, Toast } from './toast.model';

/** Toasts by host element, so one toast can ask another where the user came from. */
const ITEMS = new WeakMap<Element, A11yToastItem>();

/**
 * A single toast. Pauses its timer while hovered or while focus is inside it,
 * and can be dismissed with the close button or the Escape key.
 */
@Component({
  selector: 'a11y-toast-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': '"a11y-toast a11y-toast--" + toast().type',
    '(mouseenter)': 'pause()',
    '(mouseleave)': 'resume()',
    '(focusin)': 'onFocusIn($event)',
    '(focusout)': 'onFocusOut($event)',
    '(keydown.escape)': 'dismissByUser()',
  },
  template: `
    <span class="a11y-toast__icon" aria-hidden="true">
      @switch (toast().type) {
        @case ('success') {
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>
        }
        @case ('warning') {
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M1 21h22L12 2zm12-3h-2v-2h2zm0-4h-2v-4h2z"/></svg>
        }
        @case ('error') {
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m1 15h-2v-2h2zm0-4h-2V7h2z"/></svg>
        }
        @default {
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m1 15h-2v-6h2zm0-8h-2V7h2z"/></svg>
        }
      }
    </span>
    <p class="a11y-toast__message">
      <span class="a11y-visually-hidden">{{ label() }}: </span>{{ toast().message }}
    </p>
    @if (toast().action; as action) {
      <button type="button" class="a11y-toast__button" (click)="runAction(action.handler)">
        {{ action.label }}
      </button>
    }
    <button type="button" class="a11y-toast__button a11y-toast__close" aria-label="Dismiss notification" (click)="dismissByUser()">
      <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/></svg>
    </button>
  `,
  styleUrl: './toast-item.css',
})
export class A11yToastItem implements OnInit {
  readonly toast = input.required<Toast>();
  /** `timeout` when the timer ran out, `user` for the close button, an action, or Escape. */
  readonly dismissed = output<'timeout' | 'user'>();

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private remaining = 0;
  private startedAt = 0;
  /** Where focus was before it moved into this toast, so it can go back there. */
  private previouslyFocused: HTMLElement | null = null;

  protected label = () => TOAST_TYPE_LABEL[this.toast().type];

  ngOnInit(): void {
    ITEMS.set(this.el.nativeElement, this);
    this.remaining = this.toast().duration;
    this.resume();
    this.destroyRef.onDestroy(() => clearTimeout(this.timer));
  }

  protected pause(): void {
    if (this.timer === undefined) return;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.remaining -= Date.now() - this.startedAt;
  }

  /** Restarts the timer, unless the pointer is over the toast or keyboard focus is still inside it. */
  protected resume(focusIsLeaving = false): void {
    if (this.remaining <= 0 || this.timer !== undefined) return;
    if (this.el.nativeElement.matches(':hover')) return;
    if (!focusIsLeaving && this.hasFocus()) return;
    this.startedAt = Date.now();
    this.timer = setTimeout(() => this.dismissed.emit('timeout'), this.remaining);
  }

  protected onFocusIn(event: FocusEvent): void {
    const from = event.relatedTarget as HTMLElement | null;
    // The page body is not somewhere to go back to: focusing it is the same as losing focus.
    if (from && from !== from.ownerDocument.body && !this.el.nativeElement.contains(from)) {
      // Another toast is not somewhere to go back to either, as it may be removed first or along with this
      // one. Focus that arrives from a toast goes back to wherever the user was before that toast.
      const toast = from.closest('a11y-toast-item');
      const origin = toast ? (ITEMS.get(toast)?.previouslyFocused ?? null) : from;
      if (origin?.isConnected) this.previouslyFocused = origin;
    }
    this.pause();
  }

  protected onFocusOut(event: FocusEvent): void {
    if (!this.el.nativeElement.contains(event.relatedTarget as Node | null)) this.resume(true);
  }

  protected runAction(handler: () => void): void {
    handler();
    this.dismissByUser();
  }

  protected dismissByUser(): void {
    // Go back to where the user came from before this toast is removed. With nowhere to go back to, focus
    // stays here and the container moves it to a toast that is staying.
    this.moveFocusOut();
    this.dismissed.emit('user');
  }

  /** Whether keyboard focus is inside this toast. */
  hasFocus(): boolean {
    const host = this.el.nativeElement;
    return host.contains(host.ownerDocument.activeElement);
  }

  /**
   * Called just before this toast is removed, however it is removed. Removing it with focus
   * inside would drop focus to the page body and leave a screen reader silent, so move focus first: back to
   * where the user came from, or else to a toast that is staying.
   */
  moveFocusOut(fallback?: A11yToastItem): void {
    if (!this.hasFocus()) return; // focus is elsewhere, nothing to rescue
    const target = this.previouslyFocused?.isConnected
      ? this.previouslyFocused
      : fallback?.el.nativeElement.querySelector('button');
    target?.focus();
  }
}
