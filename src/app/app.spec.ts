import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('@colemanto/ng-a11y');
    expect(compiled.querySelector('a11y-toast-container')).toBeTruthy();
  });

  describe('dark mode switch', () => {
    const root = () => document.documentElement;
    const switchEl = (fixture: { nativeElement: HTMLElement }) => fixture.nativeElement.querySelector('[role="switch"]') as HTMLButtonElement;

    beforeEach(() => {
      localStorage.clear();
      root().removeAttribute('data-theme');
    });

    it('starts off and without a theme when nothing is saved', async () => {
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      expect(switchEl(fixture).getAttribute('aria-checked')).toBe('false');
      expect(root().hasAttribute('data-theme')).toBe(false);
    });

    it('toggles between dark and light and remembers the choice', async () => {
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      switchEl(fixture).click();
      await fixture.whenStable();
      expect(root().getAttribute('data-theme')).toBe('dark');
      expect(switchEl(fixture).getAttribute('aria-checked')).toBe('true');
      expect(localStorage.getItem('a11y-demo-theme')).toBe('dark');
      switchEl(fixture).click();
      await fixture.whenStable();
      expect(root().getAttribute('data-theme')).toBe('light');
      expect(switchEl(fixture).getAttribute('aria-checked')).toBe('false');
    });

    it('restores a saved theme', async () => {
      localStorage.setItem('a11y-demo-theme', 'dark');
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      expect(root().getAttribute('data-theme')).toBe('dark');
      expect(switchEl(fixture).getAttribute('aria-checked')).toBe('true');
    });

    it('ignores an invalid saved value', async () => {
      localStorage.setItem('a11y-demo-theme', 'purple');
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      expect(root().hasAttribute('data-theme')).toBe(false);
    });

    it('is disabled in high contrast', async () => {
      localStorage.setItem('a11y-demo-theme', 'high-contrast');
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      expect(switchEl(fixture).disabled).toBe(true);
    });
  });
});
