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
    // Single message — avoids tearing down the audio graph 3× per slider tick
    await chrome.tabs.sendMessage(tabId, { type: 'SET_AUDIO_STATE', volume, muted, smartBoost });
  } catch {}
  return true;
}

// ── Per-site memory ──────────────────────────────────────────────────────────

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!tab.url || !/^https?:/.test(tab.url)) return;

  let hostname;
  try { hostname = new URL(tab.url).hostname; } catch { return; }

  // In-app (SPA) navigation — e.g. switching episodes on a streaming site.
  // These fire with changeInfo.url but no 'complete' status, so the full-load
  // restore below never runs and the boost gets dropped on the new episode.
  // Re-assert the live session boost (SPA navigation can't change origin, so
  // carrying the current tab's level is safe); fall back to per-site memory.
  if (info.url && info.status !== 'complete') {
    const cur = tabState[tabId];
    if (cur && (cur.volume !== 1.0 || cur.muted)) {
      await applyToTab(tabId, cur.volume, cur.muted, cur.smartBoost);
      return;
    }
    const stored = await chrome.storage.local.get(hostname);
    const saved  = stored[hostname];
    if (saved != null && saved.volume !== 1.0) {
      await applyToTab(tabId, saved.volume, false, saved.smartBoost ?? false);
    }
    return;
  }

  // Full page load — restore from per-site memory.
  if (info.status === 'complete') {
    const stored = await chrome.storage.local.get(hostname);
    const saved  = stored[hostname];
    if (saved != null && saved.volume !== 1.0) {
      await applyToTab(tabId, saved.volume, false, saved.smartBoost ?? false);
    }
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
            windowId:   t.windowId,
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
