import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { STORY_STYLES } from '../story-styles';
import { A11yDatePicker } from './date-picker';
import { formatDate } from './date-picker.dates';

/** A labelled date field with a hint, wrapped by the picker. */
@Component({
  selector: 'story-date-picker',
  imports: [A11yDatePicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field">
      <label for="story-date">Start date</label>
      <p id="story-date-hint" class="hint">For example, {{ example() }}</p>
      <a11y-date-picker [format]="format()" [min]="min() || null" [max]="max() || null" [locale]="locale() || undefined" [weekStartsOn]="weekStartsOn()">
        <input id="story-date" autocomplete="off" aria-describedby="story-date-hint" [value]="value()" [disabled]="disabled()" />
      </a11y-date-picker>
    </div>
  `,
  styles: [STORY_STYLES, `.hint { margin: 0 0 4px; } .field input { width: 12em !important; } :host { min-height: 460px; }`],
})
class DatePickerStory {
  readonly format = input('yyyy-MM-dd');
  readonly min = input('');
  readonly max = input('');
  readonly locale = input('');
  readonly weekStartsOn = input<number | undefined>(undefined);
  readonly value = input('');
  readonly disabled = input(false);

  protected example = () => formatDate('2026-11-27', this.format());
}

const meta: Meta<DatePickerStory> = {
  title: 'Components/Date picker',
  component: DatePickerStory,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Type a date, or press the calendar button to choose one. In the calendar: arrow keys move by day and ' +
          'week, Home and End go to the start and end of the week, Page Up and Page Down change the month (with ' +
          'Shift, the year), Enter or Space chooses, Escape closes. `<a11y-date-picker>` wraps your own labelled ' +
          '`<input>`, so it works with any kind of form.',
      },
    },
  },
  argTypes: {
    format: {
      control: 'inline-radio',
      options: ['yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy', 'dd.MM.yyyy'],
      description: 'How the date is written in the input, made of `dd`, `MM` and `yyyy`.',
    },
    min: { control: 'text', description: 'Earliest date that can be chosen, as `yyyy-MM-dd`.' },
    max: { control: 'text', description: 'Latest date that can be chosen, as `yyyy-MM-dd`.' },
    locale: { control: 'text', description: 'Locale for month and day names, such as `fr-FR`. Defaults to the browser.' },
    weekStartsOn: { control: 'inline-radio', options: [undefined, 0, 1, 6], description: 'First day of the week, 0 (Sunday) to 6. Defaults to the locale.' },
    value: { control: 'text', description: 'Story only: what the input holds to begin with.' },
    disabled: { control: 'boolean', description: 'Story only: disables the input, and with it the calendar button.' },
    // Part of the story's own wrapper, not an input of the component.
    ...({ example: { table: { disable: true } } } as object),
  },
};
export default meta;

type Story = StoryObj<DatePickerStory>;

export const Default: Story = {};
export const DayFirst: Story = { args: { format: 'dd/MM/yyyy', locale: 'en-GB' } };
export const WithADate: Story = { args: { format: 'dd/MM/yyyy', locale: 'en-GB', value: '05/03/2026' } };
/** Days outside the range are struck through, announced as unavailable, and cannot be chosen. */
export const MinAndMax: Story = { args: { value: '2026-11-14', min: '2026-11-10', max: '2026-11-20' } };
export const French: Story = { args: { format: 'dd/MM/yyyy', locale: 'fr-FR' } };
export const Disabled: Story = { args: { value: '2026-11-14', disabled: true } };
