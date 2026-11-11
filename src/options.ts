import type { Settings, StoredState } from './lib/types';

const DEFAULT_SETTINGS: Settings = { autoSyncEnabled: true, intervalMinutes: 10 };

const enabledEl = document.getElementById('autoSyncEnabled') as HTMLInputElement;
const intervalEl = document.getElementById('intervalMinutes') as HTMLInputElement;
const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
const savedMsg = document.getElementById('savedMsg') as HTMLElement;

init();

async function init() {
  const { settings } = await chrome.storage.local.get<StoredState>('settings');
  const s: Settings = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  enabledEl.checked = s.autoSyncEnabled;
  intervalEl.value = String(s.intervalMinutes);
  intervalEl.disabled = !s.autoSyncEnabled;
}

enabledEl.addEventListener('change', () => {
  intervalEl.disabled = !enabledEl.checked;
});

saveBtn.addEventListener('click', async () => {
  const intervalMinutes = Math.max(1, Math.min(1440, Number(intervalEl.value) || DEFAULT_SETTINGS.intervalMinutes));
  intervalEl.value = String(intervalMinutes);
  const settings: Settings = { autoSyncEnabled: enabledEl.checked, intervalMinutes };
  await chrome.storage.local.set({ settings });
  savedMsg.textContent = 'Saved';
  setTimeout(() => {
    savedMsg.textContent = '';
  }, 1500);
});
