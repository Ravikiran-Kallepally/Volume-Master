'use strict';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const faviconEl       = $('favicon');
const tabTitleEl      = $('tab-title');
const volNumEl        = $('vol-num');
const slider          = $('vol-slider');
const controlsEl      = $('controls');
const noAccessEl      = $('no-access');
const btnMute         = $('btn-mute');
const muteLabelEl     = $('mute-label');
const btnReset        = $('btn-reset');
const btnSave         = $('btn-save');
const savedBadge      = $('saved-badge');
const tabsList        = $('tabs-list');
const tabCountEl      = $('tab-count');
const smartBoostRow   = $('smart-boost-row');
const btnSmartBoost   = $('btn-smart-boost');
const smartBoostDesc  = $('smart-boost-desc');

// ── State ─────────────────────────────────────────────────────────────────────
let currentTab        = null;
let volume            = 1.0;
let muted             = false;
let smartBoost        = false;
let smartBoostManual  = null;  // null = auto-managed | true/false = user locked
let hostname          = null;
let applyTimer        = null;

const MAX_VOL      = 10.0;   // 1000%
const BOOST_THRESH = 4.0;    // 400% — auto Smart Boost threshold

// ── Helpers ───────────────────────────────────────────────────────────────────

function bgMsg(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, res => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve(res);
    });
  });
}

function pct(v)  { return Math.round(v * 100); }

function volColor(v) {
  const p = pct(v);
  if (p <= 100) return '#a78bfa';
  if (p <= 200) return '#10b981';
  if (p <= 400) return '#f59e0b';
  return '#ef4444';
}

function volZone(v) {
  const p = pct(v);
  if (p <= 100) return 'normal';
  if (p <= 200) return 'boost';
  if (p <= 400) return 'high';
  return 'max';
}

function updateSliderTrack(v) {
  const fillPct = (v / MAX_VOL) * 100;
  slider.style.setProperty('--fill',       `${fillPct.toFixed(2)}%`);
  slider.style.setProperty('--fill-color', volColor(v));
}

function updateUI(v, isMuted, isSmartBoost) {
  volNumEl.textContent = pct(v);
  controlsEl.dataset.zone = volZone(v);

  document.querySelector('.volume-display').classList.toggle('is-muted', isMuted);
  btnMute.classList.toggle('muted', isMuted);
  muteLabelEl.textContent = isMuted ? 'Unmute' : 'Mute';

  slider.value = pct(v);
  updateSliderTrack(v);

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.v, 10) === pct(v));
  });

  // Smart Boost toggle
  smartBoostRow.classList.toggle('active', isSmartBoost);
  btnSmartBoost.setAttribute('aria-pressed', String(isSmartBoost));

  // Subtitle — tells user whether they're in auto or manual mode
  if (smartBoostManual !== null) {
    smartBoostDesc.textContent = isSmartBoost
      ? 'Manually enabled · Reset to restore auto'
      : 'Manually disabled · Reset to restore auto';
  } else {
    smartBoostDesc.textContent = 'Auto-enables at 400% · Toggle anytime';
  }
}

function showToast(msg, duration = 1800) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

// ── Smart Boost auto-management ───────────────────────────────────────────────

/**
 * Applies auto Smart Boost logic for a given volume.
 * Only runs when no manual override is active.
 * Returns true if Smart Boost state changed (so caller can show toast).
 */
function autoManageSmartBoost(newVolume) {
  if (smartBoostManual !== null) return; // user is in control — don't interfere

  const shouldBoost = newVolume >= BOOST_THRESH;
  if (shouldBoost === smartBoost) return; // no change needed

  smartBoost = shouldBoost;
  if (shouldBoost) showToast('⚡ Smart Boost auto-enabled');
}

// ── Set volume (shared by slider + presets) ───────────────────────────────────

function setVolume(newVolume) {
  autoManageSmartBoost(newVolume);
  volume = newVolume;
}

// ── Apply (debounced 50 ms) ───────────────────────────────────────────────────

function scheduleApply() {
  clearTimeout(applyTimer);
  applyTimer = setTimeout(applyNow, 50);
}

async function applyNow() {
  if (!currentTab) return;
  try {
    await bgMsg({ type: 'SET_TAB_VOLUME', tabId: currentTab.id, volume, muted, smartBoost });
  } catch {}
}

// ── Per-site save ─────────────────────────────────────────────────────────────

async function saveSite() {
  if (!hostname) return;
  try {
    await bgMsg({ type: 'SAVE_SITE_VOLUME', hostname, volume, smartBoost });
    btnSave.classList.add('saved');
    savedBadge.classList.add('visible');
    showToast(`Saved for ${hostname}`);
    setTimeout(() => btnSave.classList.remove('saved'), 2000);
  } catch {}
}

// ── Initialise ────────────────────────────────────────────────────────────────

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  currentTab = tab;

  if (tab.favIconUrl) {
    faviconEl.src = tab.favIconUrl;
    faviconEl.style.display = 'inline';
  }
  tabTitleEl.textContent = tab.title || tab.url || 'Unknown tab';

  try { hostname = tab.url ? new URL(tab.url).hostname : null; } catch {}

  if (hostname) {
    try {
      const res = await bgMsg({ type: 'GET_SITE_VOLUME', hostname });
      if (res?.saved) savedBadge.classList.add('visible');
    } catch {}
  }

  const canInject = tab.url &&
    (tab.url.startsWith('http://') || tab.url.startsWith('https://') || tab.url.startsWith('file://'));

  if (!canInject) {
    controlsEl.style.display = 'none';
    noAccessEl.classList.add('visible');
  } else {
    controlsEl.style.display = '';
    noAccessEl.classList.remove('visible');

    let state = null;
    try { state = await bgMsg({ type: 'GET_TAB_STATE', tabId: tab.id }); } catch {}

    volume     = state?.volume     ?? 1.0;
    muted      = state?.muted      ?? false;
    smartBoost = state?.smartBoost ?? false;

    // If loaded state is inconsistent with auto-mode, treat it as a manual lock
    // so the user's saved choice isn't overwritten on the first slider touch.
    const autoWouldBe = volume >= BOOST_THRESH;
    if (smartBoost !== autoWouldBe) {
      smartBoostManual = smartBoost;
    }

    updateUI(volume, muted, smartBoost);
  }

  loadAudioTabs(tab.id);
}

// ── Audio tabs list ───────────────────────────────────────────────────────────

async function loadAudioTabs(currentTabId) {
  let tabs = [];
  try { tabs = await bgMsg({ type: 'GET_AUDIO_TABS' }); } catch {}

  const others = tabs.filter(t => t.id !== currentTabId);
  tabCountEl.textContent = others.length;

  if (others.length === 0) {
    tabsList.innerHTML = '<div class="empty-state">No other audio tabs</div>';
    return;
  }

  tabsList.innerHTML = '';
  others.forEach(t => {
    const row = document.createElement('div');
    row.className = 'tab-row';
    row.title = t.title;

    const p = pct(t.volume);
    let badgeClass = 'tab-vol-badge';
    let badgeText  = `${p}%`;
    if (t.muted)        { badgeClass += ' muted';   badgeText = 'Muted'; }
    else if (p !== 100) { badgeClass += ' boosted'; }

    row.innerHTML = `
      <img class="favicon" src="${t.favIconUrl || ''}" alt="" width="16" height="16"
           onerror="this.style.display='none'">
      <span class="tab-row-title">${escHtml(t.title || t.url)}</span>
      <span class="${badgeClass}">${badgeText}</span>
      <svg class="tab-row-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none">
        <polyline points="9 18 15 12 9 6" stroke="currentColor" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;

    row.addEventListener('click', () => {
      chrome.tabs.update(t.id, { active: true });
      window.close();
    });
    tabsList.appendChild(row);
  });
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Event listeners ───────────────────────────────────────────────────────────

slider.addEventListener('input', () => {
  setVolume(parseInt(slider.value, 10) / 100);
  updateUI(volume, muted, smartBoost);
  scheduleApply();
});

btnMute.addEventListener('click', () => {
  muted = !muted;
  updateUI(volume, muted, smartBoost);
  applyNow();
});

btnReset.addEventListener('click', () => {
  volume           = 1.0;
  muted            = false;
  smartBoost       = false;
  smartBoostManual = null;   // restore auto mode
  updateUI(volume, muted, smartBoost);
  applyNow();
});

btnSave.addEventListener('click', saveSite);

// Smart Boost manual toggle — locks user's choice until Reset
smartBoostRow.addEventListener('click', () => {
  smartBoost       = !smartBoost;
  smartBoostManual = smartBoost; // lock to this value
  updateUI(volume, muted, smartBoost);
  applyNow();
});

// Presets — also run auto Smart Boost logic
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    muted = false;
    setVolume(parseInt(btn.dataset.v, 10) / 100);
    updateUI(volume, muted, smartBoost);
    applyNow();
  });
});

// ── Boot ──────────────────────────────────────────────────────────────────────
init().catch(console.error);
