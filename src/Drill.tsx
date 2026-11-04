import { useEffect, useMemo, useRef, useState } from 'react'
import { minimalSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { Decoration, EditorView, lineNumbers } from '@codemirror/view'
import { getCM, vim, Vim } from '@replit/codemirror-vim'
import { explainStep, visible } from './explain.ts'
import { solve, splitKeys, type CommandSet, type Solution, type Step } from './solver.ts'
import { TASK_TYPES, type Pos, type Task, type TaskType } from './tasks.ts'
import './Drill.css'

const STORAGE_KEY = 'vim-drills:solved'
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'])

function loadSolved(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

function saveSolved(solved: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...solved]))
  } catch {
    // Progress just won't be remembered (e.g. private browsing).
  }
}

function toOffset(state: EditorState, pos: Pos) {
  return state.doc.line(pos.line + 1).from + pos.ch
}

// Like toOffset, but null when edits have removed that spot.
function findOffset(state: EditorState, pos: Pos) {
  if (pos.line >= state.doc.lines) return null
  const line = state.doc.line(pos.line + 1)
  return pos.ch < line.length ? line.from + pos.ch : null
}

type EditorProps = {
  task: Task
  onKeystroke: () => void
  onModeChange: (mode: string) => void
  // Keys typed so far for a command that hasn't run yet, e.g. "4d" or ":s/a".
  onPending: (keys: string) => void
  onSolved: () => void
  // Called when Enter is pressed after the task is solved.
  onNext: () => void
}

// A CodeMirror editor in Vim mode, loaded with one task's starting text.
// Remount it (change its `key`) to reset the task.
function TaskEditor({ task, onKeystroke, onModeChange, onPending, onSolved, onNext }: EditorProps) {
  const host = useRef<HTMLDivElement>(null)
  // Keep the latest callbacks without recreating the editor on every render.
  const callbacks = useRef({ onKeystroke, onModeChange, onPending, onSolved, onNext })
  useEffect(() => {
    callbacks.current = { onKeystroke, onModeChange, onPending, onSolved, onNext }
  })

  useEffect(() => {
    let solved = false

    const check = () => {
      const vimState = getCM(view)?.state.vim
      if (solved || !vimState || vimState.insertMode || vimState.visualMode) return
      const { text, cursor } = task.goal
      const state = view.state
      if (text !== undefined && state.doc.toString() !== text) return
      if (cursor && state.selection.main.head !== findOffset(state, cursor)) return
      solved = true
      callbacks.current.onSolved()
    }

    const start = EditorState.create({ doc: task.start })
    // Mark the character the cursor has to reach, wherever it is in the
    // current text.
    const goalCursor = task.goal.cursor
    const target =
      task.highlight && goalCursor
        ? [
            EditorView.decorations.of((view) => {
              const at = findOffset(view.state, goalCursor)
              return at === null
                ? Decoration.none
                : Decoration.set(Decoration.mark({ class: 'drill-target' }).range(at, at + 1))
            }),
          ]
        : []
    const view = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: task.start,
        selection: { anchor: toOffset(start, task.cursor) },
        extensions: [
          vim(),
          minimalSetup,
          lineNumbers(),
          target,
          // Vim updates its mode just after the edit, so check on the next tick.
          EditorView.updateListener.of((update) => {
            if (update.docChanged || update.selectionSet) setTimeout(check)
          }),
        ],
      }),
    })

    const cm = getCM(view)!

    // The : / ? prompt while it's open, else the Normal-mode keys Vim is
    // still waiting to complete.
    const showPending = () => {
      const vimState = cm.state.vim
      const dialog: HTMLElement | null | undefined = cm.state.dialog
      const input = dialog?.querySelector('input')
      // The prompt's own element holds just the ":" or "/" and the input.
      if (input) callbacks.current.onPending((input.parentElement?.textContent ?? '') + input.value)
      else if (!vimState || vimState.insertMode) callbacks.current.onPending('')
      else {
        // Vim forgets the keys once a register is picked, but remembers which.
        const keys: string = vimState.status ?? ''
        const register = vimState.inputState?.registerName
        callbacks.current.onPending(register && !keys.startsWith('"') ? `"${register}${keys}` : keys)
      }
    }
    cm.on('vim-mode-change', (e: { mode: string }) => {
      callbacks.current.onModeChange(e.mode)
      setTimeout(check)
      setTimeout(showPending)
    })
    cm.on('vim-command-done', () => setTimeout(showPending))
    cm.on('dialog', () => {
      // Closing the prompt ends the command, but Vim keeps its keys.
      if (!cm.state.dialog && cm.state.vim) cm.state.vim.status = ''
      setTimeout(showPending)
    })

    // Fill registers and replay the setup keys before the player starts.
    // Neither counts as keystrokes.
    if (task.registers) {
      const controller = Vim.getRegisterController()
      controller.unnamedRegister.setText('')
      for (const [name, line] of Object.entries(task.registers)) {
        controller.getRegister(name).setText(line + '\n', true)
      }
    }
    for (const key of splitKeys(task.setup ?? '')) Vim.handleKey(cm, key, 'user')

    const countKey = (e: KeyboardEvent) => {
      // Once solved, Enter moves on instead of reaching Vim.
      if (solved && e.key === 'Enter') {
        e.preventDefault()
        e.stopImmediatePropagation()
        callbacks.current.onNext()
        return
      }
      if (!MODIFIER_KEYS.has(e.key)) callbacks.current.onKeystroke()
      setTimeout(showPending)
    }
    // On the whole editor, so keys typed into the : and / prompts count too.
    view.dom.addEventListener('keydown', countKey, true)

    // Keep typing going to the editor: clicking anywhere else on the page
    // (tabs, buttons, empty space) hands focus straight back.
    const refocus = () => {
      if (view.dom.isConnected) view.focus()
    }
    document.addEventListener('click', refocus)
    view.focus()

    return () => {
      view.dom.removeEventListener('keydown', countKey, true)
      document.removeEventListener('click', refocus)
      view.destroy()
    }
  }, [task])

  return <div className="drill-editor" ref={host} />
}

const SET_LABELS: Record<CommandSet, string> = {
  beginner: 'Beginner',
  complete: 'Complete',
}


function StepKeys({ step }: { step: Step }) {
  return (
    <span className="drill-step" data-keys={step.keys} data-insert={step.insert}>
      <kbd>{visible(step.keys)}</kbd>
      {step.insert !== undefined && (
        <>
          <span className="drill-typed">{visible(step.insert)}</span>
          <kbd>{'<Esc>'}</kbd>
        </>
      )}
    </span>
  )
}

// The fastest known answer: the solver's, or the task's own when it's at
// least as short (it uses the command the task teaches).
function fastest(task: Task, set: CommandSet): Solution | null {
  // With a known answer to fall back on, don't search for long.
  const found = solve(task, set, task.solution ? 3_000 : undefined)
  if (task.solution && (!found || task.par <= found.cost)) {
    return { steps: task.solution, cost: task.par }
  }
  return found
}

type DrillProps = {
  // Which commands count when working out the fastest solution.
  commandSet: CommandSet
}

function Drill({ commandSet }: DrillProps) {
  // Beginner shows the vimtutor tasks; Complete adds the rest.
  const types = TASK_TYPES.filter((t) => commandSet === 'complete' || t.set === 'beginner')
  const [typeId, setTypeId] = useState(types[0].id)
  const [task, setTask] = useState(() => types[0].make())
  const [attempt, setAttempt] = useState(0)
  const [keystrokes, setKeystrokes] = useState(0)
  const [mode, setMode] = useState('normal')
  const [pending, setPending] = useState('')
  const [done, setDone] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [solved, setSolved] = useState(loadSolved)

  const solution = useMemo(() => fastest(task, commandSet), [task, commandSet])
  const par = solution?.cost ?? task.par

  const restart = () => {
    setAttempt((a) => a + 1)
    setKeystrokes(0)
    setMode('normal')
    setPending('')
    setDone(false)
    setRevealed(false)
  }

  // Every visit to a task type gets freshly generated text.
  const goTo = (t: TaskType) => {
    setTypeId(t.id)
    setTask(t.make())
    restart()
  }

  // Switching to Beginner hides the current task if it's Complete-only.
  let index = types.findIndex((t) => t.id === typeId)
  if (index < 0) {
    index = 0
    goTo(types[0])
  }
  const type = types[index]
  const next = types[(index + 1) % types.length]

  const handleSolved = () => {
    setDone(true)
    setSolved((prev) => {
      const next = new Set(prev).add(type.id)
      saveSolved(next)
      return next
    })
  }

  return (
    <div className="drill">
      <div className="drill-tasks" role="tablist" aria-label="Tasks">
        {types.map((t, i) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            title={t.title}
            className={[
              'drill-task-dot',
              i === index && 'active',
              solved.has(t.id) && 'solved',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => goTo(t)}
          >
            {solved.has(t.id) ? '✓' : i + 1}
          </button>
        ))}
      </div>

      <div className="drill-header">
        <h2>{type.title}</h2>
        <span className="drill-lesson">{type.source}</span>
      </div>
      <p className="drill-instructions">
        {/* Odd parts are the keystrokes written in brackets, e.g. "(dw)". */}
        {task.instructions.split(/\(([^)]+)\)/).map((part, i) =>
          i % 2 ? (
            <span key={i} className="drill-shortcut">
              ({part})
            </span>
          ) : (
            part
          ),
        )}
      </p>
      <div className="drill-keys">
        {type.keys.map((k) => (
          <kbd key={k}>{k}</kbd>
        ))}
      </div>

      <TaskEditor
        key={attempt}
        task={task}
        onKeystroke={() => setKeystrokes((n) => n + 1)}
        onModeChange={setMode}
        onPending={setPending}
        onSolved={handleSolved}
        onNext={() => goTo(next)}
      />

      <div className="drill-status">
        <span className={`drill-mode ${mode}`}>-- {mode.toUpperCase()} --</span>
        <span className="drill-pending" aria-live="polite" title="Keys typed for the current command">
          {pending}
        </span>
        <span>
          Keystrokes: {keystrokes} <span className="drill-par">(par {par})</span>
        </span>
        <span className="drill-actions">
          {done && (
            <span className="drill-done">
              {keystrokes <= par ? 'Perfect!' : 'Done!'}
            </span>
          )}
          <button
            type="button"
            className="keyboard-tab"
            title="Try this same text again"
            onClick={restart}
          >
            Reset
          </button>
          <button
            type="button"
            className="keyboard-tab"
            title="Same kind of task, new text"
            onClick={() => goTo(type)}
          >
            New
          </button>
          <button
            type="button"
            className={done ? 'keyboard-tab active' : 'keyboard-tab'}
            onClick={() => goTo(next)}
          >
            Next
          </button>
        </span>
      </div>

      {solution && (
        <div className="drill-solution">
          {done || revealed ? (
            <>
              <div className="drill-solution-header">
                <span>Fastest ({SET_LABELS[commandSet]} commands):</span>
                <span className="drill-par">
                  {solution.cost} {solution.cost === 1 ? 'key' : 'keys'}
                </span>
              </div>
              <ol className="drill-solution-steps">
                {solution.steps.map((step, i) => (
                  <li key={i}>
                    <StepKeys step={step} />
                    <span>{explainStep(step)}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <button
              type="button"
              className="keyboard-tab"
              onClick={() => setRevealed(true)}
            >
              Show fastest
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default Drill
