<p align="center">
  <img src="https://github.com/user-attachments/assets/2ace873a-2aef-4959-af2a-beec4b6d2ff5" width="500">
</p>


# VR CyberDeck

**With <3, by DMP**

> OPERATE. DEPLOY. CONTROL.

VR CyberDeck is a cross-platform desktop app built with Electron, React, and TypeScript for managing and sideloading content onto Meta Quest devices. Connect to a community game library, download and install automatically, and contribute games back.

---

## Download

| File | Platform |
|------|----------|
| `vr-cyberdeck-x.x.x-x64.dmg` | macOS (Intel / Rosetta 2) |
| `vr-cyberdeck-x.x.x-setup-x64.exe` | Windows — Installer |
| `vr-cyberdeck-x.x.x-portable-x64.exe` | Windows — Portable |
| `vr-cyberdeck-x.x.x-x86_64.AppImage` | Linux x64 |
| `vr-cyberdeck-x.x.x-arm64.AppImage` | Linux ARM64 |
| `vr-cyberdeck-x.x.x-amd64.deb` | Debian/Ubuntu x64 |
| `vr-cyberdeck-x.x.x-arm64.deb` | Debian/Ubuntu ARM64 |

Always use the latest release.

**macOS — Apple Silicon (M1–M5):** Install Rosetta 2 first, then run the x64 build.
```
softwareupdate --install-rosetta
```

**macOS — "App is damaged" error:**
```
xattr -c /Applications/VR\ CyberDeck.app
```

**Linux AppImage:**
```
chmod +x vr-cyberdeck-x.x.x-x86_64.AppImage
./vr-cyberdeck-x.x.x-x86_64.AppImage
```

---

## Build from Source

```
npm install --legacy-peer-deps
```

| Platform | Command |
|----------|---------|
| Windows | `npx electron-vite build && npx electron-builder --win --x64` |
| macOS | `npx electron-vite build && npx electron-builder --mac --x64` |
| Linux | `npx electron-vite build && npx electron-builder --linux --x64` |

---

## Setup

### Step 1 — Get Server Credentials

VR CyberDeck requires a `baseUri` and `password` (base64 encoded) to connect to the game library.

Find them here:
- Telegram: https://t.me/the_vrSrc
- Web preview: https://t.me/s/the_vrSrc
- Public JSON: https://qpmegathread.top/pages/public-json.html

Keep credentials private.

### Step 2 — Enter Credentials

**Option A — In-App (recommended):**
1. Open Settings
2. Click **Set Public Server JSON**
3. Paste your JSON or enter values manually
4. Click **Save**

**Option B — ServerInfo.json file:**

| Platform | Path |
|----------|------|
| Windows | `%APPDATA%\vr-cyberdeck\ServerInfo.json` |
| macOS | `~/Library/Application Support/vr-cyberdeck/ServerInfo.json` |
| Linux | `~/.config/vr-cyberdeck/ServerInfo.json` |

```json
{"baseUri":"https://your-url-here/","password":"your-password-here"}
```

Restart required when using this method.

### Step 3 — Connect Your Quest

1. Plug in via USB
2. Allow USB Debugging on the headset
3. Device appears in the app
4. Browse the library and download

Up to 5 downloads run in parallel.

---

## Uploading Games

### From a Connected Quest

The app detects games on your device that are missing from or newer than the library and prompts you to upload them. The pipeline:

1. Creates a staging folder
2. Pulls the APK via ADB
3. Checks for OBB files and pulls them
4. Generates metadata
5. Compresses into a ZIP
6. Uploads via rclone
7. Adds the entry to your blacklist

### From Local Files

Use **Transfers → Upload Local Files** to send game folders or ZIP archives directly from your PC without a connected headset.

- Each folder must contain exactly one APK — OBB folders and instruction files are included automatically
- Pre-made ZIPs are sent as-is
- Multiple items can be queued and upload one at a time with live progress

> Requires at least one successful VRP connection so that `upload.config` is written locally.

Uploads do not guarantee library inclusion.

---

## Logs

| Platform | Path |
|----------|------|
| Windows | `%APPDATA%\vr-cyberdeck\logs\main.log` |
| macOS | `~/Library/Logs/vr-cyberdeck/main.log` |
| Linux | `~/.config/vr-cyberdeck/logs/main.log` |

Logs can also be uploaded and shared directly from **Settings → Log Upload**.

---

## Troubleshooting

**Server connection issues**
- Verify `baseUri` ends with `/`
- Check password encoding
- Try a different DNS (Cloudflare `1.1.1.1` or Google `8.8.8.8`)
- Use a VPN if your region blocks the server

**Quest not detected**
- Use a data-capable USB cable (not charge-only)
- Accept USB Debugging on the headset when prompted
- Check antivirus isn't blocking ADB
- Try a different USB port

**ARM64 Linux — adb not found**
```
sudo apt install adb           # Debian/Ubuntu
sudo pacman -S android-tools   # Arch
```

---

## Credits

VR CyberDeck is built on top of [ApprenticeVR](https://github.com/jimzrt/apprenticeVr) by **jimzrt**. The core architecture — ADB management, download/upload pipeline, rclone integration, and the VRP game library connection — comes from their work. Without it this project wouldn't exist.

---

## License

GNU Affero GPL v3

---
![Visitors](https://komarev.com/ghpvc/?username=KaladinDMP&label=Visitors&color=blue)
![Last Commit](https://img.shields.io/github/last-commit/KaladinDMP/VR-CyberDeck?label=Last%20Updated)
![Created](https://img.shields.io/github/created-at/KaladinDMP/VR-CyberDeck?label=Created)
![Monthly Commits](https://img.shields.io/github/commit-activity/m/KaladinDMP/VR-CyberDeck?label=Monthly%20Commits)
![Stars](https://img.shields.io/github/stars/KaladinDMP)

Contributors on this Repo

[![Contributors](https://contrib.rocks/image?repo=KaladinDMP/VR-CyberDeck)](https://github.com/KaladinDMP/VR-CyberDeck/graphs/contributors)
