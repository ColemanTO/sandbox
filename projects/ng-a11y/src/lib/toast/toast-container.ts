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
        <a11y-toast-item [toast]="t" (dismissed)="onDismissed(t.id, $event)" />
      }
    </div>
    <div class="a11y-toast-region" role="alert" aria-live="assertive" aria-atomic="false">
      @for (t of service.assertive(); track t.id) {
        <a11y-toast-item [toast]="t" (dismissed)="onDismissed(t.id, $event)" />
      }
    </div>
    <!-- No role: it must not become a second "status" region. It only speaks when a toast is dismissed by the user. -->
    <div class="a11y-announcer" aria-live="polite" aria-atomic="true">{{ service.announcement() }}</div>
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
    .a11y-announcer {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
})
export class A11yToastContainer {
  protected readonly service = inject(A11yToastService);

  protected onDismissed(id: number, reason: 'timeout' | 'user'): void {
    this.service.dismiss(id);
    // A timed-out toast was already announced when it appeared; only say something when the user acted.
    if (reason === 'user') this.service.announce('Notification dismissed');
  }
}
