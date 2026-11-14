import { addDays, addMonths, firstDayOfWeek, formatDate, parseDate, weekday } from './date-picker.dates';

describe('date picker dates', () => {
  it('formats an ISO date in the given format', () => {
    expect(formatDate('2026-03-05', 'dd/MM/yyyy')).toBe('05/03/2026');
    expect(formatDate('2026-03-05', 'MM/dd/yyyy')).toBe('03/05/2026');
    expect(formatDate('2026-03-05', 'yyyy-MM-dd')).toBe('2026-03-05');
    expect(formatDate('2026-03-05', 'dd.MM.yyyy')).toBe('05.03.2026');
  });

  it('parses typed text, with or without leading zeros', () => {
    expect(parseDate('05/03/2026', 'dd/MM/yyyy')).toBe('2026-03-05');
    expect(parseDate(' 5/3/2026 ', 'dd/MM/yyyy')).toBe('2026-03-05');
    expect(parseDate('3/5/2026', 'MM/dd/yyyy')).toBe('2026-03-05');
    expect(parseDate('05.03.2026', 'dd.MM.yyyy')).toBe('2026-03-05');
  });

  it('returns null for anything that is not a real date in the format', () => {
    expect(parseDate('', 'dd/MM/yyyy')).toBeNull();
    expect(parseDate(null, 'dd/MM/yyyy')).toBeNull();
    expect(parseDate('30/02/2026', 'dd/MM/yyyy')).toBeNull();
    expect(parseDate('29/02/2025', 'dd/MM/yyyy')).toBeNull();
    expect(parseDate('29/02/2024', 'dd/MM/yyyy')).toBe('2024-02-29');
    expect(parseDate('05/03/26', 'dd/MM/yyyy')).toBeNull();
    expect(parseDate('2026-03-05', 'dd/MM/yyyy')).toBeNull();
    expect(parseDate('05x03x2026', 'dd.MM.yyyy')).toBeNull(); // the dot is a literal, not "any character"
  });

  it('moves by days across month, year and daylight saving boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30'); // clocks change in Europe on the 29th
    expect(addDays('2026-11-01', 7)).toBe('2026-11-08');
  });

  it('moves by months, keeping the day where it exists', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
    expect(addMonths('2024-02-29', 12)).toBe('2025-02-28');
  });

  it('knows the day of the week and where a week starts', () => {
    expect(weekday('2026-11-14')).toBe(6); // a Saturday
    expect(firstDayOfWeek('en-US')).toBe(0);
    expect(firstDayOfWeek('en-GB')).toBe(1);
  });
});
