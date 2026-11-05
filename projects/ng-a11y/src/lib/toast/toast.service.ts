import { Injectable, computed, signal } from '@angular/core';
import { DEFAULT_TOAST_DURATION, TOAST_TYPE_LABEL, Toast, ToastConfig } from './toast.model';

const WRITE_DELAY = 50; // clear first, write on a later tick, so repeating a message still counts as a change
const GAP = 350; // space between queued messages so a screen reader does not drop one
const CLEAR_AFTER = 3000; // empty the region afterwards so nothing stale is left behind

/**
 * One hidden live region's text. Every message is written in a single update, as one string, and
 * messages are queued rather than replacing each other.
 */
class Announcer {
  readonly text = signal('');
  private queue: string[] = [];
  private speaking = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  push(message: string): void {
    this.queue.push(message);
    if (!this.speaking) this.next();
  }

  private next(): void {
    clearTimeout(this.timer);
    const message = this.queue.shift();
    if (message === undefined) {
      this.speaking = false;
      this.timer = setTimeout(() => this.text.set(''), CLEAR_AFTER);
      return;
    }
    this.speaking = true;
    this.text.set('');
    this.timer = setTimeout(() => {
      this.text.set(message);
      this.timer = setTimeout(() => this.next(), GAP);
    }, WRITE_DELAY);
  }
}

/** What a screen reader hears for a toast: the type, the message, and that an action exists. */
function spokenText(toast: Toast): string {
  const text = `${TOAST_TYPE_LABEL[toast.type]}: ${toast.message}`;
  if (!toast.action) return text;
  const stop = /[.!?]$/.test(text) ? '' : '.'; // don't double the punctuation if the message already ends a sentence
  return `${text}${stop} Action available: ${toast.action.label}.`;
}

@Injectable({ providedIn: 'root' })
export class A11yToastService {
  private nextId = 1;
  private readonly _toasts = signal<readonly Toast[]>([]);

  private readonly politeAnnouncer = new Announcer();
  private readonly assertiveAnnouncer = new Announcer();

  readonly toasts = this._toasts.asReadonly();
  /** Text of the hidden polite live region. Written once per message. */
  readonly announcement = this.politeAnnouncer.text.asReadonly();
  /** Text of the hidden assertive live region, used for errors. */
  readonly alertAnnouncement = this.assertiveAnnouncer.text.asReadonly();
  /** @deprecated No longer used by the container, which lists every toast in the order it was shown. */
  readonly polite = computed(() => this._toasts().filter((t) => t.politeness === 'polite'));
  /** @deprecated No longer used by the container, which lists every toast in the order it was shown. */
  readonly assertive = computed(() => this._toasts().filter((t) => t.politeness === 'assertive'));

  show(config: ToastConfig | string): number {
    const c: ToastConfig = typeof config === 'string' ? { message: config } : config;
    const type = c.type ?? 'info';
    const toast: Toast = {
      id: this.nextId++,
      message: c.message,
      type,
      // A toast with an action stays until dismissed, so the action can't vanish before it is reachable.
      duration: c.duration ?? (c.action ? 0 : DEFAULT_TOAST_DURATION),
      politeness: c.politeness ?? (type === 'error' ? 'assertive' : 'polite'),
      action: c.action,
    };
    this._toasts.update((list) => [...list, toast]);
    this.announce(spokenText(toast), toast.politeness);
    return toast.id;
  }

  info(message: string, config: Omit<ToastConfig, 'message' | 'type'> = {}): number {
    return this.show({ ...config, message, type: 'info' });
  }

  success(message: string, config: Omit<ToastConfig, 'message' | 'type'> = {}): number {
    return this.show({ ...config, message, type: 'success' });
  }

  warning(message: string, config: Omit<ToastConfig, 'message' | 'type'> = {}): number {
    return this.show({ ...config, message, type: 'warning' });
  }

  error(message: string, config: Omit<ToastConfig, 'message' | 'type'> = {}): number {
    return this.show({ ...config, message, type: 'error' });
  }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  dismissAll(): void {
    this._toasts.set([]);
  }

  /**
   * Announces a message to screen readers without showing it. Used for every toast, and when a toast is
   * dismissed, because a toast that disappears from under the user's focus would otherwise be silent.
   * Messages are queued, so announcing several in a row does not cut any off.
   */
  announce(message: string, politeness: 'polite' | 'assertive' = 'polite'): void {
    (politeness === 'assertive' ? this.assertiveAnnouncer : this.politeAnnouncer).push(message);
  }
}
