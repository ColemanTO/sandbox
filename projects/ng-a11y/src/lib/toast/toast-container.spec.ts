import { ComponentFixture, TestBed } from '@angular/core/testing';
import { A11yToastContainer } from './toast-container';
import { A11yToastService } from './toast.service';

describe('A11yToastContainer', () => {
  let fixture: ComponentFixture<A11yToastContainer>;
  let service: A11yToastService;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    await TestBed.configureTestingModule({ imports: [A11yToastContainer] }).compileComponents();
    service = TestBed.inject(A11yToastService);
    fixture = TestBed.createComponent(A11yToastContainer);
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  const polite = () => el().querySelector('.a11y-announcer[aria-live="polite"]') as HTMLElement;
  const assertive = () => el().querySelector('.a11y-announcer[aria-live="assertive"]') as HTMLElement;
  const settle = (ms = 60) => {
    vi.advanceTimersByTime(ms);
    fixture.detectChanges();
  };

  it('always renders both hidden live regions, even when empty', () => {
    expect(polite()).toBeTruthy();
    expect(assertive()).toBeTruthy();
    expect(polite().textContent?.trim()).toBe('');
  });

  it('announces errors in the assertive region and everything else in the polite one', () => {
    service.error('Boom');
    service.success('Yay');
    fixture.detectChanges();
    settle();
    expect(assertive().textContent).toContain('Error: Boom');
    expect(polite().textContent).toContain('Success: Yay');
    expect(assertive().textContent).not.toContain('Yay');
  });

  it('writes the whole announcement in one update, never in pieces', () => {
    const seen: string[] = [];
    const watch = () => seen.push(polite().textContent!.trim());
    service.success('Your changes were saved.');
    fixture.detectChanges();
    for (let i = 0; i < 10; i++) {
      settle(10);
      watch();
    }
    expect(seen.filter((t) => t)).toEqual(Array(seen.filter((t) => t).length).fill('Success: Your changes were saved.'));
    expect(seen.some((t) => t === 'Success: Your changes were saved.')).toBe(true);
  });

  it('tells screen reader users when a toast has an action', () => {
    service.info('Item deleted.', { action: { label: 'Undo', handler: () => {} } });
    fixture.detectChanges();
    settle();
    expect(polite().textContent).toContain('Information: Item deleted. Action available: Undo.');
  });

  it('queues announcements instead of dropping one when toasts arrive together', () => {
    service.success('First');
    service.success('Second');
    fixture.detectChanges();
    settle(60);
    expect(polite().textContent).toContain('First');
    settle(450);
    expect(polite().textContent).toContain('Second');
  });

  it('empties the live region afterwards, so nothing stale is left behind', () => {
    service.success('Gone soon');
    fixture.detectChanges();
    settle(60);
    expect(polite().textContent).toContain('Gone soon');
    settle(4000);
    expect(polite().textContent?.trim()).toBe('');
  });

  it('keeps the visible toasts out of any live region', () => {
    service.success('Visible');
    service.error('Visible too');
    fixture.detectChanges();
    expect(el().querySelectorAll('a11y-toast-item')).toHaveLength(2);
    const region = el().querySelector('.a11y-toast-region')!;
    expect(region.getAttribute('aria-live')).toBeNull();
    expect(region.getAttribute('role')).toBeNull();
    expect(region.querySelector('[aria-live], [role="status"], [role="alert"]')).toBeNull();
  });

  it('puts the visible toasts in a named landmark that exists only while toasts are showing', () => {
    expect(el().querySelector('section')).toBeNull();
    service.info('Hello', { duration: 0 });
    fixture.detectChanges();
    const landmark = el().querySelector('section.a11y-toast-region')!;
    expect(landmark.getAttribute('aria-label')).toBe('Notifications');
    (el().querySelector('.a11y-toast__close') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el().querySelector('section')).toBeNull();
  });

  it('lists toasts in the order they were shown, whatever their type', () => {
    service.success('One');
    service.error('Two');
    service.info('Three');
    fixture.detectChanges();
    const texts = Array.from(el().querySelectorAll('a11y-toast-item')).map((i) => i.textContent!);
    expect(texts[0]).toContain('One');
    expect(texts[1]).toContain('Two');
    expect(texts[2]).toContain('Three');
  });

  it('prefixes the type so it is not conveyed by color alone', () => {
    service.warning('Low disk');
    fixture.detectChanges();
    expect(el().textContent).toContain('Warning: Low disk');
  });

  it('auto-dismisses after the duration', () => {
    service.info('Bye', { duration: 1000 });
    fixture.detectChanges();
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();
    expect(service.toasts()).toHaveLength(0);
  });

  it('keeps a toast with duration 0 until dismissed', () => {
    service.info('Stay', { duration: 0 });
    fixture.detectChanges();
    vi.advanceTimersByTime(60_000);
    expect(service.toasts()).toHaveLength(1);
    (el().querySelector('.a11y-toast__close') as HTMLButtonElement).click();
    expect(service.toasts()).toHaveLength(0);
  });

  it('pauses on focus and dismisses with Escape', () => {
    service.info('Focus me', { duration: 1000 });
    fixture.detectChanges();
    const item = el().querySelector('a11y-toast-item') as HTMLElement;
    item.dispatchEvent(new FocusEvent('focusin'));
    vi.advanceTimersByTime(5000);
    expect(service.toasts()).toHaveLength(1);
    item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(service.toasts()).toHaveLength(0);
  });

  it('runs an action and then dismisses', () => {
    const handler = vi.fn();
    service.info('Deleted', { duration: 0, action: { label: 'Undo', handler } });
    fixture.detectChanges();
    const buttons = el().querySelectorAll<HTMLButtonElement>('button');
    buttons[0].click();
    expect(handler).toHaveBeenCalled();
    expect(service.toasts()).toHaveLength(0);
  });

  it('keeps a toast with an action on screen when no duration is given', () => {
    service.info('Deleted', { action: { label: 'Undo', handler: () => {} } });
    fixture.detectChanges();
    vi.advanceTimersByTime(10 * 60_000);
    fixture.detectChanges();
    expect(service.toasts()).toHaveLength(1);
  });

  it('times out a toast with an action when the app sets a duration', () => {
    service.info('Deleted', { duration: 3000, action: { label: 'Undo', handler: () => {} } });
    fixture.detectChanges();
    vi.advanceTimersByTime(3000);
    fixture.detectChanges();
    expect(service.toasts()).toHaveLength(0);
  });

  describe('when dismissed', () => {
    const announcer = () => polite();

    // jsdom keeps the last focused element around; start every test with nothing focused.
    beforeEach(() => (document.activeElement as HTMLElement | null)?.blur());

    it('announces "Notification dismissed" when the user closes a toast', () => {
      service.info('Hello', { duration: 0 });
      fixture.detectChanges();
      (el().querySelector('.a11y-toast__close') as HTMLButtonElement).click();
      settle(60);
      expect(announcer().textContent).toContain('Information: Hello'); // the toast's own announcement goes first
      settle(450);
      expect(announcer().textContent).toContain('Notification dismissed');
    });

    it('does not announce when a toast simply times out', () => {
      service.info('Bye', { duration: 1000 });
      fixture.detectChanges();
      settle(1000);
      expect(service.toasts()).toHaveLength(0);
      settle(1000); // plenty of time for any dismissal message to be spoken
      expect(announcer().textContent).not.toContain('dismissed');
    });

    it('keeps the announcer out of the status/alert roles', () => {
      expect(announcer().getAttribute('role')).toBeNull();
      expect(announcer().getAttribute('aria-live')).toBe('polite');
    });

    it('returns focus to where the user came from instead of dropping it', () => {
      const trigger = document.createElement('button');
      document.body.append(trigger);
      service.info('Hello', { duration: 0 });
      fixture.detectChanges();
      const item = el().querySelector('a11y-toast-item') as HTMLElement;
      const close = item.querySelector('.a11y-toast__close') as HTMLButtonElement;
      trigger.focus();
      close.focus();
      item.dispatchEvent(new FocusEvent('focusin', { relatedTarget: trigger }));
      close.click();
      expect(document.activeElement).toBe(trigger);
      trigger.blur();
      trigger.remove();
    });

    it('moves focus to another toast when there is nowhere to go back to', () => {
      service.info('First', { duration: 0 });
      service.info('Second', { duration: 0 });
      fixture.detectChanges();
      const [first, second] = Array.from(el().querySelectorAll('a11y-toast-item')) as HTMLElement[];
      (first.querySelector('.a11y-toast__close') as HTMLButtonElement).focus();
      (first.querySelector('.a11y-toast__close') as HTMLButtonElement).click();
      expect(document.activeElement).toBe(second.querySelector('button'));
    });
  });
});
