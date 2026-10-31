import { Injectable, computed, signal } from '@angular/core';
import { DEFAULT_TOAST_DURATION, Toast, ToastConfig } from './toast.model';

@Injectable({ providedIn: 'root' })
export class A11yToastService {
  private nextId = 1;
  private readonly _toasts = signal<readonly Toast[]>([]);

  readonly toasts = this._toasts.asReadonly();
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
}
