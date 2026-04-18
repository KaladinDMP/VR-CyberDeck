<p align="center">
  🌐 &nbsp;<strong>Language / Idioma:</strong>&nbsp;
  <a href="RELEASE_NOTES.md"><strong>🇺🇸 English</strong></a> &nbsp;|&nbsp;
  <a href="RELEASE_NOTES.es.md">🇪🇸 Español</a>
</p>

---

# Release Notes — ApprenticeVR: VRSrc Edition

---

## v2.1.0

### New Features

#### Local File Upload
- Added **"Upload Local Files"** button inside the Uploads drawer
- Supports selecting multiple **game folders** or **ZIP archives** directly from your PC — no Quest required
- **Folder rules:** each folder must contain exactly one APK file; OBB folders, instruction files, and other content in the same folder are automatically included in the ZIP
- **ZIP files** are sent as-is without re-compression
- Full **validation** runs before anything is queued — if any folder has multiple APKs, the entire batch is refused with a clear error message explaining the rule
- Items are added to the existing **upload queue** and processed one at a time with live progress

#### Spanish (Castellano) Language
- Added full **Spanish (Castellano)** UI translation
- Language is **auto-detected** from the operating system on first launch — if your system language is Spanish, the app starts in Spanish automatically
- A **language picker** (English / Español Castellano) is available in Settings and persists across restarts

---

## v2.0.0

### Key Improvements over upstream

- Fixed YouTube embeds using Electron webview
- 5 parallel downloads instead of 1
- Switched from `rclone mount` to `rclone copy` for more reliable transfers
- Added pause and resume support for downloads
- Prevented ADB install conflicts using a queue system
- Major UI and performance optimizations
- Fixed download progress and ETA display
- Improved handling of large game libraries (2,600+ titles)
- Fixed resume pipeline logic
- Fixed download path duplication bug
- Improved resume progress tracking
- Reduced build size from 478 MB to 110 MB
- Dynamic game list file detection
- Redesigned mirror management UI
- Simplified update notification system
- Removed 0 KB placeholder file issues
- Version number now visible in Settings
- Upload pipeline fixed and working
