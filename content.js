/**
 * Volume Master — content script
 * Connects media elements to a GainNode so volume can exceed 100%.
 */
(function () {
  'use strict';

  if (window.__vmActive) return;
  window.__vmActive = true;

  const state = {
    ctx: null,
    gain: null,
    volume: 1.0,
    muted: false,
    connected: new WeakMap(),
  };

  function ensureContext() {
    if (state.ctx && state.ctx.state !== 'closed') return true;
    try {
      state.ctx = new (window.AudioContext || window.webkitAudioContext)();
      state.gain = state.ctx.createGain();
      state.gain.gain.value = state.muted ? 0 : state.volume;
      state.gain.connect(state.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function resume() {
    if (state.ctx?.state === 'suspended') {
      state.ctx.resume().catch(() => {});
    }
  }

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

  // Pick up elements added after initial scan
  new MutationObserver(mutations => {
    for (const { addedNodes } of mutations) {
      for (const node of addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches?.('audio,video')) connectMedia(node);
        node.querySelectorAll?.('audio,video').forEach(connectMedia);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  // Catch elements that start playing before we observe them
  document.addEventListener('play', ({ target }) => {
    if (target instanceof HTMLMediaElement) connectMedia(target);
  }, true);

  scanAndConnect();

  // ── Message handler ──────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
    switch (msg.type) {
      case 'PING':
        respond({ ok: true });
        return false;

      case 'GET_STATE':
        respond({ volume: state.volume, muted: state.muted });
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
    }
    return false;
  });
})();
