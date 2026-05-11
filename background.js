/**
 * Volume Master — service worker
 * Manages per-tab state, per-site memory, and keyboard shortcuts.
 */

// In-memory tab state: tabId → { volume, muted, smartBoost }
const tabState = {};

// ── Injection ────────────────────────────────────────────────────────────────

async function ensureInjected(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    return true;
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      return true;
    } catch {
      return false;
    }
  }
}

async function applyToTab(tabId, volume, muted, smartBoost = false) {
  const ok = await ensureInjected(tabId);
  if (!ok) return false;
  tabState[tabId] = { volume, muted, smartBoost };
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'SET_VOLUME',      volume });
    await chrome.tabs.sendMessage(tabId, { type: 'SET_MUTED',       muted });
    await chrome.tabs.sendMessage(tabId, { type: 'SET_SMART_BOOST', enabled: smartBoost });
  } catch {}
  return true;
}

// ── Per-site memory ──────────────────────────────────────────────────────────

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== 'complete') return;
  if (!tab.url || !/^https?:/.test(tab.url)) return;

  let hostname;
  try { hostname = new URL(tab.url).hostname; } catch { return; }

  const stored = await chrome.storage.local.get(hostname);
  const saved  = stored[hostname];
  if (saved != null) {
    const { volume, smartBoost } = saved;
    if (volume !== 1.0) await applyToTab(tabId, volume, false, smartBoost ?? false);
  }
});

// ── Cleanup ──────────────────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener(tabId => {
  delete tabState[tabId];
});

// ── Keyboard shortcuts ───────────────────────────────────────────────────────

chrome.commands.onCommand.addListener(async command => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  const cur = tabState[tab.id] ?? { volume: 1.0, muted: false, smartBoost: false };

  if (command === 'increase-volume') {
    const v = Math.min(10.0, parseFloat((cur.volume + 0.1).toFixed(2)));
    await applyToTab(tab.id, v, cur.muted, cur.smartBoost);
  } else if (command === 'decrease-volume') {
    const v = Math.max(0, parseFloat((cur.volume - 0.1).toFixed(2)));
    await applyToTab(tab.id, v, cur.muted, cur.smartBoost);
  } else if (command === 'toggle-mute') {
    await applyToTab(tab.id, cur.volume, !cur.muted, cur.smartBoost);
  }
});

// ── Popup messages ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  (async () => {
    switch (msg.type) {

      case 'GET_TAB_STATE':
        respond(tabState[msg.tabId] ?? { volume: 1.0, muted: false, smartBoost: false });
        break;

      case 'SET_TAB_VOLUME': {
        const ok = await applyToTab(msg.tabId, msg.volume, msg.muted ?? false, msg.smartBoost ?? false);
        respond({ ok });
        break;
      }

      case 'SAVE_SITE_VOLUME': {
        const { hostname, volume, smartBoost } = msg;
        if (volume === 1.0) {
          await chrome.storage.local.remove(hostname);
        } else {
          await chrome.storage.local.set({ [hostname]: { volume, smartBoost } });
        }
        respond({ ok: true });
        break;
      }

      case 'GET_SITE_VOLUME': {
        const stored = await chrome.storage.local.get(msg.hostname);
        respond({ saved: stored[msg.hostname] ?? null });
        break;
      }

      case 'GET_AUDIO_TABS': {
        const all = await chrome.tabs.query({});
        const audio = all
          .filter(t => t.audible || tabState[t.id])
          .map(t => ({
            id:         t.id,
            title:      t.title,
            url:        t.url,
            favIconUrl: t.favIconUrl,
            audible:    !!t.audible,
            volume:     tabState[t.id]?.volume     ?? 1.0,
            muted:      tabState[t.id]?.muted      ?? false,
            smartBoost: tabState[t.id]?.smartBoost ?? false,
          }));
        respond(audio);
        break;
      }
    }
  })();
  return true;
});
