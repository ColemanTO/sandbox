import { ChangeDetectionStrategy, Component, DOCUMENT, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { A11yToastContainer, A11yToastService } from '@colemanto/ng-a11y';

type Theme = 'system' | 'light' | 'dark' | 'high-contrast';

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'high-contrast', label: 'High contrast' },
];
const STORAGE_KEY = 'a11y-demo-theme';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, A11yToastContainer],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('sandbox');
  protected readonly toast = inject(A11yToastService);
  protected readonly undo = () => this.toast.success('Deletion undone.');

  private readonly doc = inject(DOCUMENT);
  private readonly root = this.doc.documentElement;
  private readonly media = this.doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
  private readonly prefersDark = signal(this.media?.matches ?? false);

  protected readonly themes = THEMES;
  protected readonly theme = signal<Theme>(this.storedTheme());
  /** What the user actually sees: an explicit choice, or the OS setting when on "System". */
  protected readonly isDark = computed(() => this.theme() === 'dark' || (this.theme() === 'system' && this.prefersDark()));

  constructor() {
    const onChange = (e: MediaQueryListEvent) => this.prefersDark.set(e.matches);
    this.media?.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => this.media?.removeEventListener('change', onChange));

    // "system" removes the attribute so prefers-color-scheme / prefers-contrast decide.
    effect(() => {
      const theme = this.theme();
      if (theme === 'system') this.root.removeAttribute('data-theme');
      else this.root.setAttribute('data-theme', theme);
    });
  }

  protected setTheme(event: Event): void {
    this.choose((event.target as HTMLSelectElement).value as Theme);
  }

  protected toggleDark(): void {
    this.choose(this.isDark() ? 'light' : 'dark');
  }

  /** Saves immediately, not in the effect, so a quick reload can't lose the choice. */
  private choose(theme: Theme): void {
    this.theme.set(theme);
    this.storeTheme(theme);
  }

  private storedTheme(): Theme {
    try {
      const saved = this.doc.defaultView?.localStorage.getItem(STORAGE_KEY);
      return THEMES.some((t) => t.value === saved) ? (saved as Theme) : 'system';
    } catch {
      return 'system'; // storage can be blocked (private windows, site settings)
    }
  }

  private storeTheme(theme: Theme): void {
    try {
      this.doc.defaultView?.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* the choice just won't persist */
    }
  }
}
