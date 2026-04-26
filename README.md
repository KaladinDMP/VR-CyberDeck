

<p align="center">
  <img src="https://github.com/user-attachments/assets/2ace873a-2aef-4959-af2a-beec4b6d2ff5" width="500">
</p>

# VR CyberDeck

**Made with <3 by DMP**

> `> ACCESS GRANTED. JACK IN. SIDELOAD. UPLOAD. REPEAT.`

```
[ STATUS ] ONLINE
[ TARGET ] META QUEST // ALL MODELS
[ STACK  ] ELECTRON · REACT · TYPESCRIPT
```

VR CyberDeck is a cross-platform desktop deck for managing, sideloading, and uploading content to Meta Quest devices. It plugs into a community-run game library, runs the whole download → install → metadata → upload pipeline for you, and wraps the whole thing in a neon terminal aesthetic that doesn't feel like a 2014 sideloader.

---

## `// FORK_NOTE`

VR CyberDeck started as a fork of [**ApprenticeVR**](https://github.com/jimzrt/apprenticeVr) by **jimzrt**. The core engine — ADB control, the download/upload pipeline, rclone integration, library connection — is theirs. Everything below the surface is a heavy rewrite of the *experience*:

| | ApprenticeVR | VR CyberDeck |
|---|---|---|
| **Theme** | Stock Fluent UI | Fully optional cyberpunk / neon-terminal rebrand |
| **Onboarding** | Hardcoded (original) /Configure server before use (forks) | Bundled server defaults — works on first launch |
| **Intro** | None | `UNAUTHORIZED → AUTHORIZED` glitch boot |
| **Identity** | None | Matrix-style random `g33ky_u$3rn4m3$` per session |
| **Console** | None | In-header Hacker Console + ADB Shell with quick-command shortcuts |
| **Live HUD** | None | Header `// TRANSFER_BUS` strip with rotating progress, speed, ETA |
| **Library view** | Table only | Table **and** card view, sort presets, table stretches edge-to-edge |
| **Downloads** | Sequential | Up to **5 concurrent**, with NEW / UPDATED badges |
| **Uploads** | Headset-only | Headset **or** local PC files (folders + ZIPs) |
| **Quit safety** | None | Confirmation prompt when transfers are in flight |
| **Settings** | Flat panel | Collapsible sections, accent color, tab memory |
| **A11y** | Limited | Full colorblind theming, font scale to 200%, 900x640 min size |
| **Updates** | Manual | In-app auto-updater on every platform |

---

## `// FEATURES`

**`[ LIBRARY ]`**
- Bundled server defaults — no JSON, no rclone, no setup required
- Card view + table view, persistent sort, size presets, 18+ filter
- Table view stretches to fill the window so wide screens aren't wasted
- Built-in mirror management with public mirror fallback
- `NEW` / `UPDATED` badges driven off real `lastUpdated` timestamps 

// NOTE: New is "added in the last 30 days". So, since the server is new, everything looks new for now. This will eventually be a useful feature, but a bit confusing right now. Updated badge means it was updated in the last 7 days, Updated badges do NOT turn into New badges for the last 3 weeks. New means new to the server, as in a new game, updated means a not new game thats been updated... But i guess there could be NEW and UPDATED at the same time. Not sure if it would badge it right or only one would show. Hmm, I should probably figure that out huh?

**`[ TRANSFERS ]`**
- Up to 5 parallel downloads with live progress
- Live `// TRANSFER_BUS` strip in the header — rotates through active downloads/uploads with name, stage, %, speed, and ETA
- Unified Transfers drawer (downloads + uploads in one place) with stage-aware labels (`Installing APK...`, `Copying OBB...`)
- Scan existing downloads folder and reconcile against the library
- Clear-completed, retry, and per-item delete actions
- Close the window mid-transfer? Cyberdeck warns you with `[ TRANSFERS IN PROGRESS ]` before letting you bail (works for both X and Cmd+Q on macOS)

**`[ UPLOADS ]`**
- Auto-detect games on your headset that are missing or newer than the library
- Local PC upload — point at a folder or pre-made ZIP, no headset required
- Full pipeline: stage → ADB pull APK → grab OBBs → metadata → 7z → rclone
- Optional `CRACKED` tagging on uploads

**`[ DEVICE / ADB ]`**
- Auto-connect Quest on launch
- ADB Shell dialog with built-in **quick-command shortcuts**:
  - `PERFORMANCE` — pin CPU/GPU level, swap refresh rate (72/90/120Hz), reset texture
  - `UPDATES` — block / unblock the OS updater and Meta Store
  - `SYSTEM` — reboot variants, battery, storage, wifi, IP, proximity toggle
  - `PACKAGES` — list 3rd-party / all / current focused app
  - `WIRELESS` — `tcpip 5555`, `adb devices`
- **Custom user macros** — define your own labelled shortcut for any command you spam (right-click to edit/delete, persisted across sessions)
- Disable-sideloading toggle for safety
- WiFi bookmarks for wireless ADB

**`[ INTERFACE ]`**
- Glitch boot intro, neon Hacker Console, themed dialogs top to bottom
- Compact laptop-friendly header — drops down to a 900x640 min window
- Dark mode done right (no half-themed popups)
- Accent color picker, tab memory
- Colorblind mode now covers the whole UI — version subtitles, filter counters, Transfers button, battery pill, breach animation all swap palette
- Font scale up to 200%
- One-click log upload from Settings → Log Upload

---

## `// DOWNLOAD`

| File | Platform |
|------|----------|
| `vr-cyberdeck-x.x.x-x64.dmg` | macOS x64 |
| `vr-cyberdeck-x.x.x-arm64.dmg` | macOS arm64 |
| `vr-cyberdeck-x.x.x-setup-x64.exe` | Windows — Installer |
| `vr-cyberdeck-x.x.x-portable-x64.exe` | Windows — Portable |
| `vr-cyberdeck-x.x.x-x86_64.AppImage` | Linux x64 |
| `vr-cyberdeck-x.x.x-arm64.AppImage` | Linux ARM64 |
| `vr-cyberdeck-x.x.x-amd64.deb` | Debian/Ubuntu x64 |
| `vr-cyberdeck-x.x.x-arm64.deb` | Debian/Ubuntu ARM64 |

Always grab the latest release. If it's already installed, just update in-app.

**macOS — "App is damaged":**
```
xattr -c /Applications/VR\ CyberDeck.app
```

**Linux AppImage:**
```
chmod +x vr-cyberdeck-x.x.x-x86_64.AppImage
./vr-cyberdeck-x.x.x-x86_64.AppImage
```

---

## `// JACK_IN`

1. Install the build for your OS
2. Plug in your Quest via USB (data-capable cable)
3. Allow USB Debugging on the headset
4. Browse the library and hit download

That's it. The bundled server config means there's nothing to configure on first run.

> Want to point at a custom server, swap in your own rclone config, or upload from PC? See **Settings** — every advanced flow lives there.

> Power user? Open the **ADB Shell** from the sidebar — the shortcut panel above the terminal covers most Quest tweaks in one click, and you can save your own commands as `MY MACROS` pills.

---

## `// BUILD_FROM_SOURCE`

```
npm install --legacy-peer-deps
```

| Platform | Command |
|----------|---------|
| Windows | `npx electron-vite build && npx electron-builder --win --x64` |
| macOS | `npx electron-vite build && npx electron-builder --mac --x64` |
| Linux | `npx electron-vite build && npx electron-builder --linux --x64` |

---

## `// CREDITS`

Built on top of [ApprenticeVR](https://github.com/jimzrt/apprenticeVr) by **jimzrt**. Without that foundation this project doesn't exist.

## `// LICENSE`

GNU Affero GPL v3

---

![Visitors](https://api.visitorbadge.io/api/visitors?path=kaladindmp%2Fvr-cyberdeck&label=People%20Who%20Forgot%20To%20Star%20This%20Repo&countColor=%23ba68c8&style=plastic)
![Last Commit](https://img.shields.io/github/last-commit/KaladinDMP/VR-CyberDeck?label=Last%20Updated)
![Created](https://img.shields.io/github/created-at/KaladinDMP/VR-CyberDeck?label=Created)
![Monthly Commits](https://img.shields.io/github/commit-activity/m/KaladinDMP/VR-CyberDeck?label=Monthly%20Commits)

## ⭐ Do the thing

You’re already here. You’ve already scrolled.

Just hit the ⭐ and we both win.

⭐ Star this repo please

---

[![GitHub stars for this repo](https://img.shields.io/github/stars/KaladinDMP/VR-CyberDeck?style=social)](https://github.com/KaladinDMP/VR-CyberDeck) = **GitHub stars for this repo**

[![GitHub stars in total (all repos)](https://img.shields.io/github/stars/KaladinDMP?style=social)](https://github.com/KaladinDMP) = **GitHub stars in total (all repos)**
