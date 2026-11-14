import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { STORY_STYLES } from '../story-styles';
import { A11yErrorSummary } from './error-summary';
import { ErrorMessages } from './error-summary.model';

/** A sign-up form with the summary at the top. Submit it empty to see the summary. */
@Component({
  selector: 'story-error-summary',
  imports: [ReactiveFormsModule, A11yErrorSummary],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" novalidate aria-label="Create an account">
      <a11y-error-summary [form]="form" [messages]="messages()" [heading]="heading()" [headingLevel]="headingLevel()" />
      <div class="field">
        <label for="story-name">Full name</label>
        <input id="story-name" formControlName="name" autocomplete="name" />
      </div>
      <div class="field">
        <label for="story-email">Email</label>
        <input id="story-email" type="email" formControlName="email" autocomplete="email" />
      </div>
      <div class="field field--checkbox">
        <input id="story-terms" type="checkbox" formControlName="terms" />
        <label for="story-terms">I agree to the terms</label>
      </div>
      <button type="submit">Create account</button>
    </form>
  `,
  styles: STORY_STYLES,
})
class ErrorSummaryStory {
  readonly heading = input('There is a problem');
  readonly headingLevel = input<2 | 3 | 4 | 5 | 6>(2);
  readonly messages = input<ErrorMessages>({});

  protected readonly form = new FormGroup({
    name: new FormControl('', Validators.required),
    email: new FormControl('', [Validators.required, Validators.email]),
    terms: new FormControl(false, Validators.requiredTrue),
  });
}

const MESSAGES: ErrorMessages = {
  name: 'Enter your full name',
  email: { required: 'Enter your email address', email: 'Enter an email address like name@example.com' },
  terms: 'Agree to the terms to continue',
};

const meta: Meta<ErrorSummaryStory> = {
  title: 'Components/Error summary',
  component: ErrorSummaryStory,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Press **Create account** with the form empty. The summary appears, takes focus, and lists each invalid ' +
          'field as a link that focuses it. Entries go away as fields are fixed. Place `<a11y-error-summary>` inside ' +
          'the `<form>` it summarizes and pass it the `FormGroup`.',
      },
    },
  },
  argTypes: {
    heading: { control: 'text', description: 'Text of the heading.' },
    headingLevel: { control: 'inline-radio', options: [2, 3, 4, 5, 6], description: '`aria-level` of the heading.' },
    messages: { control: 'object', description: 'Message for each field, by control name or dotted path.' },
    // Part of the story's own wrapper, not an input of the component.
    ...({ form: { table: { disable: true } } } as object),
  },
  args: { messages: MESSAGES },
};
export default meta;

type Story = StoryObj<ErrorSummaryStory>;

export const Default: Story = {};
export const CustomHeading: Story = { args: { heading: 'Fix these before you continue', headingLevel: 3 } };
/** Without messages, each entry falls back to "Check" plus the field's label, and a warning is logged. */
export const WithoutMessages: Story = { args: { messages: {} } };
