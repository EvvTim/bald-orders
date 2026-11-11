// Service worker: owns scheduled auto-sync and the actual sync routine.
// The popup just asks this worker to sync and reads results from storage.

const TASKS_URL = 'https://portal.baldlogistics.eu/app/main/current-tasks';
const ALARM_NAME = 'auto-sync-tasks';
const DEFAULT_SETTINGS = { autoSyncEnabled: true, intervalMinutes: 10 };

chrome.runtime.onInstalled.addListener(() => {
  // Makes clicking the toolbar icon open the side panel directly, instead of
  // requiring the user to pick it from a dropdown.
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  chrome.storage.local.get('settings').then(({ settings }) => {
    if (!settings) chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  });
  scheduleAlarm();
  restoreBadge();
});
chrome.runtime.onStartup.addListener(() => {
  scheduleAlarm();
  restoreBadge();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) {
    scheduleAlarm();
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    performSync().catch((err) => console.warn('Auto-sync failed:', err.message));
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === 'SYNC_NOW') {
    performSync()
      .then((tasks) => sendResponse({ ok: true, tasks }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // keep channel open for async response
  }
  if (message && message.type === 'ACK_TASK') {
    ackTask(message.number)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

async function scheduleAlarm() {
  const settings = await getSettings();
  await chrome.alarms.clear(ALARM_NAME);
  if (settings.autoSyncEnabled) {
    const periodInMinutes = Math.max(1, Number(settings.intervalMinutes) || DEFAULT_SETTINGS.intervalMinutes);
    chrome.alarms.create(ALARM_NAME, { periodInMinutes, delayInMinutes: periodInMinutes });
  }
}

// Every sync opens a fresh background tab on the tasks page, force-reloads
// it to bypass any stale SPA state, scrapes the table, and closes the tab
// again — it never touches a tab the user might already have open there.
async function performSync() {
  const tab = await chrome.tabs.create({ url: TASKS_URL, active: false });
  try {
    await waitForTabComplete(tab.id);
    await chrome.tabs.reload(tab.id);
    await waitForTabComplete(tab.id);

    const response = await sendMessageWithRetry(tab.id, { type: 'SCRAPE_TASKS' }, 5);
    if (!response || !response.ok) {
      throw new Error((response && response.error) || 'Failed to get data from the page');
    }
    const tasks = response.tasks;
    const syncedAt = Date.now();
    const { knownNumbers, unseenNumbers } = await diffNewTasks(tasks);

    await chrome.storage.local.set({ tasks, syncedAt, knownNumbers, unseenNumbers });
    await updateBadge(unseenNumbers.length);
    return tasks;
  } finally {
    chrome.tabs.remove(tab.id).catch(() => {});
  }
}

// Tracks which task numbers have been seen before (knownNumbers, the
// baseline) and which newly-appeared ones the user hasn't acknowledged yet
// (unseenNumbers, drives the badge + "New" label until the card is hovered).
async function diffNewTasks(tasks) {
  const stored = await chrome.storage.local.get(['knownNumbers', 'unseenNumbers']);
  const currentNumbers = tasks.map((t) => t.number).filter(Boolean);
  const currentSet = new Set(currentNumbers);

  if (!stored.knownNumbers) {
    // First sync ever: establish the baseline, nothing is flagged as "new".
    return { knownNumbers: currentNumbers, unseenNumbers: [] };
  }

  const knownSet = new Set(stored.knownNumbers);
  const unseenSet = new Set(stored.unseenNumbers || []);
  currentNumbers.forEach((n) => {
    if (!knownSet.has(n)) unseenSet.add(n);
  });

  const unseenNumbers = [...unseenSet].filter((n) => currentSet.has(n));
  const knownNumbers = [...new Set([...stored.knownNumbers, ...currentNumbers])];
  return { knownNumbers, unseenNumbers };
}

async function ackTask(number) {
  const { unseenNumbers = [] } = await chrome.storage.local.get('unseenNumbers');
  const next = unseenNumbers.filter((n) => n !== number);
  await chrome.storage.local.set({ unseenNumbers: next });
  await updateBadge(next.length);
}

async function updateBadge(count) {
  await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  if (count > 0) {
    await chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
  }
}

async function restoreBadge() {
  const { unseenNumbers = [] } = await chrome.storage.local.get('unseenNumbers');
  await updateBadge(unseenNumbers.length);
}

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function ensureContentScript(tabId) {
  // Tabs opened before the extension was installed/reloaded never get the
  // declarative content script, which is what causes "Could not establish
  // connection. Receiving end does not exist." Inject it explicitly as a
  // fallback; content.js guards itself against double registration.
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  } catch (_e) {
    // Ignore: page may not be injectable, or script is already present.
  }
}

async function sendMessageWithRetry(tabId, msg, attemptsLeft) {
  await ensureContentScript(tabId);
  return new Promise((resolve, reject) => {
    function attempt(remaining) {
      chrome.tabs.sendMessage(tabId, msg, (response) => {
        if (chrome.runtime.lastError || !response) {
          if (remaining > 0) {
            setTimeout(() => attempt(remaining - 1), 800);
          } else {
            reject(
              new Error(
                (chrome.runtime.lastError && chrome.runtime.lastError.message) ||
                  'The tasks page is not responding. Make sure you are logged in.'
              )
            );
          }
          return;
        }
        resolve(response);
      });
    }
    attempt(attemptsLeft);
  });
}
