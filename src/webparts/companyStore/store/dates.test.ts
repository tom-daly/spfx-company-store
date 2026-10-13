import { dayText, fromIsoDate, isIsoDate, isoDate, today } from './dates';

describe('days kept as text', () => {
  it('writes a day as text and reads it back', () => {
    expect(isoDate(new Date(2026, 9, 5))).toBe('2026-10-05');
    expect(today(new Date(2026, 0, 31, 23, 59))).toBe('2026-01-31');
    expect(fromIsoDate('2026-10-05')).toEqual(new Date(2026, 9, 5));
  });

  it('turns away anything that is not a real day', () => {
    expect(isIsoDate('2026-02-31')).toBe(false);
    expect(isIsoDate('15/10/2026')).toBe(false);
    expect(isIsoDate('')).toBe(false);
    expect(isIsoDate(' 2026-10-15 ')).toBe(true);
  });

  it('says the day in words', () => {
    expect(dayText('2026-10-15')).toBe('Thu 15 Oct 2026');
    expect(dayText('nonsense')).toBe('');
  });
});
