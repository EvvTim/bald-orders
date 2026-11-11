const DEFAULT_SETTINGS = { autoSyncEnabled: true, intervalMinutes: 10 };

const enabledEl = document.getElementById('autoSyncEnabled');
const intervalEl = document.getElementById('intervalMinutes');
const saveBtn = document.getElementById('saveBtn');
const savedMsg = document.getElementById('savedMsg');

init();

async function init() {
  const { settings } = await chrome.storage.local.get('settings');
  const s = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  enabledEl.checked = s.autoSyncEnabled;
  intervalEl.value = s.intervalMinutes;
  intervalEl.disabled = !s.autoSyncEnabled;
}

enabledEl.addEventListener('change', () => {
  intervalEl.disabled = !enabledEl.checked;
});

saveBtn.addEventListener('click', async () => {
  const intervalMinutes = Math.max(1, Math.min(1440, Number(intervalEl.value) || DEFAULT_SETTINGS.intervalMinutes));
  intervalEl.value = intervalMinutes;
  const settings = { autoSyncEnabled: enabledEl.checked, intervalMinutes };
  await chrome.storage.local.set({ settings });
  savedMsg.textContent = 'Saved';
  setTimeout(() => {
    savedMsg.textContent = '';
  }, 1500);
});
