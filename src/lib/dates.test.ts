import { describe, expect, it } from 'vitest';
import { dayDiff, formatAbsDate, pad2, parseDMY, renderStopDateHtml, toSortableTime } from './dates';

describe('pad2', () => {
  it('pads single digits with a leading zero', () => {
    expect(pad2(3)).toBe('03');
  });

  it('leaves two-digit numbers untouched', () => {
    expect(pad2(23)).toBe('23');
  });
});

describe('formatAbsDate', () => {
  it('formats as dd.mm.yyyy', () => {
    expect(formatAbsDate(new Date(2026, 2, 7))).toBe('07.03.2026');
  });
});

describe('parseDMY', () => {
  it('parses a "DD-MM-YYYY HH:MM" string', () => {
    const { date, time } = parseDMY('07-03-2026 14:30');
    expect(time).toBe('14:30');
    expect(date).toEqual(new Date(2026, 2, 7));
  });

  it('returns a null date for malformed input', () => {
    expect(parseDMY('not-a-date 14:30')).toEqual({ date: null, time: '14:30' });
  });

  it('handles missing time', () => {
    const { date, time } = parseDMY('07-03-2026');
    expect(date).toEqual(new Date(2026, 2, 7));
    expect(time).toBe('');
  });

  it('handles empty/undefined input', () => {
    expect(parseDMY(undefined)).toEqual({ date: null, time: '' });
    expect(parseDMY('')).toEqual({ date: null, time: '' });
  });
});

describe('dayDiff', () => {
  it('is 0 for the same calendar day, ignoring time', () => {
    expect(dayDiff(new Date(2026, 2, 7, 23, 0), new Date(2026, 2, 7, 1, 0))).toBe(0);
  });

  it('is positive when a is after b', () => {
    expect(dayDiff(new Date(2026, 2, 9), new Date(2026, 2, 7))).toBe(2);
  });

  it('is negative when a is before b', () => {
    expect(dayDiff(new Date(2026, 2, 5), new Date(2026, 2, 7))).toBe(-2);
  });
});

describe('toSortableTime', () => {
  it('returns +Infinity when there is no date', () => {
    expect(toSortableTime(null, '09:00')).toBe(Number.POSITIVE_INFINITY);
  });

  it('combines date and time into a timestamp', () => {
    const t = toSortableTime(new Date(2026, 2, 7), '09:30');
    expect(t).toBe(new Date(2026, 2, 7, 9, 30).getTime());
  });

  it('defaults to midnight when time is missing', () => {
    const t = toSortableTime(new Date(2026, 2, 7), undefined);
    expect(t).toBe(new Date(2026, 2, 7, 0, 0).getTime());
  });
});

describe('renderStopDateHtml', () => {
  const now = new Date(2026, 2, 7);

  it('returns an empty string for a null date', () => {
    expect(renderStopDateHtml(null, now)).toBe('');
  });

  it('labels today', () => {
    expect(renderStopDateHtml(new Date(2026, 2, 7), now)).toBe('<strong>Today</strong> · 07.03.2026');
  });

  it('labels yesterday', () => {
    expect(renderStopDateHtml(new Date(2026, 2, 6), now)).toBe('<strong>Yesterday</strong> · 06.03.2026');
  });

  it('labels tomorrow', () => {
    expect(renderStopDateHtml(new Date(2026, 2, 8), now)).toBe('<strong>Tomorrow</strong> · 08.03.2026');
  });

  it('falls back to the weekday name for other days', () => {
    // 2026-03-10 is a Tuesday
    expect(renderStopDateHtml(new Date(2026, 2, 10), now)).toBe('Tue 10.03.2026');
  });
});
