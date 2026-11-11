// Service worker: owns scheduled auto-sync and the actual sync routine.
// The side panel just asks this worker to sync and reads results from storage.

import { computeTaskDiff } from './lib/sync';
import type { Settings, StoredState, Task } from './lib/types';

const TASKS_URL = 'https://portal.baldlogistics.eu/app/main/current-tasks';
const ALARM_NAME = 'auto-sync-tasks';
const DEFAULT_SETTINGS: Settings = { autoSyncEnabled: true, intervalMinutes: 10 };

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

async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get<StoredState>('settings');
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

async function scheduleAlarm(): Promise<void> {
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
async function performSync(): Promise<Task[]> {
  const tab = await chrome.tabs.create({ url: TASKS_URL, active: false });
  try {
    await waitForTabComplete(tab.id!);
    await chrome.tabs.reload(tab.id!);
    await waitForTabComplete(tab.id!);

    const response = await sendMessageWithRetry(tab.id!, { type: 'SCRAPE_TASKS' }, 5);
    if (!response || !response.ok) {
      throw new Error((response && response.error) || 'Failed to get data from the page');
    }
    const tasks: Task[] = response.tasks;
    const syncedAt = Date.now();
    const stored = await chrome.storage.local.get<StoredState>(['knownNumbers', 'unseenNumbers']);
    const { knownNumbers, unseenNumbers } = computeTaskDiff(tasks, stored.knownNumbers, stored.unseenNumbers);

    await chrome.storage.local.set({ tasks, syncedAt, knownNumbers, unseenNumbers });
    await updateBadge(unseenNumbers.length);
    return tasks;
  } finally {
    chrome.tabs.remove(tab.id!).catch(() => {});
  }
}

async function ackTask(number: string): Promise<void> {
  const { unseenNumbers = [] } = await chrome.storage.local.get<StoredState>('unseenNumbers');
  const next = unseenNumbers.filter((n: string) => n !== number);
  await chrome.storage.local.set({ unseenNumbers: next });
  await updateBadge(next.length);
}

async function updateBadge(count: number): Promise<void> {
  await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  if (count > 0) {
    await chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
  }
}

async function restoreBadge(): Promise<void> {
  const { unseenNumbers = [] } = await chrome.storage.local.get<StoredState>('unseenNumbers');
  await updateBadge(unseenNumbers.length);
}

function waitForTabComplete(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    function listener(id: number, info: chrome.tabs.OnUpdatedInfo) {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function ensureContentScript(tabId: number): Promise<void> {
  // Tabs opened before the extension was installed/reloaded never get the
  // declarative content script, which is what causes "Could not establish
  // connection. Receiving end does not exist." Inject it explicitly as a
  // fallback; content.ts guards itself against double registration.
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['src/content.js'] });
  } catch (_e) {
    // Ignore: page may not be injectable, or script is already present.
  }
}

function sendMessageWithRetry(tabId: number, msg: unknown, attemptsLeft: number): Promise<any> {
  return ensureContentScript(tabId).then(
    () =>
      new Promise((resolve, reject) => {
        function attempt(remaining: number) {
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
      })
  );
}
