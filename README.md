# Volume Master Remastered

> Up to 1000% volume boost for Chrome — Smart Boost compressor, per-site memory, keyboard shortcuts, and social sharing.

[Chrome Web Store](https://chromewebstore.google.com/detail/fhlnjpnemdhhoejgdelndonecnbeolok) · [Privacy Policy](https://ravikiran-kallepally.github.io/Volume-Master/privacy.html)

---

## Version History

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

| Permission | Why |
|---|---|
| `<all_urls>` | Inject audio engine into any page the user wants to control |
| `tabs` | List audio tabs, switch between them |
| `storage` | Save per-site volume preferences |
| `scripting` | Programmatically inject content script |
| `activeTab` | Access current tab info for the popup |
| `windows` | Focus the correct Chrome window when switching to an audio tab |

No data is collected, transmitted, or stored outside the user's own browser.
