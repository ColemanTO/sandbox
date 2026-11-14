/** The text the date picker shows or reads out. Pass your own to `[labels]` to translate any of it. */
export interface A11yDatePickerLabels {
  /** Name of the calendar button when the field has no date. */
  choose: string;
  /** Name of the calendar button when the field has a date. Receives the date written out in full. */
  change: (date: string) => string;
  /** Name of the calendar dialog. */
  dialog: string;
  previousYear: string;
  previousMonth: string;
  nextMonth: string;
  nextYear: string;
  close: string;
}

export const DEFAULT_DATE_PICKER_LABELS: A11yDatePickerLabels = {
  choose: 'Choose date',
  change: (date) => `Change date, ${date}`,
  dialog: 'Choose date',
  previousYear: 'Previous year',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  nextYear: 'Next year',
  close: 'Close',
};
