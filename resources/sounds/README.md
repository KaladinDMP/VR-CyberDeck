# VR CyberDeck — Sound Effects

Drop short audio clips here to bring the UI to life. The app looks for these
filenames at runtime; missing files are silently skipped.

| Filename pattern | Plays when |
|---|---|
| `click.{wav,mp3,ogg}` | Any button / tab / menu item is clicked |
| `type.{wav,mp3,ogg}` | A character is typed during the boot intro |
| `matrix.{wav,mp3,ogg}` | The ADB Shell matrix-rain intro starts |

## Two locations, in priority order

1. **User data folder** — drop in `<userData>/sounds/`, no rebuild needed.
   - Linux: `~/.config/vr-cyberdeck/sounds/`
   - macOS: `~/Library/Application Support/vr-cyberdeck/sounds/`
   - Windows: `%APPDATA%\vr-cyberdeck\sounds\`
2. **Bundled with the app** — drop in `resources/sounds/` (this folder).
   Files here ship inside the installer; rebuild required.

The user data folder wins if both are present, so users can override the
bundled sounds without recompiling.

## Tips

- Keep the **click** clip very short (under ~80 ms). It fires on every click.
- Sound effects are gated by the **Settings → Sound Effects** toggle and have
  their own volume slider (separate from system volume).
- Supported formats: `wav`, `mp3`, `ogg` (HTML5 Audio decodes them all on
  Electron's bundled Chromium).
