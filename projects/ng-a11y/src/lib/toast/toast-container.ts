import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { A11yToastItem } from './toast-item';
import { A11yToastService } from './toast.service';

/**
 * Place once near the root of your app: `<a11y-toast-container />`.
 *
 * Screen readers hear each toast once, from two hidden live regions (polite and assertive) that are always in
 * the DOM, because screen readers only announce changes to a live region that already exists. Errors go to the
 * assertive region; everything else is announced politely. The visible toasts are not live regions: content
 * inserted piece by piece into a live region can be read more than once.
 */
@Component({
  selector: 'a11y-toast-container',
  imports: [A11yToastItem],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- The visible toasts are ordinary content, not a live region. Screen readers hear each toast once,
         from the hidden announcers below, which are always in the DOM and written in a single update. -->
    @if (service.toasts().length) {
      <!-- A named landmark, present only while toasts are showing: content should sit inside a landmark, and
           screen reader users can jump to it from the landmark list. -->
      <section class="a11y-toast-region" [attr.aria-label]="label()">
        @for (t of service.toasts(); track t.id) {
          <a11y-toast-item [toast]="t" (dismissed)="onDismissed(t.id, $event)" />
        }
      </section>
    }
    <div class="a11y-announcer" aria-live="polite" aria-atomic="true">{{ service.announcement() }}</div>
    <div class="a11y-announcer" aria-live="assertive" aria-atomic="true">{{ service.alertAnnouncement() }}</div>
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
  /** Accessible name of the landmark that holds the toasts. Translate it for your users. */
  readonly label = input('Notifications');

  protected readonly service = inject(A11yToastService);

  protected onDismissed(id: number, reason: 'timeout' | 'user'): void {
    this.service.dismiss(id);
    // A timed-out toast was already announced when it appeared; only say something when the user acted.
    if (reason === 'user') this.service.announce('Notification dismissed');
  }
}
