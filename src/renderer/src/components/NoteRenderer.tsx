import React, { useState } from 'react'
import { Button, Spinner, Text } from '@fluentui/react-components'
import { PlayRegular } from '@fluentui/react-icons'

const URL_RE = /(https?:\/\/[^\s)\]>]+)/g

/**
 * Render a release note. Custom notes can include two special bits:
 *
 *   - Lines like `run: <label> | <shell command>` become a button. Clicking
 *     prompts the user to confirm, then runs the shell command on the
 *     currently selected device via adb. The "<label> |" part is optional;
 *     without it the button shows the raw command.
 *   - Bare URLs anywhere in the text are turned into clickable links that
 *     open in the user's default browser (the main process intercepts new
 *     windows and forwards them to shell.openExternal).
 *
 * Everything else renders as plain text in the same monospace block we used
 * for server notes.
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

const NoteRenderer: React.FC<NoteRendererProps> = ({ note, selectedDevice }) => {
  const [runningCommand, setRunningCommand] = useState<string | null>(null)
  const [resultLine, setResultLine] = useState<{ command: string; ok: boolean; output: string } | null>(null)
  const lines = parseNote(note)

  const handleRun = async (label: string, command: string): Promise<void> => {
    if (!selectedDevice) {
      window.alert('Connect a Quest before running commands from notes.')
      return
    }
    const ok = window.confirm(
      `Run this on ${selectedDevice}?\n\nadb shell ${command}\n\n(${label})`
    )
    if (!ok) return
    setRunningCommand(command)
    setResultLine(null)
    try {
      const output = await window.api.adb.runShellCommand(selectedDevice, command)
      setResultLine({ command, ok: output !== null, output: output ?? '(no output)' })
    } catch (err) {
      setResultLine({
        command,
        ok: false,
        output: err instanceof Error ? err.message : String(err)
      })
    } finally {
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
      {resultLine && (
        <div
          style={{
            marginTop: 6,
            padding: '6px 8px',
            borderRadius: 3,
            background: resultLine.ok ? 'rgba(var(--vrcd-neon-raw),0.06)' : 'rgba(255,50,50,0.08)',
            border: `1px solid ${resultLine.ok ? 'rgba(var(--vrcd-neon-raw),0.2)' : 'rgba(255,50,50,0.4)'}`,
            color: resultLine.ok ? 'rgba(var(--vrcd-neon-raw),0.85)' : '#ff5555',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: 11
          }}
        >
          <div style={{ opacity: 0.6, marginBottom: 2 }}>
            {resultLine.ok ? '$ ' : '! '}
            {resultLine.command}
          </div>
          {resultLine.output}
        </div>
      )}
    </div>
  )
}

export default NoteRenderer
