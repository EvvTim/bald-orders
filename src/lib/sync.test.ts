import { describe, expect, it } from 'vitest';
import { computeTaskDiff } from './sync';
import type { Task } from './types';

function task(number: string): Task {
  return {
    truck: 'TRK-1',
    number,
    product: 'Steel',
    loadingDateTime: '07-03-2026 09:00',
    loadingLocation: '',
    unloadingDateTime: '07-03-2026 18:00',
    unloadingLocation: '',
  };
}

describe('computeTaskDiff', () => {
  it('treats the first ever sync as the baseline, with nothing unseen', () => {
    const result = computeTaskDiff([task('A'), task('B')], null, null);
    expect(result).toEqual({ knownNumbers: ['A', 'B'], unseenNumbers: [] });
  });

  it('flags task numbers not present in the known baseline as unseen', () => {
    const result = computeTaskDiff([task('A'), task('B'), task('C')], ['A', 'B'], []);
    expect(result.unseenNumbers).toEqual(['C']);
    expect(result.knownNumbers.sort()).toEqual(['A', 'B', 'C']);
  });

  it('drops previously-unseen numbers once they disappear from the current sync', () => {
    const result = computeTaskDiff([task('A')], ['A', 'B'], ['B']);
    expect(result.unseenNumbers).toEqual([]);
  });

  it('keeps a still-unacknowledged number unseen across repeated syncs', () => {
    const result = computeTaskDiff([task('A'), task('C')], ['A', 'B'], ['C']);
    expect(result.unseenNumbers).toEqual(['C']);
  });

  it('ignores tasks with an empty/falsy number', () => {
    const result = computeTaskDiff([task(''), task('A')], null, null);
    expect(result.knownNumbers).toEqual(['A']);
  });
});
