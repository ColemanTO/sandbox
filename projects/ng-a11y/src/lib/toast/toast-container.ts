import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { A11yToastItem } from './toast-item';
import { A11yToastService } from './toast.service';

/**
 * Place once near the root of your app: `<a11y-toast-container />`.
 *
 * The two live regions are always in the DOM, because screen readers only
 * announce changes to a live region that already exists. Errors go to the
 * assertive region; everything else is announced politely.
 */
@Component({
  selector: 'a11y-toast-container',
  imports: [A11yToastItem],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="a11y-toast-region" role="status" aria-live="polite" aria-atomic="false">
      @for (t of service.polite(); track t.id) {
        <a11y-toast-item [toast]="t" (dismissed)="service.dismiss(t.id)" />
      }
    </div>
    <div class="a11y-toast-region" role="alert" aria-live="assertive" aria-atomic="false">
      @for (t of service.assertive(); track t.id) {
        <a11y-toast-item [toast]="t" (dismissed)="service.dismiss(t.id)" />
      }
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      inset-block-end: 16px;
      inset-inline: 16px;
      z-index: 1100;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      pointer-events: none;
    }
    .a11y-toast-region { display: flex; flex-direction: column; gap: 8px; align-items: center; }
    a11y-toast-item { pointer-events: auto; }
  `,
})
export class A11yToastContainer {
  protected readonly service = inject(A11yToastService);
}
