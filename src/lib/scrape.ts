import type { Task } from './types';

export function cellText(td: Element): string {
  const clone = td.cloneNode(true) as Element;
  const label = clone.querySelector('.ui-column-title');
  if (label) label.remove();
  clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  return (clone.textContent || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

export function scrapeTable(root: ParentNode): Task[] {
  const rows = root.querySelectorAll('.p-datatable-tbody > tr');
  const tasks: Task[] = [];
  rows.forEach((row) => {
    const cells = Array.from(row.querySelectorAll(':scope > td'));
    if (cells.length < 7) return;
    const [truckCell, numberCell, productCell, loadDateCell, loadLocCell, unloadDateCell, unloadLocCell] = cells;
    const truck = cellText(truckCell);
    const number = cellText(numberCell);
    // Skip empty/placeholder rows
    if (!truck && !number) return;
    tasks.push({
      truck,
      number,
      product: cellText(productCell),
      loadingDateTime: cellText(loadDateCell),
      loadingLocation: cellText(loadLocCell),
      unloadingDateTime: cellText(unloadDateCell),
      unloadingLocation: cellText(unloadLocCell),
    });
  });
  return tasks;
}

export function waitForTable(root: ParentNode, timeoutMs = 15000, intervalMs = 300): Promise<Task[]> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function check() {
      const rows = root.querySelectorAll('.p-datatable-tbody > tr');
      if (rows.length > 0) {
        resolve(scrapeTable(root));
        return;
      }
      if (Date.now() - start > timeoutMs) {
        const tableExists = root.querySelector('.p-datatable-container, .primeng-datatable-container, p-table');
        if (tableExists) {
          resolve([]);
        } else {
          reject(new Error('Tasks table not found on the page. Make sure you are logged in.'));
        }
        return;
      }
      setTimeout(check, intervalMs);
    }
    check();
  });
}
