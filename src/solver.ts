// Finds the fewest keystrokes that solve a task, by searching over a small
// simulation of Vim's Normal mode.
//
// Simplifications (all keep answers correct for these tasks):
// - Insert mode is only entered as the final step, typing exactly the text the
//   goal needs and then <Esc>. Typing anything else can't be shorter.
// - Counts are 2-9, and only used where Vim moves exactly that many times.
// - Cursor-only tasks may move but not edit.
// - Not simulated: u, U, <C-r>, ., ; and ,, r, R, J, y and p, /, ?, n, N, %,
//   H, M, L, marks, registers, macros and text objects.
import type { Task } from './tasks.ts'

export type CommandSet = 'beginner' | 'complete'

// One command: keys typed in Normal mode, plus any text typed in Insert mode
// (always followed by <Esc>).
export type Step = { keys: string; insert?: string }

export type Solution = { steps: Step[]; cost: number }

type State = { text: string; line: number; ch: number; want: number }

type Doc = { text: string; lines: string[]; starts: number[] }

type MotionType = 'exclusive' | 'inclusive' | 'linewise'

type Target = {
  keys: string
  line: number
  ch: number
  type: MotionType
  want: number
  // Which motion, so operators can apply Vim's special cases.
  name: string
}

type Successor =
  | { step: Step; cost: number; state: State }
  | { step: Step; cost: number; done: true }

const MAX_NODES = 300_000

const docs = new Map<string, Doc>()
function getDoc(text: string): Doc {
  let doc = docs.get(text)
  if (!doc) {
    const lines = text.split('\n')
    const starts = [0]
    for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1)
    doc = { text, lines, starts }
    if (docs.size > 50_000) docs.clear()
    docs.set(text, doc)
  }
  return doc
}

const offsetOf = (doc: Doc, line: number, ch: number) => doc.starts[line] + ch

function posOf(doc: Doc, off: number) {
  let line = 0
  while (line + 1 < doc.starts.length && doc.starts[line + 1] <= off) line++
  return { line, ch: off - doc.starts[line] }
}

const lastCh = (s: string) => Math.max(0, s.length - 1)

function firstNonBlank(s: string) {
  const i = s.search(/\S/)
  return i < 0 ? lastCh(s) : i
}

// Vim's character classes: 0 blank, 1 punctuation, 2 word character.
// For WORD motions every non-blank is the same class.
function charClass(c: string | undefined, big: boolean) {
  if (c === undefined || c === ' ' || c === '\t' || c === '\n') return 0
  if (big || /\w/.test(c)) return 2
  return 1
}

// `w`: start of the next word, or text.length if there is none.
function wordForward(text: string, p: number, big: boolean) {
  const cls = charClass(text[p], big)
  if (cls !== 0) while (p < text.length && charClass(text[p], big) === cls) p++
  while (p < text.length && charClass(text[p], big) === 0) {
    // An empty line counts as a word.
    if (text[p] === '\n' && text[p + 1] === '\n') return p + 1
    p++
  }
  return p
}

// `e`: end of the current or next word, or null if there is none.
function wordEnd(text: string, p: number, big: boolean) {
  p++
  while (p < text.length && charClass(text[p], big) === 0) p++
  if (p >= text.length) return null
  const cls = charClass(text[p], big)
  while (p + 1 < text.length && charClass(text[p + 1], big) === cls) p++
  return p
}

// `b`: start of the current or previous word, or null if there is none.
function wordBack(text: string, p: number, big: boolean) {
  p--
  while (p >= 0 && charClass(text[p], big) === 0) p--
  if (p < 0) return null
  const cls = charClass(text[p], big)
  while (p > 0 && charClass(text[p - 1], big) === cls) p--
  return p
}

const countKeys = (n: number) => (n > 1 ? String(n) : '')

// Every motion available from `s`. With `forOperator`, targets can sit one
// past the end of a line (e.g. `dl` on the last character).
function motions(doc: Doc, s: State, set: CommandSet, forOperator: boolean): Target[] {
  const out: Target[] = []
  const line = doc.lines[s.line]
  const off = offsetOf(doc, s.line, s.ch)
  const complete = set === 'complete'
  const add = (
    keys: string,
    name: string,
    l: number,
    ch: number,
    type: MotionType,
    want = ch,
  ) => out.push({ keys, name, line: l, ch, type, want })
  const addOffset = (keys: string, name: string, o: number, type: MotionType) => {
    const p = posOf(doc, o)
    add(keys, name, p.line, p.ch, type)
  }

  for (let n = 1; n <= 9; n++) {
    if (s.ch - n >= 0) add(countKeys(n) + 'h', 'h', s.line, s.ch - n, 'exclusive')
    const limit = forOperator ? line.length : lastCh(line)
    if (s.ch + n <= limit) add(countKeys(n) + 'l', 'l', s.line, s.ch + n, 'exclusive')
    for (const [key, dir] of [['j', 1], ['k', -1]] as const) {
      const l = s.line + dir * n
      if (l < 0 || l >= doc.lines.length) continue
      add(countKeys(n) + key, key, l, Math.min(s.want, lastCh(doc.lines[l])), 'linewise', s.want)
    }
    if (complete) {
      for (const [key, dir] of [['+', 1], ['-', -1]] as const) {
        const l = s.line + dir * n
        if (l < 0 || l >= doc.lines.length) continue
        add(countKeys(n) + key, key, l, firstNonBlank(doc.lines[l]), 'linewise')
      }
    }
  }

  // Word motions, repeated for counts.
  for (const big of complete ? [false, true] : [false]) {
    const w = big ? 'W' : 'w'
    let p = off
    for (let n = 1; n <= 9; n++) {
      const q = wordForward(doc.text, p, big)
      if (q >= doc.text.length) {
        // No next word: an operator goes to the end; the cursor stops on the
        // last character.
        if (forOperator) addOffset(countKeys(n) + w, w, doc.text.length, 'exclusive')
        else if (p < doc.text.length - 1)
          addOffset(countKeys(n) + w, w, doc.text.length - 1, 'exclusive')
        break
      }
      p = q
      addOffset(countKeys(n) + w, w, p, 'exclusive')
    }

    const e = big ? 'E' : 'e'
    p = off
    for (let n = 1; n <= 9; n++) {
      const q = wordEnd(doc.text, p, big)
      if (q === null) break
      p = q
      addOffset(countKeys(n) + e, e, p, 'inclusive')
    }

    if (complete) {
      const b = big ? 'B' : 'b'
      p = off
      for (let n = 1; n <= 9; n++) {
        const q = wordBack(doc.text, p, big)
        if (q === null) break
        p = q
        addOffset(countKeys(n) + b, b, p, 'exclusive')
      }
    }
  }

  add('0', '0', s.line, 0, 'exclusive')
  if (complete) add('^', '^', s.line, firstNonBlank(line), 'exclusive')
  if (line.length > 0 || !forOperator) add('$', '$', s.line, lastCh(line), 'inclusive', Infinity)

  // Whole-file jumps land on the first non-blank character.
  const lastLine = doc.lines.length - 1
  add('G', 'G', lastLine, firstNonBlank(doc.lines[lastLine]), 'linewise')
  add('gg', 'gg', 0, firstNonBlank(doc.lines[0]), 'linewise')
  for (let n = 1; n <= Math.min(9, doc.lines.length); n++) {
    add(`${n}G`, 'G', n - 1, firstNonBlank(doc.lines[n - 1]), 'linewise')
  }

  // f, t, F, T for every character on the line.
  if (complete) {
    for (const c of new Set(line)) {
      const after: number[] = []
      const before: number[] = []
      for (let i = 0; i < line.length; i++) {
        if (line[i] !== c) continue
        if (i > s.ch) after.push(i)
        if (i < s.ch) before.unshift(i)
      }
      after.slice(0, 9).forEach((i, k) => {
        const count = countKeys(k + 1)
        add(`${count}f${c}`, 'f', s.line, i, 'inclusive')
        if (i - 1 > s.ch || (forOperator && i - 1 >= s.ch)) {
          add(`${count}t${c}`, 't', s.line, i - 1, 'inclusive')
        }
      })
      before.slice(0, 9).forEach((i, k) => {
        const count = countKeys(k + 1)
        add(`${count}F${c}`, 'F', s.line, i, 'exclusive')
        if (i + 1 < s.ch) add(`${count}T${c}`, 'T', s.line, i + 1, 'exclusive')
      })
    }
  }
  return out
}

type Range = { kind: 'char' | 'line'; from: number; to: number }

// The text an operator acts on: character offsets [from, to), or lines
// from..to inclusive. Returns null for cases this solver doesn't model.
function operatorRange(doc: Doc, s: State, t: Target): Range | null {
  if (t.type === 'linewise') {
    return { kind: 'line', from: Math.min(s.line, t.line), to: Math.max(s.line, t.line) }
  }
  const a = offsetOf(doc, s.line, s.ch)
  const b = offsetOf(doc, t.line, t.ch)
  let from = Math.min(a, b)
  let to = t.type === 'inclusive' ? Math.max(a, b) + 1 : Math.max(a, b)

  if (t.name === 'w' || t.name === 'W') {
    // Vim: when the last word moved over ends a line, the operator stops at
    // the end of that line instead of joining the next one.
    let k = to - 1
    let newline = -1
    while (k >= from && charClass(doc.text[k], false) === 0) {
      if (doc.text[k] === '\n') newline = k
      k--
    }
    if (newline >= 0 && k >= from) to = newline
    else if (newline >= 0) return null
  } else if (t.type === 'exclusive' && doc.text.slice(from, to).includes('\n')) {
    // Exclusive motions that end at the start of a line have extra rules.
    return null
  }
  return to > from ? { kind: 'char', from, to } : null
}

// Normal-mode state after deleting `range`.
function deleteRange(doc: Doc, range: Range): State {
  if (range.kind === 'line') {
    const lines = doc.lines.filter((_, i) => i < range.from || i > range.to)
    const kept = lines.length ? lines : ['']
    const line = Math.min(range.from, kept.length - 1)
    const ch = firstNonBlank(kept[line])
    return { text: kept.join('\n'), line, ch, want: ch }
  }
  const text = doc.text.slice(0, range.from) + doc.text.slice(range.to)
  const next = getDoc(text)
  const p = posOf(next, Math.min(range.from, Math.max(0, text.length)))
  const ch = Math.min(p.ch, lastCh(next.lines[p.line]))
  return { text, line: p.line, ch, want: ch }
}

// The text before and after the spot an Insert-mode command types into.
function changeContext(doc: Doc, range: Range) {
  if (range.kind === 'line') {
    const start = doc.starts[range.from]
    const end = doc.starts[range.to] + doc.lines[range.to].length
    return { pre: doc.text.slice(0, start), post: doc.text.slice(end) }
  }
  return { pre: doc.text.slice(0, range.from), post: doc.text.slice(range.to) }
}

function successors(s: State, set: CommandSet, task: Task): Successor[] {
  const doc = getDoc(s.text)
  const out: Successor[] = []
  const line = doc.lines[s.line]
  const off = offsetOf(doc, s.line, s.ch)
  const complete = set === 'complete'
  const singleLine = doc.lines.length === 1

  // Moves.
  for (const t of motions(doc, s, set, false)) {
    const ch = Math.min(t.ch, lastCh(doc.lines[t.line]))
    if (t.line === s.line && ch === s.ch && t.want === s.want) continue
    out.push({
      step: { keys: t.keys },
      cost: t.keys.length,
      state: { text: s.text, line: t.line, ch, want: singleLine ? ch : t.want },
    })
  }

  const goal = task.goal.text
  if (goal === undefined) return out

  const del = (keys: string, range: Range | null) => {
    if (range) out.push({ step: { keys }, cost: keys.length, state: deleteRange(doc, range) })
  }
  // Insert-mode commands finish the task: they're only worth trying when
  // the surrounding text already matches the goal.
  const insert = (keys: string, pre: string, post: string) => {
    if (goal.length < pre.length + post.length) return
    if (!goal.startsWith(pre) || !goal.endsWith(post)) return
    const typed = goal.slice(pre.length, goal.length - post.length)
    out.push({ step: { keys, insert: typed }, cost: keys.length + typed.length + 1, done: true })
  }

  // Operators with a motion: d{motion}, c{motion}.
  for (const t of motions(doc, s, set, true)) {
    const range = operatorRange(doc, s, t)
    del('d' + t.keys, range)

    // cw / cW act like ce / cE on a word; on a blank they're not modelled.
    if (t.name === 'w' || t.name === 'W') continue
    if (range) {
      const { pre, post } = changeContext(doc, range)
      insert('c' + t.keys, pre, post)
    }
  }
  if (charClass(line[s.ch], false) !== 0) {
    let p = off
    for (let n = 1; n <= 9; n++) {
      const q = wordEnd(doc.text, n === 1 ? p - 1 : p, false)
      if (q === null) break
      p = q
      insert(`c${countKeys(n)}w`, doc.text.slice(0, off), doc.text.slice(p + 1))
    }
  }

  // Doubled operators act on whole lines.
  for (let n = 1; n <= 9 && s.line + n - 1 < doc.lines.length; n++) {
    const range: Range = { kind: 'line', from: s.line, to: s.line + n - 1 }
    del(`${countKeys(n)}dd`, range)
    if (complete) {
      const { pre, post } = changeContext(doc, range)
      insert(`${countKeys(n)}cc`, pre, post)
    }
  }

  // x and X delete characters.
  for (let n = 1; n <= 9; n++) {
    if (s.ch + n <= line.length && line.length > 0) {
      del(`${countKeys(n)}x`, { kind: 'char', from: off, to: off + n })
    }
    if (complete && s.ch - n >= 0) {
      del(`${countKeys(n)}X`, { kind: 'char', from: off - n, to: off })
    }
  }

  const lineStart = doc.starts[s.line]
  const lineEnd = lineStart + line.length
  insert('i', doc.text.slice(0, off), doc.text.slice(off))
  const afterCursor = line.length ? off + 1 : off
  insert('a', doc.text.slice(0, afterCursor), doc.text.slice(afterCursor))
  insert('A', doc.text.slice(0, lineEnd), doc.text.slice(lineEnd))
  insert('o', doc.text.slice(0, lineEnd) + '\n', doc.text.slice(lineEnd))
  insert('O', doc.text.slice(0, lineStart), '\n' + doc.text.slice(lineStart))

  if (complete) {
    if (line.length) del('D', { kind: 'char', from: off, to: lineEnd })
    insert('C', doc.text.slice(0, off), doc.text.slice(lineEnd))
    const firstChar = lineStart + firstNonBlank(line)
    insert('I', doc.text.slice(0, firstChar), doc.text.slice(firstChar))
    insert('S', doc.text.slice(0, lineStart), doc.text.slice(lineEnd))
    for (let n = 1; n <= 9 && s.ch + n <= line.length; n++) {
      insert(`${countKeys(n)}s`, doc.text.slice(0, off), doc.text.slice(off + n))
    }
  }
  return out
}

// A lower bound on the keystrokes still needed, so the search can skip
// states that can't beat the best known answer.
function heuristic(s: State, task: Task): number {
  const { text: goal, cursor } = task.goal
  if (goal === undefined) return s.line === cursor!.line && s.ch === cursor!.ch ? 0 : 1
  const text = s.text
  if (text === goal) return 0

  // Characters kept from `text` must spell the goal, apart from one block
  // typed in Insert mode. Find the longest goal prefix + suffix that can be
  // kept; the rest has to be typed (plus a command key and <Esc>).
  const prefix = [0]
  for (let i = 0, k = 0; k < goal.length; k++) {
    while (i < text.length && text[i] !== goal[k]) i++
    if (i >= text.length) break
    prefix.push(++i)
  }
  const suffix = [text.length]
  for (let j = text.length - 1, m = 0; m < goal.length; m++) {
    while (j >= 0 && text[j] !== goal[goal.length - 1 - m]) j--
    if (j < 0) break
    suffix.push(j--)
  }
  let kept = 0
  for (let k = 0; k < prefix.length; k++) {
    for (let m = 0; m < suffix.length && k + m <= goal.length; m++) {
      if (prefix[k] <= suffix[m]) kept = Math.max(kept, k + m)
    }
  }
  return kept === goal.length ? 1 : 2 + goal.length - kept
}

const stateKey = (s: State) => `${s.line}:${s.ch}:${s.want}:${s.text}`

// Binary min-heap ordered by `f`.
class Heap<T extends { f: number }> {
  private items: T[] = []
  get size() {
    return this.items.length
  }
  push(item: T) {
    const a = this.items
    a.push(item)
    let i = a.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (a[parent].f <= a[i].f) break
      ;[a[parent], a[i]] = [a[i], a[parent]]
      i = parent
    }
  }
  pop() {
    const a = this.items
    const top = a[0]
    const last = a.pop()!
    if (a.length) {
      a[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let min = i
        if (l < a.length && a[l].f < a[min].f) min = l
        if (r < a.length && a[r].f < a[min].f) min = r
        if (min === i) break
        ;[a[min], a[i]] = [a[i], a[min]]
        i = min
      }
    }
    return top
  }
}

type Node = { state: State | null; g: number; parent: Node | null; step: Step | null }

// Fewest keystrokes to solve `task` using `set`'s commands. `task.par` is a
// known solution, so the search never looks past it. Returns null only if
// the search gives up.
export function solve(task: Task, set: CommandSet): Solution | null {
  const start: State = { text: task.start, line: task.cursor.line, ch: task.cursor.ch, want: task.cursor.ch }
  const best = new Map<string, number>([[stateKey(start), 0]])
  const heap = new Heap<{ f: number; node: Node }>()
  heap.push({ f: heuristic(start, task), node: { state: start, g: 0, parent: null, step: null } })

  let expanded = 0
  while (heap.size) {
    const { node } = heap.pop()
    if (!node.state) return reconstruct(node)
    if (heuristic(node.state, task) === 0) return reconstruct(node)
    if (node.g > (best.get(stateKey(node.state)) ?? Infinity)) continue
    if (++expanded > MAX_NODES) return null

    for (const next of successors(node.state, set, task)) {
      const g = node.g + next.cost
      if ('done' in next) {
        if (g <= task.par) heap.push({ f: g, node: { state: null, g, parent: node, step: next.step } })
        continue
      }
      const f = g + heuristic(next.state, task)
      if (f > task.par) continue
      const key = stateKey(next.state)
      if ((best.get(key) ?? Infinity) <= g) continue
      best.set(key, g)
      heap.push({ f, node: { state: next.state, g, parent: node, step: next.step } })
    }
  }
  return null
}

function reconstruct(node: Node): Solution {
  const steps: Step[] = []
  const cost = node.g
  for (let n: Node | null = node; n?.step; n = n.parent) steps.unshift(n.step)
  return { steps, cost }
}
