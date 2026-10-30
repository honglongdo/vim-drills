import { useEffect, useState } from 'react'
import './Keyboard.css'

type Key = {
  code: string
  label: string
  shift?: string
  width?: number
  vim?: string
  vimShift?: string
}

const ROWS: Key[][] = [
  [
    { code: 'Backquote', label: '`', shift: '~' },
    { code: 'Digit1', label: '1', shift: '!' },
    { code: 'Digit2', label: '2', shift: '@' },
    { code: 'Digit3', label: '3', shift: '#' },
    { code: 'Digit4', label: '4', shift: '$', vimShift: 'line end' },
    { code: 'Digit5', label: '5', shift: '%', vimShift: 'match ()' },
    { code: 'Digit6', label: '6', shift: '^' },
    { code: 'Digit7', label: '7', shift: '&' },
    { code: 'Digit8', label: '8', shift: '*' },
    { code: 'Digit9', label: '9', shift: '(' },
    { code: 'Digit0', label: '0', shift: ')', vim: 'line start' },
    { code: 'Minus', label: '-', shift: '_' },
    { code: 'Equal', label: '=', shift: '+' },
    { code: 'Backspace', label: 'Backspace', width: 2 },
  ],
  [
    { code: 'Tab', label: 'Tab', width: 1.5 },
    { code: 'KeyQ', label: 'Q' },
    { code: 'KeyW', label: 'W', vim: 'word' },
    { code: 'KeyE', label: 'E', vim: 'word end' },
    { code: 'KeyR', label: 'R', vim: 'replace', vimShift: 'replace mode' },
    { code: 'KeyT', label: 'T' },
    { code: 'KeyY', label: 'Y', vim: 'yank' },
    { code: 'KeyU', label: 'U', vim: 'undo', vimShift: 'undo line' },
    { code: 'KeyI', label: 'I', vim: 'insert' },
    { code: 'KeyO', label: 'O', vim: 'open ↓', vimShift: 'open ↑' },
    { code: 'KeyP', label: 'P', vim: 'put' },
    { code: 'BracketLeft', label: '[', shift: '{' },
    { code: 'BracketRight', label: ']', shift: '}' },
    { code: 'Backslash', label: '\\', shift: '|', width: 1.5 },
  ],
  [
    { code: 'CapsLock', label: 'Caps', width: 1.75 },
    { code: 'KeyA', label: 'A', vim: 'append', vimShift: 'append end' },
    { code: 'KeyS', label: 'S' },
    { code: 'KeyD', label: 'D', vim: 'delete' },
    { code: 'KeyF', label: 'F' },
    { code: 'KeyG', label: 'G', vim: 'gg top', vimShift: 'bottom' },
    { code: 'KeyH', label: 'H', vim: '←' },
    { code: 'KeyJ', label: 'J', vim: '↓' },
    { code: 'KeyK', label: 'K', vim: '↑' },
    { code: 'KeyL', label: 'L', vim: '→' },
    { code: 'Semicolon', label: ';', shift: ':', vimShift: 'command' },
    { code: 'Quote', label: "'", shift: '"' },
    { code: 'Enter', label: 'Enter', width: 2.25 },
  ],
  [
    { code: 'ShiftLeft', label: 'Shift', width: 2.25 },
    { code: 'KeyZ', label: 'Z' },
    { code: 'KeyX', label: 'X', vim: 'del char' },
    { code: 'KeyC', label: 'C', vim: 'change' },
    { code: 'KeyV', label: 'V', vim: 'visual' },
    { code: 'KeyB', label: 'B' },
    { code: 'KeyN', label: 'N', vim: 'next', vimShift: 'prev' },
    { code: 'KeyM', label: 'M' },
    { code: 'Comma', label: ',', shift: '<' },
    { code: 'Period', label: '.', shift: '>' },
    { code: 'Slash', label: '/', shift: '?', vim: 'search', vimShift: 'search ↑' },
    { code: 'ShiftRight', label: 'Shift', width: 2.75 },
  ],
  [
    { code: 'Escape', label: 'Esc', width: 1.5, vim: 'normal' },
    { code: 'ControlLeft', label: 'Ctrl', width: 1.5 },
    { code: 'AltLeft', label: 'Alt', width: 1.5 },
    { code: 'Space', label: '', width: 6 },
    { code: 'AltRight', label: 'Alt', width: 1.5 },
    { code: 'ControlRight', label: 'Ctrl', width: 3 },
  ],
]

function Keyboard() {
  const [pressed, setPressed] = useState<Set<string>>(new Set())

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
    <div className="keyboard" role="img" aria-label="Keyboard with Vim key hints">
      {ROWS.map((row, i) => (
        <div className="keyboard-row" key={i}>
          {row.map((key) => (
            <div
              key={key.code}
              className={[
                'key',
                (key.vim || key.vimShift) && 'has-vim',
                pressed.has(key.code) && 'pressed',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ flexGrow: key.width ?? 1 }}
            >
              {key.shift && <span className="key-shift">{key.shift}</span>}
              <span className="key-label">{key.label}</span>
              {key.vim && <span className="key-vim">{key.vim}</span>}
              {key.vimShift && (
                <span className="key-vim">⇧ {key.vimShift}</span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default Keyboard
