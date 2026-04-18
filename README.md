<p align="center">
  <img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/446f9bc8-fe7a-4817-a063-09a6186addcf" />
</p>

<p align="center">
  🌐 &nbsp;<strong>Language / Idioma:</strong>&nbsp;
  <a href="README.md"><strong>🇺🇸 English</strong></a> &nbsp;|&nbsp;
  <a href="README.es.md">🇪🇸 Español</a>
</p>

---

# ApprenticeVR: VRSrc Edition

**ApprenticeVR: VRSrc Edition** is a modern, cross-platform desktop app built with Electron, React, and TypeScript for managing and sideloading content onto Meta Quest devices. It connects to a community game library, handles downloads and installs automatically, and lets you contribute games back to the library.

> **Fork note:** This fork includes bug fixes, performance improvements, and new features. See the section below for details.

---

## Step 1: Download the Right File for Your OS

| File | Platform | Notes |
|------|----------|------|
| `apprenticevr-x.x.x-arm64.dmg` | macOS Apple Silicon (M1 to M5) | Use for M-series Macs |
| `apprenticevr-x.x.x-x64.dmg` | macOS Intel (macOS 11+) | Standard Intel build |
| `apprenticevr-macOS10.15-x64.dmg` | macOS Intel (10.15 Catalina) | Fallback if others fail |
| `apprenticevr-x.x.x-setup-x64.exe` | Windows Installer | Recommended for most users |
| `apprenticevr-x.x.x-portable-x64.exe` | Windows Portable | No install required |
| `apprenticevr-x.x.x-x86_64.AppImage` | Linux x64 | Works on most distros |
| `apprenticevr-x.x.x-arm64.AppImage` | Linux ARM64 | For ARM-based systems |
| `apprenticevr-x.x.x-amd64.deb` | Debian/Ubuntu x64 | Install with dpkg |
| `apprenticevr-x.x.x-arm64.deb` | Debian/Ubuntu ARM64 | ARM version |

> Downloads are on the Releases page. Always use the latest version.

### macOS Fix: "App is damaged"

```
xattr -c /Applications/ApprenticeVR\ VRSrc\ Edition.app
```

### Linux AppImage

```
chmod +x apprenticevr-x.x.x-x86_64.AppImage
./apprenticevr-x.x.x-x86_64.AppImage
```

---

## Step 2: Get Your Server Credentials

ApprenticeVR requires:

- `baseUri` (URL ending in `/`)
- `password` (base64 encoded)

Where to find them:

- Telegram: https://t.me/the_vrSrc  
- Web preview: https://t.me/s/the_vrSrc  
- Public JSON: https://qpmegathread.top/pages/public-json.html  

Keep credentials private. Do not share them.

---

## Step 3: Enter Credentials

### Option A: In-App (Recommended)

1. Open Settings
2. Click **Set Public Server JSON**
3. Paste JSON or enter values manually
4. Click **Save**

### Option B: ServerInfo.json

| Platform | Path |
|----------|------|
| Windows | `%APPDATA%\apprenticevr\ServerInfo.json` |
| macOS | `~/Library/Application Support/apprenticevr/ServerInfo.json` |
| Linux | `~/.config/apprenticevr/ServerInfo.json` |

```
{"baseUri":"https://your-url-here/","password":"your-password-here"}
```

Restart required when using this method.

---

## Step 4: Connect Quest and Sideload

1. Plug in headset via USB
2. Allow USB Debugging
3. Device appears in app
4. Download games

Up to 5 downloads run in parallel.

---

## What's New in VRSrc Edition

See the full [Release Notes](RELEASE_NOTES.md) for a detailed changelog.

### Key Improvements

- **Local file upload** — upload game folders or ZIP files directly from your PC without a connected Quest
- **Spanish (Castellano) language** — auto-detected from your OS; switch anytime in Settings
- Fixed YouTube embeds using Electron webview
- 5 parallel downloads instead of 1
- Switched from `rclone mount` to `rclone copy`
- Added pause and resume support
- Prevented ADB install conflicts with queue system
- Major UI and performance optimizations
- Fixed download progress and ETA display
- Improved handling of large game libraries (2600+ titles)
- Fixed resume pipeline logic
- Fixed download path duplication bug
- Improved resume progress tracking
- Reduced build size from 478MB to 110MB
- Dynamic game list file detection
- Redesigned mirror management UI
- Simplified update notification system
- Removed 0KB placeholder file issues
- Version now visible in Settings
- Upload pipeline fixed and working

---

## Uploading Games

### From a Connected Quest (automatic)

The app detects games on your device that are missing from or newer than the library and prompts you to upload them.

1. Create staging folder
2. Pull APK via ADB
3. Check for OBB files
4. Pull OBB if present
5. Generate metadata
6. Compress into ZIP
7. Upload via rclone
8. Add to blacklist

### From Local Files (manual)

Use **Uploads → Upload Local Files** to send game folders or ZIP archives directly from your PC.

- Each folder must contain **exactly one APK** file — OBB folders, instruction files, and other content are included automatically
- If you already have a ZIP, it is sent as-is
- Multiple folders/ZIPs can be queued at once and upload one at a time with live progress

Uploads do not guarantee inclusion.

---

## Planned Feature

Scanning headset for:

- Newer versions than library
- Missing games

Uses ADB version comparison and game list indexing.

---

## Logs

| Platform | Location |
|----------|----------|
| Windows | `%USERPROFILE%\AppData\Roaming\apprenticevr\logs\main.log` |
| macOS | `~/Library/Logs/apprenticevr/main.log` |
| Linux | `~/.config/apprenticevr/logs/main.log` |

---

## Troubleshooting

### Connection Issues

- Check baseUri format
- Verify password
- Ensure correct line endings
- Try different DNS
- Use VPN if needed

### Quest Not Detected

- Use data cable
- Allow USB debugging
- Check antivirus interference
- Try different ports

### macOS Fix

```
xattr -c /Applications/ApprenticeVR\ VRSrc\ Edition.app
```

### Linux Fix

```
chmod +x apprenticevr-*.AppImage && ./apprenticevr-*.AppImage
```

---

## Inspiration

Based on Rookie Sideloader.

---

## License

GNU Affero GPL v3

---

![Visitors to this Repo](https://badges.pufler.dev/visits/KaladinDMP/apprenticeVrSrc)

![Last Updated](https://badges.pufler.dev/updated/KaladinDMP/apprenticeVrSrc)

![When was this Repo Created?](https://badges.pufler.dev/created/KaladinDMP/apprenticeVrSrc)

![Monthly Commits by KaladinDMP](https://badges.pufler.dev/commits/monthly/KaladinDMP)

Contributors on this Repo
![Contributors on this Repo:](https://badges.pufler.dev/contributors/KaladinDMP/apprenticeVrSrc?size=50&padding=5&perRow=10&bots=true)

![KaladinDMP's stars](https://img.shields.io/github/stars/KaladinDMP)
