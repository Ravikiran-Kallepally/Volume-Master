# Volume Master

> Up to 1000% volume boost for Chrome — with Smart Boost, per-site memory, and keyboard shortcuts.

[Chrome Web Store](https://chromewebstore.google.com/detail/fhlnjpnemdhhoejgdelndonecnbeolok) · [Privacy Policy](https://ravikiran-kallepally.github.io/Volume-Master/privacy.html)

---

## Version History

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
- Subtitle updates dynamically: *"Auto-enables at 400% · Toggle anytime"* → *"Manually enabled · Reset to restore auto"*
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
- Reset at 100% to clear a saved preference

**Keyboard shortcuts**
- `Alt + Shift + ↑` — Increase volume by 10%
- `Alt + Shift + ↓` — Decrease volume by 10%
- `Alt + Shift + M` — Toggle mute
- Fully remappable via `chrome://extensions/shortcuts`

**Popup UI**
- Dark theme with gradient accent
- Large volume number display
- Mute toggle (preserves volume setting)
- Audio tabs list — shows all tabs playing audio with volume badges; click to switch
- "Save for site" button with bookmark indicator
- Toast notifications for auto-actions

**Architecture**
- Manifest V3 (service worker background)
- `content.js` injected programmatically + via manifest into all frames
- `GainNode → DynamicsCompressor → Destination` audio chain
- `MutationObserver` + `play` event listener for dynamically added media elements

---

## File Structure

```
Volume Master/
├── manifest.json       MV3 manifest — permissions, commands, content scripts
├── background.js       Service worker — tab state, site memory, keyboard shortcuts
├── content.js          Audio engine — GainNode chain, iframe relay
├── popup.html          Popup shell
├── popup.css           Dark theme, slider, Smart Boost toggle, share panel
├── popup.js            UI logic — auto Smart Boost, presets, share panel
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

No data is collected, transmitted, or stored outside the user's own browser.
