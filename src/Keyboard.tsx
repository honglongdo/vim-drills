import { useEffect, useState } from 'react'
import './Keyboard.css'

type Key = {
  code: string
  label: string
  shift?: string
  width?: number
}

type Hint = {
  vim?: string
  vimShift?: string
}

const ROWS: Key[][] = [
  [
    { code: 'Backquote', label: '`', shift: '~' },
    { code: 'Digit1', label: '1', shift: '!' },
    { code: 'Digit2', label: '2', shift: '@' },
    { code: 'Digit3', label: '3', shift: '#' },
    { code: 'Digit4', label: '4', shift: '$' },
    { code: 'Digit5', label: '5', shift: '%' },
    { code: 'Digit6', label: '6', shift: '^' },
    { code: 'Digit7', label: '7', shift: '&' },
    { code: 'Digit8', label: '8', shift: '*' },
    { code: 'Digit9', label: '9', shift: '(' },
    { code: 'Digit0', label: '0', shift: ')' },
    { code: 'Minus', label: '-', shift: '_' },
    { code: 'Equal', label: '=', shift: '+' },
    { code: 'Backspace', label: 'Backspace', width: 2 },
  ],
  [
    { code: 'Tab', label: 'Tab', width: 1.5 },
    { code: 'KeyQ', label: 'Q' },
    { code: 'KeyW', label: 'W' },
    { code: 'KeyE', label: 'E' },
    { code: 'KeyR', label: 'R' },
    { code: 'KeyT', label: 'T' },
    { code: 'KeyY', label: 'Y' },
    { code: 'KeyU', label: 'U' },
    { code: 'KeyI', label: 'I' },
    { code: 'KeyO', label: 'O' },
    { code: 'KeyP', label: 'P' },
    { code: 'BracketLeft', label: '[', shift: '{' },
    { code: 'BracketRight', label: ']', shift: '}' },
    { code: 'Backslash', label: '\\', shift: '|', width: 1.5 },
  ],
  [
    { code: 'CapsLock', label: 'Caps', width: 1.75 },
    { code: 'KeyA', label: 'A' },
    { code: 'KeyS', label: 'S' },
    { code: 'KeyD', label: 'D' },
    { code: 'KeyF', label: 'F' },
    { code: 'KeyG', label: 'G' },
    { code: 'KeyH', label: 'H' },
    { code: 'KeyJ', label: 'J' },
    { code: 'KeyK', label: 'K' },
    { code: 'KeyL', label: 'L' },
    { code: 'Semicolon', label: ';', shift: ':' },
    { code: 'Quote', label: "'", shift: '"' },
    { code: 'Enter', label: 'Enter', width: 2.25 },
  ],
  [
    { code: 'ShiftLeft', label: 'Shift', width: 2.25 },
    { code: 'KeyZ', label: 'Z' },
    { code: 'KeyX', label: 'X' },
    { code: 'KeyC', label: 'C' },
    { code: 'KeyV', label: 'V' },
    { code: 'KeyB', label: 'B' },
    { code: 'KeyN', label: 'N' },
    { code: 'KeyM', label: 'M' },
    { code: 'Comma', label: ',', shift: '<' },
    { code: 'Period', label: '.', shift: '>' },
    { code: 'Slash', label: '/', shift: '?' },
    { code: 'ShiftRight', label: 'Shift', width: 2.75 },
  ],
  [
    { code: 'Escape', label: 'Esc', width: 1.5 },
    { code: 'ControlLeft', label: 'Ctrl', width: 1.5 },
    { code: 'AltLeft', label: 'Alt', width: 1.5 },
    { code: 'Space', label: '', width: 6 },
    { code: 'AltRight', label: 'Alt', width: 1.5 },
    { code: 'ControlRight', label: 'Ctrl', width: 3 },
  ],
]

// Everything taught in vimtutor (lessons 1-7).
const BEGINNER: Record<string, Hint> = {
  Digit4: { vimShift: 'line end' },
  Digit5: { vimShift: 'match ()' },
  Digit0: { vim: 'line start' },
  KeyW: { vim: 'word' },
  KeyE: { vim: 'word end' },
  KeyR: { vim: 'replace', vimShift: 'replace mode' },
  KeyY: { vim: 'yank' },
  KeyU: { vim: 'undo', vimShift: 'undo line' },
  KeyI: { vim: 'insert' },
  KeyO: { vim: 'open ↓', vimShift: 'open ↑' },
  KeyP: { vim: 'put' },
  KeyA: { vim: 'append', vimShift: 'append end' },
  KeyD: { vim: 'delete' },
  KeyG: { vim: 'gg top', vimShift: 'bottom' },
  KeyH: { vim: '←' },
  KeyJ: { vim: '↓' },
  KeyK: { vim: '↑' },
  KeyL: { vim: '→' },
  Semicolon: { vimShift: 'command' },
  KeyX: { vim: 'del char' },
  KeyC: { vim: 'change' },
  KeyV: { vim: 'visual' },
  KeyN: { vim: 'next', vimShift: 'prev' },
  Slash: { vim: 'search', vimShift: 'search ↑' },
  Escape: { vim: 'normal' },
}

// Every single-key Normal-mode command in Vim's `:help normal-index`.
const COMPLETE: Record<string, Hint> = {
  Backquote: { vim: 'to mark', vimShift: 'case' },
  Digit1: { vim: 'count', vimShift: 'filter' },
  Digit2: { vim: 'count', vimShift: 'run macro' },
  Digit3: { vim: 'count', vimShift: 'word ↑' },
  Digit4: { vim: 'count', vimShift: 'line end' },
  Digit5: { vim: 'count', vimShift: 'match ()' },
  Digit6: { vim: 'count', vimShift: 'first char' },
  Digit7: { vim: 'count', vimShift: 'repeat :s' },
  Digit8: { vim: 'count', vimShift: 'word ↓' },
  Digit9: { vim: 'count', vimShift: 'sentence ←' },
  Digit0: { vim: 'line start', vimShift: 'sentence →' },
  Minus: { vim: 'line ↑', vimShift: 'first char' },
  Equal: { vim: 'auto indent', vimShift: 'line ↓' },
  Backspace: { vim: '←' },
  KeyQ: { vim: 'record', vimShift: 'Ex mode' },
  KeyW: { vim: 'word', vimShift: 'WORD' },
  KeyE: { vim: 'word end', vimShift: 'WORD end' },
  KeyR: { vim: 'replace', vimShift: 'replace mode' },
  KeyT: { vim: 'till', vimShift: 'till ←' },
  KeyY: { vim: 'yank', vimShift: 'yank line' },
  KeyU: { vim: 'undo', vimShift: 'undo line' },
  KeyI: { vim: 'insert', vimShift: 'insert start' },
  KeyO: { vim: 'open ↓', vimShift: 'open ↑' },
  KeyP: { vim: 'put', vimShift: 'put before' },
  BracketLeft: { vim: '[ prefix', vimShift: 'paragraph ↑' },
  BracketRight: { vim: '] prefix', vimShift: 'paragraph ↓' },
  Backslash: { vimShift: 'column' },
  KeyA: { vim: 'append', vimShift: 'append end' },
  KeyS: { vim: 'subst char', vimShift: 'subst line' },
  KeyD: { vim: 'delete', vimShift: 'del to end' },
  KeyF: { vim: 'find', vimShift: 'find ←' },
  KeyG: { vim: 'g prefix', vimShift: 'bottom' },
  KeyH: { vim: '←', vimShift: 'screen top' },
  KeyJ: { vim: '↓', vimShift: 'join' },
  KeyK: { vim: '↑', vimShift: 'lookup' },
  KeyL: { vim: '→', vimShift: 'screen bottom' },
  Semicolon: { vim: 'repeat f/t', vimShift: 'command' },
  Quote: { vim: 'mark line', vimShift: 'register' },
  Enter: { vim: 'line ↓' },
  KeyZ: { vim: 'z prefix', vimShift: 'ZZ / ZQ quit' },
  KeyX: { vim: 'del char', vimShift: 'del before' },
  KeyC: { vim: 'change', vimShift: 'change end' },
  KeyV: { vim: 'visual', vimShift: 'visual line' },
  KeyB: { vim: 'back', vimShift: 'WORD back' },
  KeyN: { vim: 'next', vimShift: 'prev' },
  KeyM: { vim: 'set mark', vimShift: 'screen middle' },
  Comma: { vim: 'f/t back', vimShift: 'unindent' },
  Period: { vim: 'repeat', vimShift: 'indent' },
  Slash: { vim: 'search', vimShift: 'search ↑' },
  Escape: { vim: 'normal' },
  Space: { vim: '→' },
}

const MODES = [
  { id: 'beginner', label: 'Beginner (vimtutor)', hints: BEGINNER },
  { id: 'complete', label: 'Complete', hints: COMPLETE },
]

function Keyboard() {
  const [pressed, setPressed] = useState<Set<string>>(new Set())
  const [modeId, setModeId] = useState('beginner')
  const hints = MODES.find((m) => m.id === modeId)!.hints

  useEffect(() => {
    const down = (e: KeyboardEvent) =>
      setPressed((prev) => new Set(prev).add(e.code))
    const up = (e: KeyboardEvent) =>
      setPressed((prev) => {
        const next = new Set(prev)
        next.delete(e.code)
        return next
      })
    const clear = () => setPressed(new Set())

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [])

  return (
    <div className="keyboard-wrap">
      <div className="keyboard-tabs" role="tablist" aria-label="Command set">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            role="tab"
            aria-selected={mode.id === modeId}
            className={mode.id === modeId ? 'keyboard-tab active' : 'keyboard-tab'}
            onClick={() => setModeId(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className="keyboard" role="img" aria-label="Keyboard with Vim key hints">
        {ROWS.map((row, i) => (
          <div className="keyboard-row" key={i}>
            {row.map((key) => {
              const hint = hints[key.code] ?? {}
              return (
                <div
                  key={key.code}
                  className={[
                    'key',
                    (hint.vim || hint.vimShift) && 'has-vim',
                    pressed.has(key.code) && 'pressed',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{ flexGrow: key.width ?? 1 }}
                  title={
                    [hint.vim, hint.vimShift && `⇧ ${hint.vimShift}`]
                      .filter(Boolean)
                      .join('\n') || undefined
                  }
                >
                  {key.shift && <span className="key-shift">{key.shift}</span>}
                  <span className="key-label">{key.label}</span>
                  {hint.vim && <span className="key-vim">{hint.vim}</span>}
                  {hint.vimShift && (
                    <span className="key-vim">⇧ {hint.vimShift}</span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export default Keyboard
