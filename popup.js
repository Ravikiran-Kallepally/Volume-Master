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
const saveLabelEl     = $('save-label');
const iconSave        = btnSave.querySelector('.icon-save');
const iconUnsave      = btnSave.querySelector('.icon-unsave');
const savedBadge      = $('saved-badge');
const tabsList        = $('tabs-list');
const tabCountEl      = $('tab-count');
const smartBoostRow   = $('smart-boost-row');
const btnSmartBoost   = $('btn-smart-boost');
const smartBoostDesc  = $('smart-boost-desc');
const btnShare        = $('btn-share');
const shareLabelEl    = $('share-label');
const shareOverlay    = $('share-overlay');
const shareClose      = $('share-close');
const shareUrlDisplay = $('share-url-display');
const shareUrlCopy    = $('share-url-copy');

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

function setSaveState(saved) {
  btnSave.classList.toggle('unsaved', saved);
  iconSave.style.display    = saved ? 'none' : '';
  iconUnsave.style.display  = saved ? '' : 'none';
  saveLabelEl.textContent   = saved ? 'Unsave' : 'Save for site';
  if (saved) savedBadge.classList.add('visible');
  else       savedBadge.classList.remove('visible');
}

async function saveSite() {
  if (!hostname) return;
  try {
    await bgMsg({ type: 'SAVE_SITE_VOLUME', hostname, volume, smartBoost });
    setSaveState(true);
    showToast(`Saved for ${hostname}`);
  } catch {}
}

async function unsaveSite() {
  if (!hostname) return;
  try {
    await bgMsg({ type: 'SAVE_SITE_VOLUME', hostname, volume: 1.0, smartBoost: false });
    setSaveState(false);
    showToast(`Removed saved setting for ${hostname}`);
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
      if (res?.saved) setSaveState(true);
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

    row.addEventListener('click', async () => {
      await chrome.tabs.update(t.id, { active: true });
      if (t.windowId) chrome.windows.update(t.windowId, { focused: true });
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

btnSave.addEventListener('click', () => {
  btnSave.classList.contains('unsaved') ? unsaveSite() : saveSite();
});

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

// ── Share panel ───────────────────────────────────────────────────────────────
const STORE_URL   = 'https://chromewebstore.google.com/detail/fhlnjpnemdhhoejgdelndonecnbeolok';
const SHARE_TEXT  = 'Boost your browser volume up to 1000%! Free Chrome extension 🔊';
const SHARE_TITLE = 'Volume Master — Up to 1000% Volume Boost';

function openSharePanel() {
  shareUrlDisplay.textContent = STORE_URL;

  const url  = encodeURIComponent(STORE_URL);
  const text = encodeURIComponent(SHARE_TEXT);
  const title = encodeURIComponent(SHARE_TITLE);

  $('share-linkedin').href  = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
  $('share-facebook').href  = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
  $('share-reddit').href    = `https://www.reddit.com/submit?url=${url}&title=${title}`;
  $('share-twitter').href   = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
  $('share-whatsapp').href  = `https://wa.me/?text=${encodeURIComponent(SHARE_TEXT + ' ' + STORE_URL)}`;

  shareOverlay.classList.add('visible');
}

btnShare.addEventListener('click', openSharePanel);

shareClose.addEventListener('click', () => shareOverlay.classList.remove('visible'));

// Close on backdrop click
shareOverlay.addEventListener('click', e => {
  if (e.target === shareOverlay) shareOverlay.classList.remove('visible');
});

shareUrlCopy.addEventListener('click', () => {
  navigator.clipboard.writeText(STORE_URL).then(() => {
    shareUrlCopy.classList.add('copied');
    shareUrlCopy.childNodes[0].textContent = 'Copied!';
    setTimeout(() => {
      shareUrlCopy.classList.remove('copied');
      shareUrlCopy.childNodes[0].textContent = 'Copy';
    }, 2000);
  }).catch(() => chrome.tabs.create({ url: STORE_URL }));
});

// ── Rate us nudge (sentiment-gated) ───────────────────────────────────────────
// Asks only engaged users (5+ opens), once, snoozes on "Maybe later", never nags
// after a final action. Step 1 asks how they feel: happy users are routed to the
// store review page; unhappy users are routed to private feedback — so frustration
// becomes a message to us instead of a 1-star review.
const REVIEW_URL       = `${STORE_URL}/reviews`;
const FEEDBACK_URL     = 'mailto:ravikirankallepally@gmail.com?subject=Volume%20Master%20feedback';
const RATE_MIN_USES    = 3;        // show after this many opens…
const RATE_MIN_DAYS    = 2;        // …OR after this many days installed (+1 use)
const RATE_SNOOZE_STEP = 7;        // "Maybe later" → wait this many more opens
const DAY_MS           = 86400000;

const rateCard    = $('rate-card');
const rateClose   = $('rate-close');
const rateStepAsk   = $('rate-step-ask');
const rateStepHappy = $('rate-step-happy');
const rateStepSad   = $('rate-step-sad');

async function maybeShowRatePrompt() {
  let store;
  try {
    store = await chrome.storage.local.get(
      ['vm_uses', 'vm_rate_done', 'vm_rate_snooze', 'vm_first_seen']);
  } catch { return; }

  if (store.vm_rate_done) return;            // already acted or dismissed for good

  const now       = Date.now();
  const firstSeen = store.vm_first_seen || now;
  const uses      = (store.vm_uses || 0) + 1;
  chrome.storage.local.set({ vm_uses: uses, vm_first_seen: firstSeen });

  // Respect a "Maybe later" snooze (a use-count gate) before anything else.
  if (store.vm_rate_snooze && uses < store.vm_rate_snooze) return;

  // Per-site memory means many users rarely reopen the popup — so also trigger
  // on days-installed, not just open count, to reach set-and-forget users.
  const daysInstalled = (now - firstSeen) / DAY_MS;
  const engaged = uses >= RATE_MIN_USES || (daysInstalled >= RATE_MIN_DAYS && uses >= 1);
  if (engaged) rateCard.hidden = false; // step 1 is visible by default
}

function showRateStep(step) {
  rateStepAsk.hidden   = (step !== 'ask');
  rateStepHappy.hidden = (step !== 'happy');
  rateStepSad.hidden   = (step !== 'sad');
}

function hideRate(permanent) {
  rateCard.hidden = true;
  if (permanent) chrome.storage.local.set({ vm_rate_done: true });
}

async function snoozeRate() {
  const { vm_uses = 0 } = await chrome.storage.local.get('vm_uses');
  chrome.storage.local.set({ vm_rate_snooze: vm_uses + RATE_SNOOZE_STEP });
  hideRate(false);
}

// Step 1 — sentiment fork
$('rate-yes').addEventListener('click', () => showRateStep('happy'));
$('rate-no').addEventListener('click',  () => showRateStep('sad'));

// Step 2a — happy → store review
$('rate-now').addEventListener('click', () => {
  chrome.tabs.create({ url: REVIEW_URL });
  hideRate(true);
  window.close();
});
$('rate-later-happy').addEventListener('click', snoozeRate);

// Step 2b — unhappy → private feedback
$('rate-feedback').addEventListener('click', () => {
  chrome.tabs.create({ url: FEEDBACK_URL });
  hideRate(true);
  window.close();
});
$('rate-later-sad').addEventListener('click', snoozeRate);

rateClose.addEventListener('click', () => hideRate(true)); // × = don't ask again

// Passive, always-available rate link in the footer — never interrupts, lets
// motivated users rate any time without waiting for the prompt.
$('footer-rate').addEventListener('click', () => {
  chrome.tabs.create({ url: REVIEW_URL });
});

maybeShowRatePrompt();

// ── Shortcut sync — poll while popup is open ──────────────────────────────────
// Keeps the displayed volume in sync when the user uses keyboard shortcuts
// (Alt+Shift+↑↓M) without closing and reopening the popup.
setInterval(async () => {
  if (!currentTab) return;
  try {
    const s = await bgMsg({ type: 'GET_TAB_STATE', tabId: currentTab.id });
    if (!s) return;
    const changed = s.volume !== volume || s.muted !== muted;
    if (changed) {
      volume = s.volume;
      muted  = s.muted;
      // Preserve manual smartBoost override; only sync if no manual lock
      if (smartBoostManual === null) smartBoost = s.smartBoost;
      updateUI(volume, muted, smartBoost);
    }
  } catch {}
}, 500);

// ── Boot ──────────────────────────────────────────────────────────────────────
init().catch(console.error);
