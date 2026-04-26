# VR CyberDeck v1.0.0 — INITIAL PUBLIC RELEASE

> `> ACCESS GRANTED. JACK IN. SIDELOAD. UPLOAD. REPEAT.`

After several prerelease cycles, **VR CyberDeck v1.0.0** is the first public launch. This is the build I'm putting in front of the megathread and announcing to the world.

VR CyberDeck is a cross-platform desktop deck for managing, sideloading, and uploading content to Meta Quest devices. It started as a fork of [**ApprenticeVR**](https://github.com/jimzrt/apprenticeVr) by **jimzrt** (huge thanks — the core engine is theirs) and grew into a full neon-terminal rebrand of the experience.

---

## `// WHY 1.0.0?`

Everything I shipped in `0.x` was technically a prerelease — bug-hunting builds for testers and friends. v1.0.0 is the release I'm comfortable handing to anyone with a Quest.

- Onboarding works on first launch (bundled server defaults, no JSON, no rclone setup).
- The whole download → install → metadata → upload pipeline is stable.
- The UI no longer has the half-themed popups and missing colorblind paths it had in early 0.x.
- Auto-updater is wired up on every platform, so 1.0.x and beyond just update in-app.

---

## `// HEADLINE FEATURES`

### `[ LIBRARY ]`
- Bundled server defaults — works first launch, zero config
- Card view **and** table view (table now stretches edge-to-edge in wide windows)
- Persistent sort, density presets, 18+ filter, mirror management with public fallback
- `NEW` / `UPDATED` badges driven off real `lastUpdated` timestamps

### `[ TRANSFERS ]`
- Up to **5 parallel downloads** with live progress
- Live `// TRANSFER_BUS` strip in the header — rotates through active transfers with name, stage, %, speed, and ETA
- Unified Transfers drawer with stage-aware labels (`Installing APK...`, `Copying OBB...`)
- Cyberdeck warns you with `[ TRANSFERS IN PROGRESS ]` if you try to close the window mid-transfer (works for both X and Cmd+Q)
- Scan existing downloads folder, retry, clear-completed, per-item delete

### `[ UPLOADS ]`
- Auto-detect games on your headset that are missing or newer than the library
- **Local PC upload** — point at a folder or a pre-made ZIP, no headset required
- Full pipeline: stage → ADB pull APK → grab OBBs → metadata → 7z → rclone
- Optional `CRACKED` tagging on uploads

### `[ DEVICE / ADB ]`
- Auto-connect Quest on launch, WiFi bookmarks for wireless ADB
- **ADB Shell** with built-in **quick-command shortcuts**:
  - `PERFORMANCE` — pin CPU/GPU level, swap refresh rate (72/90/120Hz), reset texture
  - `UPDATES` — block / unblock the OS updater and Meta Store
  - `SYSTEM` — reboot variants, battery, storage, wifi, IP, proximity toggle
  - `PACKAGES` — list 3rd-party / all / current focused app
  - `WIRELESS` — `tcpip 5555`, `adb devices`
- **Custom user macros** — define your own labelled pill for any command you spam (right-click to edit/delete, persisted across sessions)
- Disable-sideloading toggle for safety

### `[ INTERFACE ]`
- Glitch `UNAUTHORIZED → AUTHORIZED` boot intro
- Matrix-style random `g33ky_u$3rn4m3$` per session
- Neon Hacker Console in the header (live SYS_STATUS readout)
- **Font picker** — swap Courier New for Console / Terminal / System Mono if the default is hard to read
- **Colorblind mode** now covers the whole UI — version subtitles, filter counters, Transfers button, battery pill, breach animation all swap palette
- Accent color picker, font scale up to 200%, tab memory
- Compact, **laptop-friendly** layout (900x640 minimum window)
- One-click log upload from Settings → Log Upload

---

## `// DOWNLOAD`

Pick the build for your platform — same set of artifacts as the prereleases:

| File | Platform |
|------|----------|
| `vr-cyberdeck-1.0.0-x64.dmg` | macOS x64 |
| `vr-cyberdeck-1.0.0-arm64.dmg` | macOS arm64 |
| `vr-cyberdeck-1.0.0-setup-x64.exe` | Windows — Installer |
| `vr-cyberdeck-1.0.0-portable-x64.exe` | Windows — Portable |
| `vr-cyberdeck-1.0.0-x86_64.AppImage` | Linux x64 |
| `vr-cyberdeck-1.0.0-arm64.AppImage` | Linux ARM64 |
| `vr-cyberdeck-1.0.0-amd64.deb` | Debian/Ubuntu x64 |
| `vr-cyberdeck-1.0.0-arm64.deb` | Debian/Ubuntu ARM64 |

**macOS — "App is damaged":**
```
xattr -c /Applications/VR\ CyberDeck.app
```

**Linux AppImage:**
```
chmod +x vr-cyberdeck-1.0.0-x86_64.AppImage
./vr-cyberdeck-1.0.0-x86_64.AppImage
```

Already on a 0.x build? It will auto-update.

---

## `// JACK_IN`

1. Install the build for your OS
2. Plug your Quest in via USB (data-capable cable)
3. Allow USB Debugging on the headset
4. Browse the library and hit download

That's it. No server config, no rclone setup, no JSON to edit. Power-user knobs (custom servers, mirrors, rclone configs, PC uploads, ADB macros) all live in **Settings**.

---

## `// CREDITS`

Built on top of [ApprenticeVR](https://github.com/jimzrt/apprenticeVr) by **jimzrt**. Without that foundation this project doesn't exist.

Special thanks to **HFP** for teaching me so much way back, and to **Rod** — my crazy friend who believes in megalodons on Mars and gave me incredible feedback during the prerelease cycle.

And to everyone who tested the 0.x builds and reported issues — y'all shaped the 1.0.0 polish list.

## `// LICENSE`

GNU Affero GPL v3

---

`> v1.0.0 — END_OF_FILE`
