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
import { Toast } from './toast.model';

const TYPE_LABEL: Record<Toast['type'], string> = {
  info: 'Information',
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
};

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
    '(focusin)': 'pause()',
    '(focusout)': 'onFocusOut($event)',
    '(keydown.escape)': 'dismissed.emit()',
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
    <button type="button" class="a11y-toast__button a11y-toast__close" aria-label="Dismiss notification" (click)="dismissed.emit()">
      <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/></svg>
    </button>
  `,
  styleUrl: './toast-item.css',
})
export class A11yToastItem implements OnInit {
  readonly toast = input.required<Toast>();
  readonly dismissed = output<void>();

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private remaining = 0;
  private startedAt = 0;

  protected label = () => TYPE_LABEL[this.toast().type];

  ngOnInit(): void {
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

  protected resume(): void {
    if (this.remaining <= 0 || this.timer !== undefined) return;
    if (this.el.nativeElement.matches(':hover')) return;
    this.startedAt = Date.now();
    this.timer = setTimeout(() => this.dismissed.emit(), this.remaining);
  }

  protected onFocusOut(event: FocusEvent): void {
    if (!this.el.nativeElement.contains(event.relatedTarget as Node | null)) this.resume();
  }

  protected runAction(handler: () => void): void {
    handler();
    this.dismissed.emit();
  }
}
