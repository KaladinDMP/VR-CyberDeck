# VR CyberDeck — Reddit launch post

## TITLE OPTIONS

Pick whichever fits the sub's vibe:

1. **VR CyberDeck — a cyberpunk sideloader for Quest, built on top of ApprenticeVR**
2. **I rebuilt the ApprenticeVR experience into a neon hacker terminal — meet VR CyberDeck v1.0**
3. **VR CyberDeck v1.0 — sideload, install and upload to your Quest from a desktop deck (no setup, no JSON)**
4. **[Release] VR CyberDeck v1.0 — Quest sideloader with live transfer HUD, ADB shortcut macros, and zero-config onboarding**
5. **Fork of ApprenticeVR with a full UI/UX rewrite — VR CyberDeck v1.0 is out**

---

## BODY

Hey y'all,

I've been quietly cooking on this for a while and after a stack of `0.x` prereleases with friends I'm finally cutting the public **v1.0.0**. Meet **VR CyberDeck** — a cross-platform desktop deck for managing, sideloading, and uploading content to your Quest, wrapped in a neon-terminal aesthetic that doesn't look like it was designed in 2014.

**Quick disclosure first:** this is a fork of [**ApprenticeVR**](https://github.com/jimzrt/apprenticeVr) by **jimzrt**. The core engine (ADB control, the download/upload/rclone pipeline) is theirs and y'all should give them a star — without that foundation this project literally doesn't exist. I've heavily rewritten the *experience* on top.

> *(Video below — ~XX seconds, no audio commentary, just the UI doing its thing)*
>
> **[VIDEO HERE]**

---

### `// TL;DR`

It's a sideloader. It's themed. It works on first launch. It has buttons that go boop.

---

### `// WHAT'S DIFFERENT FROM APPRENTICEVR / OTHER FORKS`

| | ApprenticeVR / typical fork | VR CyberDeck |
|---|---|---|
| **Onboarding** | Configure server before use | Bundled defaults — works first launch |
| **Library view** | Table only | Card *and* table view, table stretches edge-to-edge |
| **Downloads** | Sequential | Up to 5 parallel, NEW / UPDATED badges |
| **Uploads** | Headset-only | Headset *or* local PC files (folders + ZIPs) |
| **Live HUD** | None | Header strip rotates through active transfers w/ name, %, speed, ETA |
| **ADB Shell** | None | Full terminal with quick-command shortcut pills + user-defined macros |
| **Trailers** | Loads full youtube.com page | Locked-down nocookie embed — no ads, no suggestions, no subscribe button |
| **Quit safety** | None | Won't let you close mid-transfer without warning |
| **Theming** | Stock Fluent UI | Cyberpunk top to bottom, accent color picker, font picker, full colorblind mode |
| **Sound** | None | Optional drop-in `click.wav` / `type.wav` / `matrix.wav` for that hacker-keyboard feel |
| **Updates** | Manual | In-app auto-updater on every platform |

---

### `// FEATURE HIGHLIGHTS`

- **Live transfer ticker in the header** — `// TRANSFER_BUS  ↓ Beat Saber  DOWNLOADING  78%  12.3 MB/s  ETA 1m`. Rotates through active items, shows speed + ETA + stage labels (`Installing APK...`, `Copying OBB...`).
- **ADB Shell with shortcut pills** for the stuff you actually do: pin CPU/GPU level, swap refresh rate (72/90/120Hz), block/unblock the OS updater, reboot variants, `tcpip 5555`, etc. Plus custom macro pills you can save for any command you spam (right-click to edit/delete).
- **Smart on-disk detection** — already have the same release downloaded from another tool? CyberDeck notices, asks if you want to install from the existing files or wipe + redownload. Toggle in Settings if you want it to pick automatically.
- **Local PC upload** — point at a folder or pre-made ZIP, no headset required. Full pipeline: stage → APK → OBBs → metadata → 7z → rclone.
- **A11y that's actually finished** — colorblind mode swaps the *whole* UI palette (not just the obvious bits), font scale up to 200%, font picker if Courier New is rough on your eyes, 900x640 minimum window for laptops.

---

### `// DOWNLOAD`

- **Releases:** [github.com/KaladinDMP/VR-CyberDeck/releases/latest](https://github.com/KaladinDMP/VR-CyberDeck/releases/latest)
- Builds for Windows (installer + portable), macOS (x64 + arm64), Linux (AppImage + .deb, x64 + arm64)
- macOS "App is damaged"? `xattr -c /Applications/VR\ CyberDeck.app`
- Already on a 0.x build? It'll auto-update.

---

### `// FEEDBACK / BUGS`

- 🐛 **Issues:** [github.com/KaladinDMP/VR-CyberDeck/issues](https://github.com/KaladinDMP/VR-CyberDeck/issues) — please attach a log via *Settings → Log Upload*, makes my life 10x easier
- 💬 **Discussions:** [github.com/KaladinDMP/VR-CyberDeck/discussions](https://github.com/KaladinDMP/VR-CyberDeck/discussions) — feature ideas, custom ADB macro recipes worth sharing, sound clip suggestions, "is this normal?", etc.

If you find a sound clip that would suit the click/type/matrix slots, drop it in a discussion thread — happy to bundle community favourites in a later build.

---

### `// FAQ I CAN ALREADY SEE COMING`

**"Why fork ApprenticeVR instead of contributing upstream?"**
Honest answer — it started as a "quick reskin for fun" and snowballed. The amount of UI/UX surgery wouldn't have made sense as a PR. jimzrt's project stays the source of truth for the engine; CyberDeck is the playground.

**"Will my old downloads still work?"**
Yes. Point Settings → Download Path at your existing folder and hit Scan — anything already on disk gets imported as Completed and you can install straight from there.

**"What's with the sound effects?"**
They're off by default unless you drop your own files. No bundled audio. If you have an old mechanical keyboard click sample lying around, you know what to do.

**"Source?"**
[github.com/KaladinDMP/VR-CyberDeck](https://github.com/KaladinDMP/VR-CyberDeck) — AGPL v3, same license as upstream.

---

`> v1.0.0 — JACK IN, SIDELOAD, REPEAT`

⭐ if you like it, issue if you don't, see y'all in the comments.

— DMP
