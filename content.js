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
    connected:  new WeakMap(), // elements successfully connected
    failed:     new WeakSet(), // elements that can't be connected (skip retries)
  };

  // ── Audio graph ────────────────────────────────────────────────────────────

  function ensureContext() {
    if (state.ctx && state.ctx.state !== 'closed') return true;
    try {
      state.ctx  = new (window.AudioContext || window.webkitAudioContext)();
      state.gain = state.ctx.createGain();
      state.gain.gain.value = state.muted ? 0 : state.volume;
      buildChain();
      return true;
    } catch {
      return false;
    }
  }

  function tryResume() {
    if (state.ctx && state.ctx.state === 'suspended') {
      // Use a void-returning wrapper so rejection never surfaces as unhandled
      void state.ctx.resume().catch(() => {});
    }
  }

  /**
   * Wire the audio graph. Only called when Smart Boost actually toggles —
   * NOT on every volume update (that caused the audio pipeline to break).
   *
   *   Normal:      GainNode → Destination
   *   Smart Boost: GainNode → DynamicsCompressor → Destination
   */
  function buildChain() {
    if (!state.ctx || !state.gain) return;
    if (state.ctx.state === 'closed') return; // context invalidated by the page

    try {
      try { state.gain.disconnect(); } catch {}

      if (state.compressor) {
        try { state.compressor.disconnect(); } catch {}
        state.compressor = null;
      }

      if (state.smartBoost) {
        const c = state.ctx.createDynamicsCompressor();
        c.threshold.value = -6;    // dB — engage only near peaks
        c.knee.value      = 3;     // dB — smooth onset
        c.ratio.value     = 20;    // 20:1 ≈ hard limiter
        c.attack.value    = 0.003; // 3 ms
        c.release.value   = 0.25;  // 250 ms
        state.compressor  = c;
        state.gain.connect(c);
        c.connect(state.ctx.destination);
      } else {
        state.gain.connect(state.ctx.destination);
      }
    } catch {
      // Context was closed or invalidated by the host page (e.g. YouTube
      // tearing down its own AudioContext). Reset so ensureContext rebuilds.
      state.ctx        = null;
      state.gain       = null;
      state.compressor = null;
      return;
    }

    tryResume();
  }

  // ── Apply audio state (shared by message handler + iframe relay) ──────────

  function applyAudioState(msg) {
    const boostChanged = (state.smartBoost !== msg.smartBoost);
    state.volume     = msg.volume;
    state.muted      = msg.muted;
    state.smartBoost = msg.smartBoost;
    if (boostChanged) buildChain();
    if (state.gain) state.gain.gain.value = state.muted ? 0 : state.volume;
    scanAndConnect();
  }

  // ── Media element connection ───────────────────────────────────────────────

  function connectMedia(el) {
    if (!el) return;
    if (state.connected.has(el)) return;
    if (state.failed.has(el))    return; // already tried and failed — stop retrying
    if (!(el instanceof HTMLMediaElement)) return;
    if (!ensureContext()) return;

    try {
      const src = state.ctx.createMediaElementSource(el);
      src.connect(state.gain);
      state.connected.set(el, src);
      tryResume();
    } catch {
      // Element is cross-origin or already owned by another AudioContext
      // (common on YouTube). Mark as failed so we don't spam retries.
      state.failed.add(el);
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

  // ── Cross-origin iframe relay ──────────────────────────────────────────────
  window.addEventListener('message', e => {
    const msg = e.data?.__vm;
    if (!msg || msg.type !== 'SET_AUDIO_STATE') return;
    applyAudioState(msg);
    for (let i = 0; i < window.frames.length; i++) {
      try { window.frames[i].postMessage(e.data, '*'); } catch {}
    }
  });

  // ── Message handler ────────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
    switch (msg.type) {

      case 'PING':
        respond({ ok: true });
        return false;

      case 'GET_STATE':
        respond({ volume: state.volume, muted: state.muted, smartBoost: state.smartBoost });
        return false;

      case 'SET_AUDIO_STATE':
        applyAudioState(msg);
        for (let i = 0; i < window.frames.length; i++) {
          try { window.frames[i].postMessage({ __vm: msg }, '*'); } catch {}
        }
        respond({ ok: true });
        return false;
    }
    return false;
  });
})();
