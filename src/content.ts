// Content script: scrapes the "Current tasks" PrimeNG table rendered by the
// Angular app on https://portal.baldlogistics.eu/app/main/current-tasks
//
// Guard against double registration: this file can be injected twice (once
// automatically by the manifest's content_scripts, once programmatically by
// background.ts as a fallback for tabs that were already open), which would
// otherwise register the onMessage listener twice.

import { waitForTable } from './lib/scrape';

declare global {
  interface Window {
    __baldTasksContentScriptLoaded?: boolean;
  }
}

if (!window.__baldTasksContentScriptLoaded) {
  window.__baldTasksContentScriptLoaded = true;
  initTasksContentScript();
}

function initTasksContentScript() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && message.type === 'SCRAPE_TASKS') {
      waitForTable(document)
        .then((tasks) => sendResponse({ ok: true, tasks }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true; // keep the message channel open for the async response
    }
  });
}
