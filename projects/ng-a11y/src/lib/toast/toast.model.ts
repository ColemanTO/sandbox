export type ToastType = 'info' | 'success' | 'warning' | 'error';

/** The word read before a toast's message, so the type is never conveyed by color or an icon alone. */
export const TOAST_TYPE_LABEL: Record<ToastType, string> = {
  info: 'Information',
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
};

export interface ToastAction {
  label: string;
  handler: () => void;
}

export interface ToastConfig {
  /** Visible message. Also what screen readers announce. */
  message: string;
  type?: ToastType;
  /**
   * Milliseconds before the toast dismisses itself. `0` keeps it until the user dismisses it.
   *
   * Default: `5000`, except a toast with an `action` defaults to `0`, so the action can't disappear
   * before a keyboard or screen reader user reaches it (WCAG 2.1.1, 2.2.1). Set `duration` explicitly
   * to override either default, for example `duration: 8000` to give an Undo a timer.
   */
  duration?: number;
  /** Optional single action, such as "Undo". Dismisses the toast when run. Makes `duration` default to `0`. */
  action?: ToastAction;
  /** Overrides the default politeness (errors are assertive, others polite). */
  politeness?: 'polite' | 'assertive';
}

export interface Toast extends Required<Pick<ToastConfig, 'message' | 'type' | 'duration' | 'politeness'>> {
  id: number;
  action?: ToastAction;
}

/** Default `duration` for a toast without an action. A toast with an action defaults to 0 (stays). */
export const DEFAULT_TOAST_DURATION = 5000;
