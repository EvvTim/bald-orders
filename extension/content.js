// Content script: scrapes the "Current tasks" PrimeNG table rendered by the
// Angular app on https://portal.baldlogistics.eu/app/main/current-tasks
//
// Guard against double registration: this file can be injected twice (once
// automatically by the manifest's content_scripts, once programmatically by
// background.js as a fallback for tabs that were already open), which would
// otherwise register the onMessage listener twice.
if (!window.__baldTasksContentScriptLoaded) {
  window.__baldTasksContentScriptLoaded = true;
  initTasksContentScript();
}

function initTasksContentScript() {
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === 'SCRAPE_TASKS') {
    waitForTable()
      .then((tasks) => sendResponse({ ok: true, tasks }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // keep the message channel open for the async response
  }
});

function cellText(td) {
  const clone = td.cloneNode(true);
  const label = clone.querySelector('.ui-column-title');
  if (label) label.remove();
  clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  return clone.textContent
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

function scrapeTable() {
  const rows = document.querySelectorAll('.p-datatable-tbody > tr');
  const tasks = [];
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

function waitForTable(timeoutMs = 15000, intervalMs = 300) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function check() {
      const rows = document.querySelectorAll('.p-datatable-tbody > tr');
      if (rows.length > 0) {
        resolve(scrapeTable());
        return;
      }
      if (Date.now() - start > timeoutMs) {
        const tableExists = document.querySelector('.p-datatable-container, .primeng-datatable-container, p-table');
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
} // end initTasksContentScript
