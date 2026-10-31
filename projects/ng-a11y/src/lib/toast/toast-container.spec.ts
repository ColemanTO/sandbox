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

  it('always renders both live regions, even when empty', () => {
    expect(el().querySelector('[role="status"][aria-live="polite"]')).toBeTruthy();
    expect(el().querySelector('[role="alert"][aria-live="assertive"]')).toBeTruthy();
  });

  it('puts errors in the alert region and others in the status region', () => {
    service.error('Boom');
    service.success('Yay');
    fixture.detectChanges();
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('Boom');
    expect(el().querySelector('[role="status"]')?.textContent).toContain('Yay');
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
});
