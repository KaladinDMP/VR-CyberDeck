/**
 * electron-builder afterSign hook.
 *
 * Applies an ad-hoc code signature to the entire macOS .app bundle after
 * electron-builder finishes its own signing step (which is a no-op when no
 * Apple Developer certificate is present).
 *
 * Without this, the Electron Framework retains Electron's own Team ID while
 * the main binary and helper processes are unsigned, causing macOS to refuse
 * to launch the app with a "different Team IDs" DYLD error.
 *
 * Using `--force --deep --sign -` replaces all existing signatures with an
 * ad-hoc identity (Team ID = ""), making every component consistent.
 */

const { execSync } = require('child_process')
const path = require('path')

module.exports = async (context) => {
  if (context.electronPlatformName !== 'darwin') return
  if (process.platform !== 'darwin') return

  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(context.appOutDir, `${appName}.app`)

  console.log(`[afterSign] Ad-hoc signing: ${appPath}`)
  execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' })
  console.log('[afterSign] Done.')
}
