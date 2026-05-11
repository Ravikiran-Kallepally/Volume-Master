/**
 * Volume Master — content script
 * Connects media elements to a GainNode → optional DynamicsCompressor chain.
 */
(function () {
  'use strict';

  if (window.__vmActive) return;
  window.__vmActive = true;

  const state = {
    ctx:        null,
    gain:       null,
    compressor: null,
    volume:     1.0,
    muted:      false,
    smartBoost: false,
    connected:  new WeakMap(),
  };

  // ── Audio graph ────────────────────────────────────────────────────────────

  function ensureContext() {
    if (state.ctx && state.ctx.state !== 'closed') return true;
    try {
      state.ctx = new (window.AudioContext || window.webkitAudioContext)();
      state.gain = state.ctx.createGain();
      state.gain.gain.value = state.muted ? 0 : state.volume;
      buildChain();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wire the audio graph based on current smartBoost setting.
   *
   *   Normal:      GainNode → Destination
   *   Smart Boost: GainNode → DynamicsCompressor → Destination
   *
   * The compressor acts as a transparent limiter: it only engages near 0 dBFS,
   * catching peaks before they clip, so high gain values sound clean rather
   * than distorted.
   */
  function buildChain() {
    if (!state.ctx || !state.gain) return;

    try { state.gain.disconnect(); } catch {}

    if (state.compressor) {
      try { state.compressor.disconnect(); } catch {}
      state.compressor = null;
    }

    if (state.smartBoost) {
      const c = state.ctx.createDynamicsCompressor();
      c.threshold.value = -6;   // dB  — engage only near peaks
      c.knee.value      = 3;    // dB  — smooth onset
      c.ratio.value     = 20;   // 20:1 ≈ hard limiter
      c.attack.value    = 0.003; // 3 ms — fast enough to catch transients
      c.release.value   = 0.25;  // 250 ms
      state.compressor  = c;
      state.gain.connect(c);
      c.connect(state.ctx.destination);
    } else {
      state.gain.connect(state.ctx.destination);
    }
  }

  function resume() {
    if (state.ctx?.state === 'suspended') {
      state.ctx.resume().catch(() => {});
    }
  }

  // ── Media element connection ───────────────────────────────────────────────

  function connectMedia(el) {
    if (!el || state.connected.has(el)) return;
    if (!(el instanceof HTMLMediaElement)) return;
    if (!ensureContext()) return;
    try {
      const src = state.ctx.createMediaElementSource(el);
      src.connect(state.gain);
      state.connected.set(el, src);
      resume();
    } catch {
      // Cross-origin or already owned by another AudioContext
    }
  }

  function scanAndConnect() {
    document.querySelectorAll('audio,video').forEach(connectMedia);
  }

  new MutationObserver(mutations => {
    for (const { addedNodes } of mutations) {
      for (const node of addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches?.('audio,video')) connectMedia(node);
        node.querySelectorAll?.('audio,video').forEach(connectMedia);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('play', ({ target }) => {
    if (target instanceof HTMLMediaElement) connectMedia(target);
  }, true);

  scanAndConnect();

  // ── Message handler ────────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
    switch (msg.type) {

      case 'PING':
        respond({ ok: true });
        return false;

      case 'GET_STATE':
        respond({ volume: state.volume, muted: state.muted, smartBoost: state.smartBoost });
        return false;

      case 'SET_VOLUME':
        state.volume = msg.volume;
        if (state.gain && !state.muted) {
          state.gain.gain.value = state.volume;
        }
        scanAndConnect();
        respond({ ok: true });
        return false;

      case 'SET_MUTED':
        state.muted = msg.muted;
        if (state.gain) {
          state.gain.gain.value = state.muted ? 0 : state.volume;
        }
        respond({ ok: true });
        return false;

      case 'SET_SMART_BOOST':
        state.smartBoost = msg.enabled;
        buildChain();
        respond({ ok: true });
        return false;
    }
    return false;
  });
})();
