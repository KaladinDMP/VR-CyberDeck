import React, { useState } from 'react'
import { Button, Spinner, Text } from '@fluentui/react-components'
import { PlayRegular } from '@fluentui/react-icons'

const URL_RE = /(https?:\/\/[^\s)\]>]+)/g

/**
 * Render a release note. Custom notes can include two special bits:
 *
 *   - Lines like `run: <label> | <command(s)>` become a button. Clicking
 *     prompts the user to confirm, then runs the command(s) on the
 *     currently selected Quest. The "<label> |" part is optional; without
 *     it the button is labeled with the command text itself.
 *
 *     Within the command part:
 *       * Steps starting with `adb ` are passed through to the bundled
 *         adb binary verbatim (e.g. `adb install -g app.apk`,
 *         `adb push folder /sdcard/...`). We auto-inject `-s <serial>` if
 *         the author didn't include one, so multi-device setups don't
 *         fire on the wrong headset.
 *       * Steps without that prefix are treated as `adb shell <step>`
 *         (the original behavior - convenient for `pm clear ...` etc.).
 *       * Multiple steps can be chained with `&` and run sequentially.
 *         All steps run regardless of intermediate output - we don't try
 *         to short-circuit on "looks like an error" because adb's exit
 *         signaling isn't reliable enough for that. The combined output
 *         is shown inline below the note.
 *
 *   - Bare URLs anywhere in the text are turned into clickable links that
 *     open in the user's default browser (the main process intercepts
 *     new windows and forwards them to shell.openExternal).
 *
 * Everything else renders as plain text in the same monospace block we
 * used for server notes.
 */

interface NoteRendererProps {
  note: string
  selectedDevice: string | null
}

interface RunDirective {
  kind: 'run'
  label: string
  command: string
  raw: string
}

interface TextLine {
  kind: 'text'
  text: string
}

type ParsedLine = RunDirective | TextLine

function parseNote(note: string): ParsedLine[] {
  const out: ParsedLine[] = []
  for (const raw of note.split(/\r?\n/)) {
    const m = raw.match(/^\s*run:\s*(.+)$/i)
    if (m) {
      const rest = m[1]
      const pipeIdx = rest.indexOf('|')
      let label: string
      let command: string
      if (pipeIdx >= 0) {
        label = rest.slice(0, pipeIdx).trim()
        command = rest.slice(pipeIdx + 1).trim()
      } else {
        command = rest.trim()
        label = command
      }
      if (command.length > 0) {
        out.push({ kind: 'run', label, command, raw: raw })
        continue
      }
    }
    out.push({ kind: 'text', text: raw })
  }
  return out
}

function renderTextWithLinks(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  URL_RE.lastIndex = 0
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const url = match[0]
    parts.push(
      <a
        key={`${match.index}-${url}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'var(--vrcd-neon)', textDecoration: 'underline' }}
      >
        {url}
      </a>
    )
    lastIndex = match.index + url.length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

interface Step {
  /** What we'll show the user in the confirm prompt and result panel. */
  display: string
  /** How we actually run it. */
  exec:
    | { kind: 'shell'; command: string }
    | { kind: 'adb'; args: string }
}

/**
 * Split a `run:` payload on `&` and classify each step as a raw adb
 * invocation (starts with `adb `) or a shell command.
 *
 * For raw adb steps we strip the leading `adb ` and inject `-s <serial>`
 * if the author didn't already specify a target. We don't try to be
 * clever about quoting - whatever the author wrote is passed through to
 * the adb binary as one args string.
 */
function splitSteps(payload: string, serial: string | null): Step[] {
  const out: Step[] = []
  for (const rawSegment of payload.split('&')) {
    const segment = rawSegment.trim()
    if (!segment) continue
    const adbMatch = segment.match(/^adb\s+(.+)$/i)
    if (adbMatch) {
      let args = adbMatch[1].trim()
      // Auto-target the connected device unless the author already did.
      if (serial && !/(^|\s)-s\s+\S+/.test(args) && !/(^|\s)-(?:e|d|t)\s/.test(args)) {
        args = `-s "${serial}" ${args}`
      }
      out.push({ display: `adb ${args}`, exec: { kind: 'adb', args } })
    } else {
      out.push({ display: `adb shell ${segment}`, exec: { kind: 'shell', command: segment } })
    }
  }
  return out
}

interface StepResult {
  display: string
  output: string
  ok: boolean
}

const NoteRenderer: React.FC<NoteRendererProps> = ({ note, selectedDevice }) => {
  const [runningCommand, setRunningCommand] = useState<string | null>(null)
  const [results, setResults] = useState<StepResult[] | null>(null)
  const lines = parseNote(note)

  const handleRun = async (label: string, command: string): Promise<void> => {
    if (!selectedDevice) {
      window.alert('Connect a Quest before running commands from notes.')
      return
    }
    const steps = splitSteps(command, selectedDevice)
    if (steps.length === 0) return

    const plan = steps.map((s, i) => `${i + 1}. ${s.display}`).join('\n')
    const ok = window.confirm(
      `Run ${steps.length === 1 ? 'this' : `these ${steps.length} steps`} on ${selectedDevice}?\n\n${plan}\n\n(${label})`
    )
    if (!ok) return

    setRunningCommand(command)
    setResults(null)
    const collected: StepResult[] = []
    try {
      for (const step of steps) {
        try {
          if (step.exec.kind === 'shell') {
            const out = await window.api.adb.runShellCommand(
              selectedDevice,
              step.exec.command
            )
            collected.push({
              display: step.display,
              output: out ?? '(no output)',
              ok: out !== null
            })
          } else {
            const out = await window.api.adb.runLocalAdbCommand(step.exec.args)
            // adb prints failures to stderr but runLocalAdbCommand merges
            // stdout+stderr into one string - flag obvious error markers.
            const looksFailed = /^(?:error|failure)\b|^adb:\s*error/im.test(out)
            collected.push({
              display: step.display,
              output: out || '(no output)',
              ok: !looksFailed
            })
          }
        } catch (err) {
          collected.push({
            display: step.display,
            output: err instanceof Error ? err.message : String(err),
            ok: false
          })
        }
      }
    } finally {
      setResults(collected)
      setRunningCommand(null)
    }
  }

  return (
    <div
      style={{
        fontFamily: 'monospace',
        fontSize: 12,
        color: 'rgba(var(--vrcd-neon-raw),0.8)',
        whiteSpace: 'pre-wrap',
        maxHeight: 220,
        overflowY: 'auto',
        background: 'rgba(var(--vrcd-neon-raw),0.03)',
        border: '1px solid rgba(var(--vrcd-neon-raw),0.12)',
        borderRadius: 4,
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4
      }}
    >
      {lines.map((line, i) => {
        if (line.kind === 'run') {
          const isRunning = runningCommand === line.command
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '2px 0' }}>
              <Button
                size="small"
                appearance="primary"
                icon={isRunning ? <Spinner size="tiny" /> : <PlayRegular />}
                onClick={() => handleRun(line.label, line.command)}
                disabled={isRunning || !selectedDevice}
                title={`adb shell ${line.command}`}
                style={{ fontFamily: 'monospace' }}
              >
                {line.label}
              </Button>
              {!selectedDevice && (
                <Text size={100} style={{ color: 'rgba(var(--vrcd-neon-raw),0.4)' }}>
                  (connect a device to enable)
                </Text>
              )}
            </div>
          )
        }
        // Plain text line - linkify URLs.
        if (line.text.length === 0) return <div key={i}>&nbsp;</div>
        return <div key={i}>{renderTextWithLinks(line.text)}</div>
      })}
      {results && results.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {results.map((r, i) => (
            <div
              key={i}
              style={{
                padding: '6px 8px',
                borderRadius: 3,
                background: r.ok ? 'rgba(var(--vrcd-neon-raw),0.06)' : 'rgba(255,50,50,0.08)',
                border: `1px solid ${r.ok ? 'rgba(var(--vrcd-neon-raw),0.2)' : 'rgba(255,50,50,0.4)'}`,
                color: r.ok ? 'rgba(var(--vrcd-neon-raw),0.85)' : '#ff5555',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: 11
              }}
            >
              <div style={{ opacity: 0.6, marginBottom: 2 }}>
                {r.ok ? '$ ' : '! '}
                {r.display}
              </div>
              {r.output}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default NoteRenderer
