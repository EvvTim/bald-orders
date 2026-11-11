import type { ParsedDateTime } from './types';

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// Always dd.mm.yyyy for absolute dates.
export function formatAbsDate(d: Date): string {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

// Scraped as "DD-MM-YYYY HH:MM" by content.ts.
export function parseDMY(raw: string | undefined | null): ParsedDateTime {
  const parts = (raw || '').split(/\s+/).filter(Boolean);
  const datePart = parts[0] || '';
  const timePart = parts[1] || '';
  const m = datePart.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return { date: null, time: timePart };
  const [, dd, mm, yyyy] = m;
  return { date: new Date(Number(yyyy), Number(mm) - 1, Number(dd)), time: timePart || '' };
}

export function dayDiff(a: Date, b: Date): number {
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((da.getTime() - db.getTime()) / 86400000);
}

export function toSortableTime(dateObj: Date | null, timeStr: string | undefined): number {
  if (!dateObj) return Number.POSITIVE_INFINITY;
  const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
  return new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), hh || 0, mm || 0).getTime();
}

export function renderStopDateHtml(dateObj: Date | null, now: Date = new Date()): string {
  if (!dateObj) return '';
  const diff = dayDiff(dateObj, now);
  if (diff === 0) return `<strong>Today</strong> · ${formatAbsDate(dateObj)}`;
  if (diff === -1) return `<strong>Yesterday</strong> · ${formatAbsDate(dateObj)}`;
  if (diff === 1) return `<strong>Tomorrow</strong> · ${formatAbsDate(dateObj)}`;
  return `${WEEKDAYS[dateObj.getDay()]} ${formatAbsDate(dateObj)}`;
}
