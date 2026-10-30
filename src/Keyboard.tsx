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

type Input = {
  id: number
  notation: string
  code: string
  shift: boolean
  modified: boolean
}

const MAX_INPUTS = 40

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'])

const KEY_NAMES: Record<string, string> = {
  Escape: 'Esc',
  Enter: 'CR',
  Backspace: 'BS',
  Tab: 'Tab',
  Delete: 'Del',
  ' ': 'Space',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
}

// Write a key press the way Vim's docs do: `w`, `A`, `<Esc>`, `<C-r>`.
function toVimNotation(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null

  const named = KEY_NAMES[e.key] ?? (e.key.length > 1 ? e.key : undefined)
  const base = named ?? (e.ctrlKey || e.altKey ? e.key.toLowerCase() : e.key)
  const prefix = (e.ctrlKey ? 'C-' : '') + (e.altKey ? 'A-' : '')

  return prefix || named ? `<${prefix}${base}>` : base
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

// Longer explanations of each COMPLETE hint, shown when hovering a key.
// Wording follows Vim's `:help normal-index`.
const DESCRIPTIONS: Record<string, Hint> = {
  Backquote: {
    vim: '`{a-z} jumps to the exact position of mark {a-z}.',
    vimShift: 'Switches the case of the character under the cursor.',
  },
  Digit1: {
    vim: 'Count: type a number before a command to repeat it, e.g. 3w.',
    vimShift: '!{motion}{filter} filters text through an external command.',
  },
  Digit2: {
    vim: 'Count: type a number before a command to repeat it, e.g. 3w.',
    vimShift: '@{a-z} runs the macro stored in register {a-z}. @@ repeats the last one.',
  },
  Digit3: {
    vim: 'Count: type a number before a command to repeat it, e.g. 3w.',
    vimShift: 'Searches backward for the word under the cursor.',
  },
  Digit4: {
    vim: 'Count: type a number before a command to repeat it, e.g. 3w.',
    vimShift: 'Moves to the end of the line.',
  },
  Digit5: {
    vim: 'Count: type a number before a command to repeat it, e.g. 3w.',
    vimShift: 'Jumps to the matching (, [ or { bracket.',
  },
  Digit6: {
    vim: 'Count: type a number before a command to repeat it, e.g. 3w.',
    vimShift: 'Moves to the first non-blank character of the line.',
  },
  Digit7: {
    vim: 'Count: type a number before a command to repeat it, e.g. 3w.',
    vimShift: 'Repeats the last :s substitution on the current line.',
  },
  Digit8: {
    vim: 'Count: type a number before a command to repeat it, e.g. 3w.',
    vimShift: 'Searches forward for the word under the cursor.',
  },
  Digit9: {
    vim: 'Count: type a number before a command to repeat it, e.g. 3w.',
    vimShift: 'Moves back one sentence.',
  },
  Digit0: {
    vim: 'Moves to the very first character of the line.',
    vimShift: 'Moves forward one sentence.',
  },
  Minus: {
    vim: 'Moves to the first non-blank character of the line above.',
    vimShift: 'Moves to the first non-blank character of the current line.',
  },
  Equal: {
    vim: '={motion} re-indents text. == re-indents the current line.',
    vimShift: 'Moves to the first non-blank character of the line below.',
  },
  Backspace: { vim: 'Moves one character left.' },
  KeyQ: {
    vim: 'q{a-z} starts recording a macro into register {a-z}. Press q again to stop.',
    vimShift: 'Switches to Ex mode. Type :visual to come back.',
  },
  KeyW: {
    vim: 'Moves forward to the start of the next word.',
    vimShift: 'Moves forward to the next WORD (text separated by spaces).',
  },
  KeyE: {
    vim: 'Moves forward to the end of the word.',
    vimShift: 'Moves forward to the end of the WORD.',
  },
  KeyR: {
    vim: 'r{char} replaces the character under the cursor with {char}.',
    vimShift: 'Enters Replace mode: typing overwrites text until Esc.',
  },
  KeyT: {
    vim: 't{char} moves to just before the next {char} on the line.',
    vimShift: 'T{char} moves to just after the previous {char} on the line.',
  },
  KeyY: {
    vim: 'y{motion} yanks (copies) text. yy yanks the whole line.',
    vimShift: 'Yanks the whole line.',
  },
  KeyU: {
    vim: 'Undoes the last change.',
    vimShift: 'Undoes all recent changes on the current line.',
  },
  KeyI: {
    vim: 'Inserts text before the cursor.',
    vimShift: 'Inserts text at the first non-blank character of the line.',
  },
  KeyO: {
    vim: 'Opens a new line below and starts Insert mode.',
    vimShift: 'Opens a new line above and starts Insert mode.',
  },
  KeyP: {
    vim: 'Puts (pastes) text after the cursor, or below a deleted line.',
    vimShift: 'Puts (pastes) text before the cursor, or above the line.',
  },
  BracketLeft: {
    vim: 'Starts a [ command, e.g. [( jumps to the previous unmatched (.',
    vimShift: 'Moves back one paragraph.',
  },
  BracketRight: {
    vim: 'Starts a ] command, e.g. ]) jumps to the next unmatched ).',
    vimShift: 'Moves forward one paragraph.',
  },
  Backslash: { vimShift: 'Moves to column N (type the count first), or column 1.' },
  KeyA: {
    vim: 'Appends text after the cursor.',
    vimShift: 'Appends text at the end of the line.',
  },
  KeyS: {
    vim: 'Deletes the character under the cursor and starts Insert mode.',
    vimShift: 'Deletes the whole line and starts Insert mode.',
  },
  KeyD: {
    vim: 'd{motion} deletes text. dd deletes the whole line.',
    vimShift: 'Deletes from the cursor to the end of the line.',
  },
  KeyF: {
    vim: 'f{char} moves to the next {char} on the line.',
    vimShift: 'F{char} moves to the previous {char} on the line.',
  },
  KeyG: {
    vim: 'Starts a g command, e.g. gg goes to the first line.',
    vimShift: 'Goes to the last line, or to line N with a count.',
  },
  KeyH: {
    vim: 'Moves one character left.',
    vimShift: 'Moves to the top line of the screen.',
  },
  KeyJ: {
    vim: 'Moves one line down.',
    vimShift: 'Joins the line below onto the end of this one.',
  },
  KeyK: {
    vim: 'Moves one line up.',
    vimShift: 'Looks up the keyword under the cursor (e.g. in man pages).',
  },
  KeyL: {
    vim: 'Moves one character right.',
    vimShift: 'Moves to the bottom line of the screen.',
  },
  Semicolon: {
    vim: 'Repeats the last f, t, F or T jump.',
    vimShift: 'Starts a command-line command, e.g. :w to save or :q to quit.',
  },
  Quote: {
    vim: "'{a-z} jumps to the line of mark {a-z}.",
    vimShift: '"{a-z} picks a register for the next delete, yank or put.',
  },
  Enter: { vim: 'Moves to the first non-blank character of the next line.' },
  KeyZ: {
    vim: 'Starts a z command, e.g. zz centres the screen on the cursor.',
    vimShift: 'ZZ saves and quits. ZQ quits without saving.',
  },
  KeyX: {
    vim: 'Deletes the character under the cursor.',
    vimShift: 'Deletes the character before the cursor.',
  },
  KeyC: {
    vim: 'c{motion} deletes text and starts Insert mode. cc changes the line.',
    vimShift: 'Changes from the cursor to the end of the line.',
  },
  KeyV: {
    vim: 'Starts Visual mode, selecting by character.',
    vimShift: 'Starts Visual mode, selecting whole lines.',
  },
  KeyB: {
    vim: 'Moves back to the start of the word.',
    vimShift: 'Moves back to the start of the WORD.',
  },
  KeyN: {
    vim: 'Repeats the last / or ? search in the same direction.',
    vimShift: 'Repeats the last / or ? search in the opposite direction.',
  },
  KeyM: {
    vim: 'm{a-z} sets mark {a-z} at the cursor.',
    vimShift: 'Moves to the middle line of the screen.',
  },
  Comma: {
    vim: 'Repeats the last f, t, F or T jump in the opposite direction.',
    vimShift: '<{motion} shifts lines left. << unindents the current line.',
  },
  Period: {
    vim: 'Repeats the last change.',
    vimShift: '>{motion} shifts lines right. >> indents the current line.',
  },
  Slash: {
    vim: '/{pattern} searches forward. Press Enter to run the search.',
    vimShift: '?{pattern} searches backward. Press Enter to run the search.',
  },
  Escape: { vim: 'Returns to Normal mode, or cancels a half-typed command.' },
  Space: { vim: 'Moves one character right.' },
}

const MODES = [
  { id: 'beginner', label: 'Beginner (vimtutor)', hints: BEGINNER },
  { id: 'complete', label: 'Complete', hints: COMPLETE },
]

function Keyboard() {
  const [pressed, setPressed] = useState<Set<string>>(new Set())
  const [modeId, setModeId] = useState('beginner')
  const [inputs, setInputs] = useState<Input[]>([])
  const hints = MODES.find((m) => m.id === modeId)!.hints
  const shiftHeld = pressed.has('ShiftLeft') || pressed.has('ShiftRight')

  useEffect(() => {
    let nextId = 0
    const down = (e: KeyboardEvent) => {
      setPressed((prev) => new Set(prev).add(e.code))

      const notation = toVimNotation(e)
      if (!notation || e.repeat) return
      const input = {
        id: nextId++,
        notation,
        code: e.code,
        shift: e.shiftKey,
        modified: e.ctrlKey || e.altKey || e.metaKey,
      }
      setInputs((prev) => [...prev, input].slice(-MAX_INPUTS))
    }
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

      <div className="keyboard-body">
        <div className="keyboard" role="img" aria-label="Keyboard with Vim key hints">
          {ROWS.map((row, i) => (
            <div className="keyboard-row" key={i}>
              {row.map((key) => {
                const hint = hints[key.code] ?? {}
                const vim = shiftHeld ? hint.vimShift : hint.vim
                const isLetter = /^[A-Z]$/.test(key.label)
                // With Shift held, the shifted character becomes the main label.
                const label = isLetter
                  ? shiftHeld ? key.label : key.label.toLowerCase()
                  : shiftHeld && key.shift ? key.shift : key.label
                const corner = key.shift && (shiftHeld ? key.label : key.shift)
                const desc = DESCRIPTIONS[key.code] ?? {}
                const description = vim && (shiftHeld ? desc.vimShift : desc.vim)
                return (
                  <div
                    key={key.code}
                    className={[
                      'key',
                      vim && 'has-vim',
                      pressed.has(key.code) && 'pressed',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ flexGrow: key.width ?? 1 }}
                  >
                    {corner && <span className="key-shift">{corner}</span>}
                    <span className="key-label">{label}</span>
                    {vim && <span className="key-vim">{vim}</span>}
                    {description && (
                      <span className="key-tooltip" role="tooltip">
                        {description}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="input-log">
          <div className="input-log-header">
            <span>Your input</span>
            <button
              type="button"
              className="keyboard-tab"
              onClick={() => setInputs([])}
              disabled={inputs.length === 0}
            >
              Clear
            </button>
          </div>
          <div className="input-log-keys">
            {inputs.length === 0 ? (
              <span className="input-log-empty">Start typing…</span>
            ) : (
              inputs.map((input) => {
                const hint = hints[input.code] ?? {}
                const meaning = input.modified
                  ? undefined
                  : input.shift
                    ? hint.vimShift
                    : hint.vim
                return (
                  <div className="input-log-entry" key={input.id}>
                    <kbd>{input.notation}</kbd>
                    {meaning && <span className="input-log-meaning">{meaning}</span>}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Keyboard
