import type { Observable } from 'rxjs';

/**
 * Messages shown in the summary, written by the app so the wording fits the form.
 *
 * Keys are control names (or dotted paths such as `address.postcode`; a path wins over a bare name).
 * A value is either one message for every error, or a map from validator error key to message:
 *
 * ```ts
 * { name: 'Enter your name', email: { required: 'Enter your email', email: 'Enter a valid email' } }
 * ```
 *
 * Use the key `$form` to reword the fallback shown when the form is invalid but no single field is to blame.
 */
export type ErrorMessages = Record<string, string | Record<string, string>>;

/**
 * The parts of an Angular `FormGroup` / `FormArray` / `FormControl` the summary reads. Declared here,
 * rather than importing `@angular/forms`, so this package does not depend on it. Pass your form as is.
 */
export interface ErrorSummaryControl {
  readonly invalid: boolean;
  readonly valid: boolean;
  readonly disabled: boolean;
  readonly errors: Record<string, unknown> | null;
  readonly controls?: Record<string, ErrorSummaryControl> | readonly ErrorSummaryControl[];
  readonly statusChanges: Observable<unknown>;
}
