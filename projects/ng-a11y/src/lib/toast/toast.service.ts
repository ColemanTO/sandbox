import { Injectable, computed, signal } from '@angular/core';
import { DEFAULT_TOAST_DURATION, Toast, ToastConfig } from './toast.model';

@Injectable({ providedIn: 'root' })
export class A11yToastService {
  private nextId = 1;
  private readonly _toasts = signal<readonly Toast[]>([]);

  private readonly _announcement = signal('');
  private announceTimer: ReturnType<typeof setTimeout> | undefined;

  readonly toasts = this._toasts.asReadonly();
  /** Text for the container's hidden live region. Set by {@link announce}. */
  readonly announcement = this._announcement.asReadonly();
  readonly polite = computed(() => this._toasts().filter((t) => t.politeness === 'polite'));
  readonly assertive = computed(() => this._toasts().filter((t) => t.politeness === 'assertive'));

  show(config: ToastConfig | string): number {
    const c: ToastConfig = typeof config === 'string' ? { message: config } : config;
    const type = c.type ?? 'info';
    const toast: Toast = {
      id: this.nextId++,
      message: c.message,
      type,
      duration: c.duration ?? DEFAULT_TOAST_DURATION,
      politeness: c.politeness ?? (type === 'error' ? 'assertive' : 'polite'),
      action: c.action,
    };
    this._toasts.update((list) => [...list, toast]);
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
   * Announces a short message to screen readers without showing it. Used when a toast is dismissed,
   * because a toast that disappears from under the user's focus would otherwise be silent.
   */
  announce(message: string): void {
    clearTimeout(this.announceTimer);
    // Clear first so repeating the same message still counts as a change.
    this._announcement.set('');
    this.announceTimer = setTimeout(() => {
      this._announcement.set(message);
      this.announceTimer = setTimeout(() => this._announcement.set(''), 3000);
    }, 50);
  }
}
