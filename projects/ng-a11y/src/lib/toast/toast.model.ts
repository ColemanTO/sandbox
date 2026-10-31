export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastAction {
  label: string;
  handler: () => void;
}

export interface ToastConfig {
  /** Visible message. Also what screen readers announce. */
  message: string;
  type?: ToastType;
  /**
   * Milliseconds before auto-dismiss. Use 0 to keep the toast until the user
   * dismisses it (WCAG 2.2.1: give users enough time to read).
   */
  duration?: number;
  /** Optional single action, such as "Undo". Dismisses the toast when run. */
  action?: ToastAction;
  /** Overrides the default politeness (errors are assertive, others polite). */
  politeness?: 'polite' | 'assertive';
}

export interface Toast extends Required<Pick<ToastConfig, 'message' | 'type' | 'duration' | 'politeness'>> {
  id: number;
  action?: ToastAction;
}

export const DEFAULT_TOAST_DURATION = 5000;
