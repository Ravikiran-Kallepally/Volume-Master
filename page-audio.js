/**
 * Volume Master — page-world audio hook
 *
 * Runs in the PAGE's JavaScript world (not the isolated content-script world)
 * at document_start.
 *
 * Why this exists: browser games (HTML5 / WebGL / Unity / Godot / Ruffle-Flash)
 * and some web apps never create <audio> or <video> elements. They build their
 * own AudioContext and connect sound straight to ctx.destination, so the
 * media-element hook in content.js has nothing to attach to.
 *
 * What we do: wrap the AudioContext constructor and shadow each instance's
 * `destination` with our own GainNode, which we wire to the real destination.
 * Anything the page connects to ctx.destination now flows through our gain
 * (and, when Smart Boost is on, a compressor) first.
 *
 * Default gain is 1.0, so this is transparent until the user changes volume.
 */
(function () {
  'use strict';

  if (window.__vmPageAudio) return;
  window.__vmPageAudio = true;

  const NativeAC = window.AudioContext || window.webkitAudioContext;
  if (!NativeAC) return;

  const state = { volume: 1.0, muted: false, smartBoost: false };
  const rigs  = new Set();   // { ctx, gain, comp, dest }

  // ── Wire one context ───────────────────────────────────────────────────────

  function attach(ctx) {
    let dest;
    try {
      dest = ctx.destination;            // capture the REAL destination first
    } catch { return; }
    if (!dest) return;

    let gain;
    try {
      gain = ctx.createGain();
      gain.gain.value = state.muted ? 0 : state.volume;
      gain.connect(dest);
    } catch { return; }

    // Shadow `destination` on this instance so page code connects to our gain.
    try {
      Object.defineProperty(ctx, 'destination', {
        value: gain,
        writable: false,
        configurable: true,
      });
    } catch {
      try { gain.disconnect(); } catch {}
      return;
    }

    const rig = { ctx, gain, comp: null, dest };
    rigs.add(rig);
    if (state.smartBoost) rewire(rig);
  }

  /**
   * Normal:      gain → destination
   * Smart Boost: gain → compressor → destination
   */
  function rewire(rig) {
    if (!rig.ctx || rig.ctx.state === 'closed') return;
    try {
      try { rig.gain.disconnect(); } catch {}
      if (rig.comp) {
        try { rig.comp.disconnect(); } catch {}
        rig.comp = null;
      }

      if (state.smartBoost) {
        const c = rig.ctx.createDynamicsCompressor();
        c.threshold.value = -6;     // dB — engage only near peaks
        c.knee.value      = 3;
        c.ratio.value     = 20;     // ~hard limiter
        c.attack.value    = 0.003;
        c.release.value   = 0.25;
        rig.comp = c;
        rig.gain.connect(c);
        c.connect(rig.dest);
      } else {
        rig.gain.connect(rig.dest);
      }
    } catch {
      // Context died underneath us — drop it.
      rigs.delete(rig);
    }
  }

  function applyState() {
    for (const rig of Array.from(rigs)) {
      if (!rig.ctx || rig.ctx.state === 'closed') { rigs.delete(rig); continue; }
      try {
        rig.gain.gain.value = state.muted ? 0 : state.volume;
      } catch {
        rigs.delete(rig);
      }
    }
  }

  // ── Patch the constructor (Proxy keeps prototype + instanceof intact) ──────

  const Patched = new Proxy(NativeAC, {
    construct(target, args, newTarget) {
      const ctx = Reflect.construct(target, args, newTarget);
      try { attach(ctx); } catch {}
      return ctx;
    },
  });

  try {
    if (window.AudioContext)       window.AudioContext       = Patched;
    if (window.webkitAudioContext) window.webkitAudioContext = Patched;
  } catch {}

  // ── Listen for volume updates from the content script ─────────────────────

  window.addEventListener('message', e => {
    if (e.source !== window) return;
    const msg = e.data && e.data.__vmPage;
    if (!msg) return;

    const boostChanged = state.smartBoost !== !!msg.smartBoost;
    state.volume     = typeof msg.volume === 'number' ? msg.volume : state.volume;
    state.muted      = !!msg.muted;
    state.smartBoost = !!msg.smartBoost;

    if (boostChanged) for (const rig of Array.from(rigs)) rewire(rig);
    applyState();
  });
})();
