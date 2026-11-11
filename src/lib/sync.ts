import type { DiffNewTasksResult, Task } from './types';

// Tracks which task numbers have been seen before (knownNumbers, the
// baseline) and which newly-appeared ones the user hasn't acknowledged yet
// (unseenNumbers, drives the badge + "New" label until the card is hovered).
//
// `storedKnownNumbers` is `undefined`/`null` only on the very first sync ever,
// in which case the current tasks become the baseline and nothing is "new".
export function computeTaskDiff(
  tasks: Task[],
  storedKnownNumbers: string[] | undefined | null,
  storedUnseenNumbers: string[] | undefined | null
): DiffNewTasksResult {
  const currentNumbers = tasks.map((t) => t.number).filter(Boolean);
  const currentSet = new Set(currentNumbers);

  if (!storedKnownNumbers) {
    return { knownNumbers: currentNumbers, unseenNumbers: [] };
  }

  const knownSet = new Set(storedKnownNumbers);
  const unseenSet = new Set(storedUnseenNumbers || []);
  currentNumbers.forEach((n) => {
    if (!knownSet.has(n)) unseenSet.add(n);
  });

  const unseenNumbers = [...unseenSet].filter((n) => currentSet.has(n));
  const knownNumbers = [...new Set([...storedKnownNumbers, ...currentNumbers])];
  return { knownNumbers, unseenNumbers };
}
