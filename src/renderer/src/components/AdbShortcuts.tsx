import React, { useCallback, useEffect, useMemo, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomShortcut {
  id: string
  label: string
  command: string
}

interface PresetShortcut {
  label: string
  command: string
  /** Optional human-readable hint shown on hover */
  desc?: string
}

interface PresetCategory {
  name: string
  items: PresetShortcut[]
}

interface AdbShortcutsProps {
  onRun: (command: string) => void
  disabled?: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'vrcyberdeck:adbCustomShortcuts'
const COLLAPSED_KEY = 'vrcyberdeck:adbShortcutsCollapsed'

const NEON = 'var(--vrcd-neon)'
const NEON_DIM = 'rgba(var(--vrcd-neon-raw),0.35)'
const PURPLE = 'var(--vrcd-purple)'

const PRESETS: PresetCategory[] = [
  {
    name: 'PERFORMANCE',
    items: [
      { label: 'CPU 4', command: 'setprop debug.oculus.cpuLevel 4', desc: 'Pin CPU to highest level (4)' },
      { label: 'GPU 4', command: 'setprop debug.oculus.gpuLevel 4', desc: 'Pin GPU to highest level (4)' },
      { label: 'CPU/GPU AUTO', command: 'setprop debug.oculus.cpuLevel 0 && setprop debug.oculus.gpuLevel 0', desc: 'Reset CPU/GPU governors to auto' },
      { label: '72 Hz', command: 'setprop debug.oculus.refreshRate 72' },
      { label: '90 Hz', command: 'setprop debug.oculus.refreshRate 90' },
      { label: '120 Hz', command: 'setprop debug.oculus.refreshRate 120' },
      { label: 'TEX 1.0', command: 'setprop debug.oculus.textureWidth 0 && setprop debug.oculus.textureHeight 0', desc: 'Reset render resolution to default' },
      { label: 'GFX STATS', command: 'dumpsys SurfaceFlinger --latency-clear', desc: 'Reset SurfaceFlinger frame stats' }
    ]
  },
  {
    name: 'UPDATES',
    items: [
      { label: 'BLOCK FW', command: 'pm disable-user --user 0 com.oculus.updater', desc: 'Disable the OS updater (rollback-friendly)' },
      { label: 'UNBLOCK FW', command: 'pm enable com.oculus.updater', desc: 'Re-enable the OS updater' },
      { label: 'BLOCK STORE', command: 'pm disable-user --user 0 com.oculus.store', desc: 'Disable Meta Store updates' },
      { label: 'UNBLOCK STORE', command: 'pm enable com.oculus.store' }
    ]
  },
  {
    name: 'SYSTEM',
    items: [
      { label: 'REBOOT', command: 'reboot' },
      { label: 'REBOOT BOOTLOADER', command: 'reboot bootloader' },
      { label: 'REBOOT RECOVERY', command: 'reboot recovery' },
      { label: 'BATTERY', command: 'dumpsys battery', desc: 'Show full battery status' },
      { label: 'STORAGE', command: 'df -h /sdcard' },
      { label: 'WIFI INFO', command: 'dumpsys wifi | head -40' },
      { label: 'IP ADDR', command: 'ip route | awk \'{print $9}\'', desc: 'Print device IP address' },
      { label: 'PROXIMITY OFF', command: 'am broadcast -a com.oculus.vrpowermanager.prox_close', desc: 'Disable proximity sensor (sleep prevention)' },
      { label: 'PROXIMITY ON', command: 'am broadcast -a com.oculus.vrpowermanager.automation_disable' }
    ]
  },
  {
    name: 'PACKAGES',
    items: [
      { label: 'LIST 3RD-PARTY', command: 'pm list packages -3' },
      { label: 'LIST ALL', command: 'pm list packages' },
      { label: 'CURRENT APP', command: 'dumpsys window | grep -E \'mCurrentFocus|mFocusedApp\'' }
    ]
  },
  {
    name: 'WIRELESS',
    items: [
      { label: 'TCPIP 5555', command: 'adb tcpip 5555', desc: 'Switch local adbd to TCP mode on port 5555' },
      { label: 'DEVICES', command: 'adb devices -l' }
    ]
  }
]

// ─── Persistence ──────────────────────────────────────────────────────────────

function readCustom(): CustomShortcut[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (s) =>
        s &&
        typeof s.id === 'string' &&
        typeof s.label === 'string' &&
        typeof s.command === 'string'
    )
  } catch {
    return []
  }
}

function writeCustom(items: CustomShortcut[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* ignore */
  }
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

function writeCollapsed(v: boolean): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, String(v))
  } catch {
    /* ignore */
  }
}

// ─── Pill button ──────────────────────────────────────────────────────────────

interface PillProps {
  children: React.ReactNode
  onClick: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  title?: string
  disabled?: boolean
  variant?: 'neon' | 'purple' | 'add'
}

const Pill: React.FC<PillProps> = ({ children, onClick, onContextMenu, title, disabled, variant = 'neon' }) => {
  const [hovered, setHovered] = useState(false)
  const color = variant === 'purple' ? PURPLE : NEON
  const colorRaw = variant === 'purple' ? 'var(--vrcd-purple-raw)' : 'var(--vrcd-neon-raw)'
  const dashed = variant === 'add'
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={title}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered && !disabled ? `rgba(${colorRaw},0.12)` : 'transparent',
        border: `1px ${dashed ? 'dashed' : 'solid'} ${hovered && !disabled ? color : `rgba(${colorRaw},0.4)`}`,
        color: hovered && !disabled ? color : `rgba(${colorRaw},0.8)`,
        fontFamily: "var(--vrcd-font-mono)",
        fontSize: '11px',
        letterSpacing: '0.06em',
        padding: '4px 10px',
        borderRadius: '4px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        whiteSpace: 'nowrap',
        boxShadow: hovered && !disabled ? `0 0 8px rgba(${colorRaw},0.35)` : 'none',
        transition: 'border-color 0.15s, color 0.15s, box-shadow 0.15s, background 0.15s'
      }}
    >
      {children}
    </button>
  )
}

// ─── Add/Edit modal ───────────────────────────────────────────────────────────

interface ShortcutEditorProps {
  initial?: CustomShortcut | null
  onSave: (label: string, command: string) => void
  onCancel: () => void
}

const ShortcutEditor: React.FC<ShortcutEditorProps> = ({ initial, onSave, onCancel }) => {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [command, setCommand] = useState(initial?.command ?? '')

  const inputStyle: React.CSSProperties = {
    background: '#000008',
    border: `1px solid ${NEON_DIM}`,
    color: NEON,
    fontFamily: "var(--vrcd-font-mono)",
    fontSize: '12px',
    padding: '6px 10px',
    borderRadius: '3px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box'
  }

  const canSave = label.trim().length > 0 && command.trim().length > 0

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1500,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#030310',
          border: `1px solid rgba(var(--vrcd-neon-raw),0.45)`,
          borderRadius: '6px',
          padding: '20px 22px',
          width: '440px',
          maxWidth: '90vw',
          fontFamily: "var(--vrcd-font-mono)",
          boxShadow: '0 0 40px rgba(var(--vrcd-neon-raw),0.1)'
        }}
      >
        <div
          style={{
            color: PURPLE,
            fontSize: '14px',
            letterSpacing: '0.12em',
            fontWeight: 700,
            marginBottom: '14px',
            textShadow: `0 0 8px rgba(var(--vrcd-purple-raw),0.6)`
          }}
        >
          [ {initial ? 'EDIT' : 'NEW'} CUSTOM SHORTCUT ]
        </div>

        <label style={{ display: 'block', color: 'rgba(var(--vrcd-neon-raw),0.6)', fontSize: '11px', marginBottom: '4px', letterSpacing: '0.08em' }}>
          LABEL
        </label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. ENABLE PROXIMITY"
          spellCheck={false}
          autoFocus
          style={{ ...inputStyle, marginBottom: '14px' }}
        />

        <label style={{ display: 'block', color: 'rgba(var(--vrcd-neon-raw),0.6)', fontSize: '11px', marginBottom: '4px', letterSpacing: '0.08em' }}>
          COMMAND
        </label>
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="e.g. setprop debug.oculus.cpuLevel 3"
          spellCheck={false}
          style={inputStyle}
        />
        <div style={{ color: 'rgba(var(--vrcd-neon-raw),0.4)', fontSize: '10px', marginTop: '4px' }}>
          Same syntax as the shell input. Prefix with &quot;adb &quot; for local adb commands.
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <Pill onClick={onCancel}>CANCEL</Pill>
          <Pill
            onClick={() => canSave && onSave(label.trim(), command.trim())}
            disabled={!canSave}
            variant="purple"
          >
            {initial ? 'SAVE' : 'ADD'}
          </Pill>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const AdbShortcuts: React.FC<AdbShortcutsProps> = ({ onRun, disabled }) => {
  const [custom, setCustom] = useState<CustomShortcut[]>(() => readCustom())
  const [collapsed, setCollapsed] = useState(() => readCollapsed())
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    writeCustom(custom)
  }, [custom])

  useEffect(() => {
    writeCollapsed(collapsed)
  }, [collapsed])

  const editing = useMemo(
    () => (editingId ? custom.find((c) => c.id === editingId) ?? null : null),
    [editingId, custom]
  )

  const addOrUpdate = useCallback(
    (label: string, command: string) => {
      if (editingId) {
        setCustom((prev) =>
          prev.map((c) => (c.id === editingId ? { ...c, label, command } : c))
        )
      } else {
        const id = `cs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
        setCustom((prev) => [...prev, { id, label, command }])
      }
      setEditorOpen(false)
      setEditingId(null)
    },
    [editingId]
  )

  const handleCustomContextMenu = useCallback(
    (item: CustomShortcut) =>
      (e: React.MouseEvent): void => {
        e.preventDefault()
        const action = window.confirm(
          `Edit "${item.label}"?\n\nCommand: ${item.command}\n\nOK = Edit · Cancel = Delete`
        )
        if (action) {
          setEditingId(item.id)
          setEditorOpen(true)
        } else {
          if (window.confirm(`Delete "${item.label}"?`)) {
            setCustom((prev) => prev.filter((c) => c.id !== item.id))
          }
        }
      },
    []
  )

  return (
    <>
      <div
        style={{
          border: `1px solid ${NEON_DIM}`,
          borderRadius: '4px',
          background: 'rgba(0,0,8,0.5)',
          fontFamily: "var(--vrcd-font-mono)"
        }}
      >
        {/* Header bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 12px',
            borderBottom: collapsed ? 'none' : `1px solid rgba(var(--vrcd-neon-raw),0.15)`,
            cursor: 'pointer',
            userSelect: 'none'
          }}
          onClick={() => setCollapsed((v) => !v)}
        >
          <span
            style={{
              color: 'rgba(var(--vrcd-neon-raw),0.65)',
              fontSize: '11px',
              letterSpacing: '0.14em'
            }}
          >
            // QUICK COMMANDS
          </span>
          <span
            style={{
              color: 'rgba(var(--vrcd-neon-raw),0.45)',
              fontSize: '10px',
              letterSpacing: '0.1em'
            }}
          >
            {collapsed ? '▸ EXPAND' : '▾ COLLAPSE'}
          </span>
        </div>

        {!collapsed && (
          <div
            style={{
              padding: '10px 12px',
              maxHeight: '180px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            {PRESETS.map((cat) => (
              <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    color: 'rgba(var(--vrcd-neon-raw),0.45)',
                    fontSize: '10px',
                    letterSpacing: '0.16em',
                    minWidth: '90px',
                    flexShrink: 0
                  }}
                >
                  {cat.name}
                </span>
                {cat.items.map((it) => (
                  <Pill
                    key={it.label}
                    onClick={() => onRun(it.command)}
                    disabled={disabled}
                    title={it.desc ? `${it.desc}\n\n$ ${it.command}` : `$ ${it.command}`}
                  >
                    {it.label}
                  </Pill>
                ))}
              </div>
            ))}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                paddingTop: '6px',
                borderTop: `1px solid rgba(var(--vrcd-purple-raw),0.18)`
              }}
            >
              <span
                style={{
                  color: 'rgba(var(--vrcd-purple-raw),0.7)',
                  fontSize: '10px',
                  letterSpacing: '0.16em',
                  minWidth: '90px',
                  flexShrink: 0
                }}
              >
                MY MACROS
              </span>
              {custom.length === 0 && (
                <span
                  style={{
                    color: 'rgba(var(--vrcd-neon-raw),0.35)',
                    fontSize: '11px',
                    fontStyle: 'italic'
                  }}
                >
                  none yet — click [+] to add one
                </span>
              )}
              {custom.map((c) => (
                <Pill
                  key={c.id}
                  onClick={() => onRun(c.command)}
                  onContextMenu={handleCustomContextMenu(c)}
                  disabled={disabled}
                  title={`$ ${c.command}\n\nright-click to edit / delete`}
                  variant="purple"
                >
                  {c.label}
                </Pill>
              ))}
              <Pill
                onClick={() => {
                  setEditingId(null)
                  setEditorOpen(true)
                }}
                disabled={disabled}
                variant="add"
                title="Add a custom shortcut"
              >
                + ADD
              </Pill>
            </div>
          </div>
        )}
      </div>

      {editorOpen && (
        <ShortcutEditor
          initial={editing}
          onSave={addOrUpdate}
          onCancel={() => {
            setEditorOpen(false)
            setEditingId(null)
          }}
        />
      )}
    </>
  )
}

export default AdbShortcuts
