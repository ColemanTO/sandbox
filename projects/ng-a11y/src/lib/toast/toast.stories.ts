import { ChangeDetectionStrategy, Component, DestroyRef, inject, input } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { STORY_STYLES } from '../story-styles';
import { A11yToastContainer } from './toast-container';
import { ToastType } from './toast.model';
import { A11yToastService } from './toast.service';

/** A button that shows a toast, plus the container an app places once near its root. */
@Component({
  selector: 'story-toast',
  imports: [A11yToastContainer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <button type="button" (click)="show()">Show toast</button>
      <button type="button" (click)="toasts.dismissAll()">Dismiss all</button>
    </div>
    <a11y-toast-container [label]="label()" />
  `,
  styles: STORY_STYLES,
})
class ToastStory {
  readonly message = input('Your changes were saved.');
  readonly type = input<ToastType>('info');
  /** Milliseconds; leave empty for the default (5000, or 0 with an action). */
  readonly duration = input<number | undefined>(undefined);
  readonly actionLabel = input('');
  readonly label = input('Notifications');

  protected readonly toasts = inject(A11yToastService);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.toasts.dismissAll());
  }

  protected show(): void {
    const label = this.actionLabel();
    this.toasts.show({
      message: this.message(),
      type: this.type(),
      duration: this.duration() ?? undefined,
      action: label ? { label, handler: () => this.toasts.success(`${label} done.`) } : undefined,
    });
  }
}

const meta: Meta<ToastStory> = {
  title: 'Components/Toast',
  component: ToastStory,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Press **Show toast**. Each toast is announced once to screen readers from a hidden live region; errors are ' +
          'announced assertively. A toast pauses while hovered or focused, closes with Escape, and returns focus to ' +
          'where the user came from. Call `A11yToastService` from your code and place `<a11y-toast-container />` once.',
      },
    },
  },
  argTypes: {
    message: { control: 'text', description: 'Visible message, and what screen readers announce.' },
    type: { control: 'inline-radio', options: ['info', 'success', 'warning', 'error'] },
    duration: { control: 'number', description: 'Milliseconds before it dismisses itself. 0 keeps it until dismissed.' },
    actionLabel: { control: 'text', description: 'Label of an optional action. A toast with an action stays until dismissed.' },
    label: { control: 'text', description: 'Accessible name of the landmark that holds the toasts.' },
    // Parts of the story's own wrapper, not inputs of the component.
    ...({ toasts: { table: { disable: true } }, show: { table: { disable: true } } } as object),
  },
};
export default meta;

type Story = StoryObj<ToastStory>;

export const Info: Story = { args: { type: 'info', message: 'Heads up: this is informational.' } };
export const Success: Story = { args: { type: 'success', message: 'Your changes were saved.' } };
export const Warning: Story = { args: { type: 'warning', message: 'Your session expires soon.' } };
export const Error: Story = { args: { type: 'error', message: 'Could not save your changes.' } };
export const WithAction: Story = { args: { type: 'info', message: 'Item deleted.', actionLabel: 'Undo' } };
export const StaysUntilDismissed: Story = { args: { type: 'info', message: 'This stays until you dismiss it.', duration: 0 } };
