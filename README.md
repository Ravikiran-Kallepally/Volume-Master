# Volume Master Remastered

> Up to 1000% volume boost for Chrome — Smart Boost compressor, per-site memory, keyboard shortcuts, and social sharing.

[Chrome Web Store](https://chromewebstore.google.com/detail/fhlnjpnemdhhoejgdelndonecnbeolok) · [Privacy Policy](https://ravikiran-kallepally.github.io/Volume-Master/privacy.html)

---

## Version History

---

### v3.2.0 — Saved Volume Persists Across Episodes (SPA Navigation)

> Fixes streaming sites resetting the boost when you change episode

- On single-page-app sites (Max/HBO, Netflix, etc.) switching episodes changes the URL via the History API without a full page reload. The restore listener only fired on full loads (`status: 'complete'`), so the boost was dropped on the next episode and the user had to re-save every time
- **Background:** now also re-applies on in-app URL changes, re-asserting the live session boost (falls back to per-site memory). SPA navigation can't change origin, so carrying the level is safe
- **Content script:** added an in-page navigation self-heal that watches the URL and rebuilds the audio graph / reconnects the new `<video>` element when it changes
- Reported by a user watching shows on HBO

---

### v3.1.0 — Browser Games & Web Audio Support

> Boost audio that never touches an `<audio>` or `<video>` tag

- **Games now work.** HTML5 / WebGL / Unity / Godot titles (and Flash games running through Ruffle) generate sound via their own `AudioContext` and connect straight to `ctx.destination`, so the media-element hook had nothing to attach to and the boost did nothing
- Added `page-audio.js`, a `document_start` script running in the **page's own JS world**, which wraps the `AudioContext` constructor and shadows each instance's `destination` with our GainNode (plus the Smart Boost compressor when enabled)
- Runs in all frames, so games inside cross-origin iframes are covered too
- Fully transparent when idle: gain defaults to 1.0, and the existing `<audio>`/`<video>` path is untouched, so YouTube and everything that already worked behaves exactly as before

---

### v3.0.0 — Smarter Review Reach

> Get more reviews from happy users, still no nagging

- **Smarter prompt trigger:** the rate card now shows after 3 opens **OR** 2+ days installed with at least one use — so set-and-forget users (whose volume auto-restores via per-site memory and rarely reopen the popup) actually get a chance to be asked
- **Passive footer link:** a small, always-available "★ Rate Volume Master" link at the bottom of the popup — motivated users can rate any time, and it never interrupts anyone
- Keeps every guard-rail: once, snooze on "Maybe later", never nags after a final action, sentiment-gated (happy → store, unhappy → private feedback)

---

### v2.9.0 — Sentiment-Gated Rate Prompt

> More reviews, and a protected rating

- The Rate Us card now asks "Enjoying Volume Master?" first
- Happy users (😊 Love it) are routed to the Chrome Web Store review page
- Unhappy users (😕 Not really) are routed to private feedback (email) instead of the store — so frustration becomes a message, not a 1-star review
- Same polite triggers as before: engaged users only (5+ opens), once, snooze on "Maybe later", never nags after a final action

---

### v2.8.0 — 24 Languages Total

> Major-market localization batch

- Added `_locales/` for Arabic, Italian, Japanese, Korean, Chinese (Simplified + Traditional), Polish, Dutch, Thai, Ukrainian, Swedish, Malay, Filipino, and Czech
- Store listing now localized in **24 languages**, covering essentially all global Chrome traffic
- Canonical bolded descriptions saved in `store/listing-<lang>.txt`

---

### v2.7.0 — More Languages

> Five more localized markets

- Added `_locales/` for French, German, Turkish, Vietnamese, and Russian
- Store listing now localized in 10 languages total (en, es, pt-BR, hi, id, fr, de, tr, vi, ru)
- Canonical bolded descriptions saved in `store/listing-<lang>.txt`

---

### v2.6.0 — Rate Us Nudge

> A polite, non-intrusive way to ask happy users for a review

- Added a small "Enjoying Volume Master?" card at the bottom of the popup
- Shows **only after the popup has been opened 5+ times** (engaged users only)
- "Rate it" opens the Chrome Web Store reviews page; "Maybe later" snoozes for 7 more opens; the × dismisses for good
- Never shown again once rated or dismissed — no nagging

---

### v2.5.0 — Localized Store Listing

> Rank in more language markets

- Added `default_locale` and `_locales/` message files for Spanish, Portuguese (BR), Indonesian, and Hindi
- Store summary (short description) now localizes per language, unlocking the Chrome Web Store listing language dropdown

---

### v2.4.0 — Unified EQ-Bars Branding

> Consistent visual identity across toolbar, popup, and store

**New unified icon**

- Replaced the toolbar icon with a clean EQ-bars mark on a seam-free diagonal gradient (deep indigo → vibrant violet) with a subtle top sheen
- Regenerated all sizes (16 / 32 / 48 / 128 px)
- Swapped the popup header logo from the old speaker symbol to the matching EQ-bars mark — the brand mark is now identical in the toolbar, popup, and Chrome Web Store listing

**Store presence**

- Added a purpose-built branded hero tile (1280×800) leading with the icon + "1000%" claim, replacing the raw app screenshot as the first store image

---

### v2.3.0 — Icon, Unsave, Tab Fix & Shortcut Sync

> Community feedback from Reddit — quality-of-life improvements

**New icon**

- Redesigned from scratch with an Apple-quality aesthetic
- Squircle shape (24% corner radius — iOS standard) replacing the old circle
- Deep purple → vibrant violet diagonal gradient with subtle white gloss at the top
- White speaker + cone with soft depth shadow; inner arc full white, outer arc 70% opacity for layering
- Looks great on both dark and light Chrome toolbars

**Unsave button**

- "Save for site" now swaps to a red **Unsave** button when a setting is active
- One click removes the saved preference — no more needing to reset to 100% and re-save

**Audio tab click fix**

- Clicking a tab in the Audio Tabs list was doing nothing when the tab was in a different Chrome window
- Now calls `chrome.windows.update({ focused: true })` so the correct window comes to front

**Shortcut sync**

- Popup now polls every 500 ms while open
- Volume display updates live when using `Alt+Shift+↑↓M` without closing and reopening

**Rename**

- Extension renamed to **Volume Master Remastered** in manifest and popup header

---

### v2.2.0 — Iframe Support & Social Sharing

> Addresses user feedback from Reddit and early adopters

**Anime & embedded video fix**

- Content script now injects into **every iframe on every page**, not just the main frame
- Volume changes relay from the main frame down to all child iframes via `postMessage`, propagating recursively for nested players
- Fixes sites like Crunchyroll, 9anime, and any site that loads its video player from a different domain (cross-origin iframe)

**Social share panel**

- Share button now opens a panel matching the Chrome Web Store share design
- Platforms: **LinkedIn · Facebook · Reddit · X/Twitter · WhatsApp**
- URL bar at the bottom with a one-click **Copy** button
- Close via ✕ or clicking the backdrop

---

### v2.1.0 — Smart Boost Fixes & Share Button

> First store update — fixes discovered after launch

**Smart Boost auto-mode rework**

- Auto Smart Boost now also triggers when clicking **presets** (not just the slider)
- Sliding back **below 400%** now correctly auto-disables Smart Boost (was staying on)
- Manual toggle **locks** Smart Boost to the user's choice until Reset
- Subtitle updates dynamically between auto and manual mode
- Reset button now also clears the manual lock and restores auto-mode

**Critical audio pipeline fix**

- Root cause: `applyToTab` was sending 3 separate messages per slider tick (SET_VOLUME + SET_MUTED + SET_SMART_BOOST), causing `gain.disconnect()` + `gain.connect()` to run dozens of times per second while dragging — breaking Chrome's audio pipeline entirely
- Fix: consolidated to a single `SET_AUDIO_STATE` message; audio graph only rebuilds when Smart Boost actually toggles

**Share button**

- Added Share button to popup header
- Copies the Chrome Web Store link to clipboard with a "Copied!" confirmation

---

### v2.0.0 — Initial Release

> Built from scratch with Manifest V3

**Core features**

- Up to **1000% volume boost** via Web Audio API GainNode
- Slider range: 0% – 1000% with color-coded zones (violet → green → amber → red)
- Quick presets: 50% · 100% · 200% · 400% · 1000%
- Fine-grained per-tab volume control, independent across all tabs

**Smart Boost**

- Toggle adds a `DynamicsCompressorNode` to the audio chain (20:1 ratio, −6 dB threshold, 3 ms attack)
- Acts as a transparent hard limiter — catches peaks before they clip, keeping audio clean at high boost levels
- Auto-enables when volume crosses 400% going up
- Threshold marker (⚡) on slider shows exactly where it activates

**Per-site memory**

- Saves your volume preference per hostname using `chrome.storage.local`
- Automatically restores on every visit — no popup needed
- Saves Smart Boost state alongside volume
- Unsave button removes the saved preference in one click

**Keyboard shortcuts**

- `Alt + Shift + ↑` — Increase volume by 10%
- `Alt + Shift + ↓` — Decrease volume by 10%
- `Alt + Shift + M` — Toggle mute
- Fully remappable via `chrome://extensions/shortcuts`

**Popup UI**

- Dark theme with gradient accent
- Large volume number display
- Mute toggle (preserves volume setting)
- Audio tabs list — shows all tabs playing audio with volume badges; click to switch tabs or windows
- Save / Unsave buttons for per-site preferences
- Social share panel (LinkedIn, Facebook, Reddit, X, WhatsApp)
- Toast notifications for auto-actions

**Architecture**

- Manifest V3 (service worker background)
- `content.js` injected via manifest into all frames (`all_frames: true`) + programmatically on demand
- `GainNode → DynamicsCompressor → Destination` audio chain
- `postMessage` relay for cross-origin iframe volume sync
- `MutationObserver` + `play` event listener for dynamically added media elements

---

## File Structure

```
Volume Master Remastered/
├── manifest.json       MV3 manifest — permissions, commands, content scripts
├── background.js       Service worker — tab state, site memory, keyboard shortcuts
├── content.js          Audio engine — GainNode chain, iframe relay
├── popup.html          Popup shell
├── popup.css           Dark theme, slider, Smart Boost toggle, share panel
├── popup.js            UI logic — auto Smart Boost, presets, share panel, polling
├── icons/              16 · 32 · 48 · 128 px PNGs
├── privacy.html        Privacy policy (hosted on GitHub Pages)
└── USER_MANUAL.txt     Full user guide
```

---

## Permissions

| Permission   | Why                                                            |
| ------------ | -------------------------------------------------------------- |
| `<all_urls>` | Inject audio engine into any page the user wants to control    |
| `tabs`       | List audio tabs, switch between them                           |
| `storage`    | Save per-site volume preferences                               |
| `scripting`  | Programmatically inject content script                         |
| `activeTab`  | Access current tab info for the popup                          |
| `windows`    | Focus the correct Chrome window when switching to an audio tab |

No data is collected, transmitted, or stored outside the user's own browser.
