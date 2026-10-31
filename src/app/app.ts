import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { A11yToastContainer, A11yToastService } from '@colemanto/ng-a11y';

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
}
