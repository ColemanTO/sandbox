import { ChangeDetectionStrategy, Component, DOCUMENT, effect, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { A11yToastContainer, A11yToastService } from '@colemanto/ng-a11y';

type Theme = 'system' | 'light' | 'dark' | 'high-contrast';

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

  private readonly root = inject(DOCUMENT).documentElement;
  protected readonly theme = signal<Theme>('system');
  protected readonly themes: { value: Theme; label: string }[] = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'high-contrast', label: 'High contrast' },
  ];

  constructor() {
    // "system" removes the attribute so prefers-color-scheme / prefers-contrast decide.
    effect(() => {
      const theme = this.theme();
      if (theme === 'system') this.root.removeAttribute('data-theme');
      else this.root.setAttribute('data-theme', theme);
    });
  }

  protected setTheme(event: Event): void {
    this.theme.set((event.target as HTMLSelectElement).value as Theme);
  }
}
