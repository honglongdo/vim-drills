export type Pos = { line: number; ch: number }

// One playable challenge.
export type Task = {
  instructions: string
  start: string
  cursor: Pos
  // The task is solved when every goal that is set matches, in Normal mode.
  goal: { text?: string; cursor?: Pos }
  // Fewest keystrokes needed (Shift on its own doesn't count).
  par: number
}

// A kind of challenge. `make` builds a fresh random Task each time.
export type TaskType = {
  id: string
  title: string
  // Which vimtutor lesson the task comes from.
  lesson: string
  // Keys to call out next to the instructions.
  keys: string[]
  make: () => Task
}

const SENTENCES = [
  'The cow jumped over the moon.',
  'A quick brown fox jumps over the lazy dog.',
  'She sells sea shells by the sea shore.',
  'The early bird catches the worm.',
  'Every cloud has a silver lining.',
  'Practice makes perfect so keep going.',
  'Vim is a modal text editor.',
  'The rain in Spain stays mainly in the plain.',
  'Never put off until tomorrow what you can do today.',
  'All that glitters is not gold.',
  'Actions speak louder than words.',
  'Fortune favours the bold.',
]

const COUPLETS = [
  ['Roses are red,', 'Violets are blue.'],
  ['Twinkle twinkle little star,', 'How I wonder what you are.'],
  ['Jack and Jill went up the hill', 'To fetch a pail of water.'],
  ['Hickory dickory dock,', 'The mouse ran up the clock.'],
  ['Humpty Dumpty sat on a wall,', 'Humpty Dumpty had a great fall.'],
]

const JUNK_LINES = [
  'Mud is fun,',
  'Bananas are ringing.',
  'This line does not belong here.',
  'Delete me please.',
  'Pineapples on parade.',
]

const random = (n: number) => Math.floor(Math.random() * n)
const pick = <T,>(items: T[]) => items[random(items.length)]
const words = (s: string) => s.split(' ')
const stripPeriod = (s: string) => s.replace(/\.$/, '')

// Index in `s` where word number `i` starts.
const wordStart = (s: string, i: number) =>
  words(s).slice(0, i).reduce((n, w) => n + w.length + 1, 0)

export const TASK_TYPES: TaskType[] = [
  {
    id: 'hjkl',
    title: 'Move the cursor',
    lesson: '1.1',
    keys: ['h', 'j', 'k', 'l'],
    make() {
      const rows = 4
      const cols = 7
      const from = { line: random(rows), ch: random(cols) }
      let to = from
      while (to.line === from.line && to.ch === from.ch) {
        to = { line: random(rows), ch: random(cols) }
      }
      const grid = Array.from({ length: rows }, (_, line) =>
        Array.from({ length: cols }, (_, ch) =>
          line === to.line && ch === to.ch ? 'X' : '.',
        ).join(''),
      ).join('\n')
      return {
        instructions:
          'Move the cursor onto the X. Move left (h), down (j), up (k) or right (l).',
        start: grid,
        cursor: from,
        goal: { cursor: to },
        par: Math.abs(to.line - from.line) + Math.abs(to.ch - from.ch),
      }
    },
  },
  {
    id: 'x',
    title: 'Delete characters',
    lesson: '1.3',
    keys: ['x', 'l'],
    make() {
      const sentence = pick(SENTENCES)
      const list = words(sentence)
      // A plain word (no punctuation) with at least 3 letters.
      const candidates = list
        .map((_, i) => i)
        .filter((i) => /^[a-z]{3,}$/i.test(list[i]))
      const index = pick(candidates)
      const word = list[index]

      // Double one or two letters, skipping ones already next to a twin.
      const doubles = word
        .split('')
        .map((_, i) => i)
        .filter((i) => word[i] !== word[i - 1] && word[i] !== word[i + 1])
        .sort(() => Math.random() - 0.5)
        .slice(0, 1 + random(2))
        .sort((a, b) => a - b)
      const typo = word
        .split('')
        .map((c, i) => (doubles.includes(i) ? c + c : c))
        .join('')

      // Move right with l and delete with x, left to right. Once the earlier
      // extras are gone, each doubled letter starts at its original index.
      let cursor = 0
      let par = 0
      doubles.forEach((d) => {
        par += d - cursor + 1
        cursor = d
      })

      const start = list.map((w, i) => (i === index ? typo : w)).join(' ')
      return {
        instructions: `Fix the spelling of "${typo}" by deleting the extra letters. Move right (l), then delete the character under the cursor (x).`,
        start,
        cursor: { line: 0, ch: wordStart(start, index) },
        goal: { text: sentence },
        par,
      }
    },
  },
  {
    id: 'i',
    title: 'Insert text',
    lesson: '1.4',
    keys: ['i', 'Esc'],
    make() {
      const sentence = pick(SENTENCES.filter((s) => words(s).length >= 4))
      const list = words(sentence)
      // Never the first or last word, so there's a word after the gap.
      const index = 1 + random(list.length - 2)
      const missing = list[index]
      const start = list.filter((_, i) => i !== index).join(' ')
      return {
        instructions: `Add the missing word "${missing}" before "${stripPeriod(list[index + 1])}". Enter Insert mode (i), type the word and a space, then go back to Normal mode (Esc).`,
        start,
        cursor: { line: 0, ch: wordStart(start, index) },
        goal: { text: sentence },
        par: 1 + missing.length + 1 + 1,
      }
    },
  },
  {
    id: 'A',
    title: 'Append to a line',
    lesson: '1.5',
    keys: ['A', 'Esc'],
    make() {
      const sentence = pick(SENTENCES)
      // Cut somewhere in the last two words, but not just after a space.
      const lastTwo = wordStart(sentence, Math.max(0, words(sentence).length - 2))
      const cuts = []
      for (let i = lastTwo + 1; i <= sentence.length - 3; i++) {
        if (sentence[i - 1] !== ' ') cuts.push(i)
      }
      const cut = pick(cuts)
      return {
        instructions: `Finish the sentence so it reads "${sentence}". Append at the end of the line (A), type the rest, then go back to Normal mode (Esc).`,
        start: sentence.slice(0, cut),
        cursor: { line: 0, ch: 0 },
        goal: { text: sentence },
        par: 1 + (sentence.length - cut) + 1,
      }
    },
  },
  {
    id: 'dw',
    title: 'Delete a word',
    lesson: '2.1',
    keys: ['d', 'w'],
    make() {
      const sentence = pick(SENTENCES)
      const list = words(sentence)
      // Not the last word: its period would count as a separate word.
      const index = random(list.length - 1)
      const start = [...list.slice(0, index + 1), ...list.slice(index)].join(' ')
      return {
        instructions: `Remove the repeated "${list[index]}". Delete from the cursor to the start of the next word (dw).`,
        start,
        cursor: { line: 0, ch: wordStart(start, index) },
        goal: { text: sentence },
        par: 2,
      }
    },
  },
  {
    id: 'd$',
    title: 'Delete to the end of a line',
    lesson: '2.2',
    keys: ['d', '$'],
    make() {
      const keep = pick(SENTENCES)
      const extra = pick(SENTENCES.filter((s) => s !== keep))
      return {
        instructions: `Delete the second sentence. Delete from the cursor to the end of the line (d$).`,
        start: `${keep} ${extra}`,
        cursor: { line: 0, ch: keep.length },
        goal: { text: keep },
        par: 2,
      }
    },
  },
  {
    id: 'dd',
    title: 'Delete a whole line',
    lesson: '2.6',
    keys: ['j', 'd', 'd'],
    make() {
      const lines = [...pick(COUPLETS)]
      const at = 1 + random(lines.length)
      const start = [...lines.slice(0, at), pick(JUNK_LINES), ...lines.slice(at)]
      return {
        instructions:
          "Delete the line that doesn't belong. Move down to it (j), then delete the whole line (dd).",
        start: start.join('\n'),
        cursor: { line: 0, ch: 0 },
        goal: { text: lines.join('\n') },
        par: at + 2,
      }
    },
  },
]
