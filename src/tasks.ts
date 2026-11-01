import { solve, stepCost, type CommandSet, type Step } from './solver.ts'

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
  // Vim keys run before the player starts, e.g. to make changes to undo or
  // to set a mark. They aren't counted.
  setup?: string
  // Registers filled before the player starts, each holding whole lines.
  registers?: Record<string, string>
  // A known answer, for tasks built around commands the solver doesn't
  // simulate. `par` is its cost.
  solution?: Step[]
}

// A kind of challenge. `make` builds a fresh random Task each time.
export type TaskType = {
  id: string
  title: string
  // Where the command is taught, e.g. "vimtutor 1.1" or ":help J".
  source: string
  // The smallest command set that has every command the task needs.
  set: CommandSet
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
  'Time flies like an arrow.',
  'Better late than never.',
  'Two heads are better than one.',
  'Look before you leap.',
  'Where there is smoke there is fire.',
  'The pen is mightier than the sword.',
  'Rome was not built in a day.',
  'An apple a day keeps the doctor away.',
]

const COUPLETS = [
  ['Roses are red,', 'Violets are blue.'],
  ['Twinkle twinkle little star,', 'How I wonder what you are.'],
  ['Jack and Jill went up the hill', 'To fetch a pail of water.'],
  ['Hickory dickory dock,', 'The mouse ran up the clock.'],
  ['Humpty Dumpty sat on a wall,', 'Humpty Dumpty had a great fall.'],
]

const SONGS = [
  ['Row row row your boat,', 'Gently down the stream.', 'Merrily merrily merrily,', 'Life is but a dream.'],
  ['Twinkle twinkle little star,', 'How I wonder what you are.', 'Up above the world so high,', 'Like a diamond in the sky.'],
  ['Baa baa black sheep,', 'Have you any wool?', 'Yes sir yes sir,', 'Three bags full.'],
]

const LISTS = [
  ['1. Open the file.', '2. Find the mistake.', '3. Fix the mistake.', '4. Save your work.', '5. Quit Vim.'],
  ['1. Boil the water.', '2. Add the pasta.', '3. Stir for a while.', '4. Drain the pot.', '5. Serve with cheese.'],
  ['1. Wake up.', '2. Make coffee.', '3. Read the news.', '4. Go for a run.', '5. Start work.'],
]

const JUNK_LINES = [
  'Mud is fun,',
  'Bananas are ringing.',
  'This line does not belong here.',
  'Delete me please.',
  'Pineapples on parade.',
]

const SNIPPETS = [
  [
    'function greet(name) {',
    '  const message = "Hello " + name',
    '  console.log(message)',
    '  return message',
    '}',
  ],
  [
    'function total(items) {',
    '  let sum = 0',
    '  for (const item of items) {',
    '    sum += item.price',
    '  }',
    '  return sum',
    '}',
  ],
  [
    'function area(width, height) {',
    '  const size = width * height',
    '  if (size < 0) {',
    '    return 0',
    '  }',
    '  return size',
    '}',
  ],
  ['let count = 0', 'while (count < 10) {', '  count += 1', '  print(count)', '}'],
]

// Text separated by spaces, with punctuation inside: one WORD each.
const TOKENS = [
  'e.g.',
  'foo-bar',
  'v1.2.3',
  'x=y+z',
  'me@mail.com',
  'a/b/c',
  "can't",
  'well-known',
  'state-of-the-art',
  '#tag',
  '$5.99',
  '50%',
  'snake_case',
  'end.',
]

const ASIDES = ['who was very brave', 'or so they say', 'believe it or not', 'just this once', 'in the old days']
const FILLERS = ['sort of', 'you know', 'kind of', 'more or less', 'as it were']
const NAMES = ['John Smith', 'Mary Jones', 'Ann Lee', 'Bob Brown', 'Emma Stone']
const PEOPLE = ['john', 'mary', 'alice', 'bob', 'emma']
const PLACES = ['paris', 'london', 'rome', 'tokyo', 'berlin']
const BULLETS = ['* apples', '* bread', '* milk', '* eggs', '* cheese', '* honey']
const LETTERS = 'bcdfghjkmnpqrstvwxz'

const random = (n: number) => Math.floor(Math.random() * n)
const pick = <T,>(items: T[]) => items[random(items.length)]
const shuffle = <T,>(items: T[]) =>
  items
    .map((item) => ({ item, key: Math.random() }))
    .sort((a, b) => a.key - b.key)
    .map(({ item }) => item)
const words = (s: string) => s.split(' ')
const stripPeriod = (s: string) => s.replace(/\.$/, '')
const count = (n: number) => (n > 1 ? String(n) : '')
const junk = (n: number) => Array.from({ length: n }, () => pick([...LETTERS])).join('')

// Indexes of words that are plain letters (ignoring a final period), at
// least `min` long.
const plainWords = (list: string[], min: number) =>
  list.map((_, i) => i).filter((i) => new RegExp(`^[a-z]{${min},}\\.?$`, 'i').test(list[i]))

// A random letter that isn't `c`.
const otherLetter = (c: string) => pick([...'abcdefghijklmnopqrstuvwxyz'].filter((l) => l !== c.toLowerCase()))

// Index in `s` where word number `i` starts.
const wordStart = (s: string, i: number) =>
  words(s).slice(0, i).reduce((n, w) => n + w.length + 1, 0)

// Keystrokes to move `n` places with h, j, k or l, using counts up to 9.
const moveCost = (n: number) => Math.floor(n / 9) * 2 + (n % 9 === 0 ? 0 : n % 9 === 1 ? 1 : 2)

// Keys to move from the start of a line to the start of word `i`.
const toWord = (i: number) => (i ? `${count(i)}w` : '')

// A task's answer, with par worked out from it. Empty keys are dropped.
const known = (...steps: Step[]) => {
  const solution = steps.filter((s) => s.keys)
  return { solution, par: solution.reduce((n, s) => n + stepCost(s), 0) }
}

// A text file built from the sentences, one per line.
const file = (lines: number) => shuffle(SENTENCES).slice(0, lines)

export const TASK_TYPES: TaskType[] = [
  {
    id: 'hjkl',
    title: 'Move the cursor',
    source: 'vimtutor 1.1',
    set: 'beginner',
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
    source: 'vimtutor 1.3',
    set: 'beginner',
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
    source: 'vimtutor 1.4',
    set: 'beginner',
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
    source: 'vimtutor 1.5',
    set: 'beginner',
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
    source: 'vimtutor 2.1',
    set: 'beginner',
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
    source: 'vimtutor 2.2',
    set: 'beginner',
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
    id: 'de',
    title: 'Delete to the end of a word',
    source: 'vimtutor 2.3',
    set: 'beginner',
    keys: ['d', 'e'],
    make() {
      const sentence = pick(SENTENCES)
      const list = words(sentence)
      const index = pick(plainWords(list, 3))
      const word = stripPeriod(list[index])
      const extra = junk(2 + random(3))
      const start = list
        .map((w, i) => (i === index ? word + extra + w.slice(word.length) : w))
        .join(' ')
      return {
        instructions: `Remove the junk "${extra}" from the end of "${word}${extra}". Move right to the first junk letter (l), then delete to the end of the word (de).`,
        start,
        cursor: { line: 0, ch: wordStart(start, index) },
        goal: { text: sentence },
        par: moveCost(word.length) + 2,
      }
    },
  },
  {
    id: 'count-motion',
    title: 'Move with a count',
    source: 'vimtutor 2.4',
    set: 'beginner',
    keys: ['2', 'w', 'e', '0'],
    make() {
      const sentence = pick(SENTENCES.filter((s) => words(s).length >= 5))
      const list = words(sentence)
      const n = 2 + random(Math.min(8, list.length - 2))
      const motion = pick(['w', 'e'])
      if (motion === 'w') {
        return {
          instructions: `Move to the start of "${stripPeriod(list[n])}" in one go. Type how many words to move, then the motion (${n}w).`,
          start: sentence,
          cursor: { line: 0, ch: 0 },
          goal: { cursor: { line: 0, ch: wordStart(sentence, n) } },
          par: 2,
        }
      }
      // From the start of word 0, e lands on the end of word 0.
      const word = stripPeriod(list[n - 1])
      return {
        instructions: `Move to the end of "${word}" in one go. Type how many word ends to move, then the motion (${n}e).`,
        start: sentence,
        cursor: { line: 0, ch: 0 },
        goal: { cursor: { line: 0, ch: wordStart(sentence, n - 1) + word.length - 1 } },
        par: 2,
      }
    },
  },
  {
    id: 'd-count',
    title: 'Delete several words',
    source: 'vimtutor 2.5',
    set: 'beginner',
    keys: ['d', '2', 'w'],
    make() {
      const sentence = pick(SENTENCES)
      const list = words(sentence)
      const index = random(list.length - 1)
      const n = 2 + random(2)
      const shouted = shuffle(['ABC', 'DE', 'FGHI', 'JK', 'LMN', 'OP', 'Q', 'RS', 'TUV']).slice(0, n)
      const start = [...list.slice(0, index), ...shouted, ...list.slice(index)].join(' ')
      return {
        instructions: `Delete the ${n} capitalised words in one go. Put a count in the middle of the command (d${n}w).`,
        start,
        cursor: { line: 0, ch: wordStart(start, index) },
        goal: { text: sentence },
        par: 3,
      }
    },
  },
  {
    id: 'dd',
    title: 'Delete a whole line',
    source: 'vimtutor 2.6',
    set: 'beginner',
    keys: ['j', 'd', 'd'],
    make() {
      const lines = [...pick(COUPLETS)]
      const n = 1 + random(2)
      // The editor's Vim can't delete several lines at the end of the file
      // cleanly (2dd leaves an empty line), so 2 junk lines go in between.
      const at = n === 1 ? 1 + random(lines.length) : 1 + random(lines.length - 1)
      const extra = shuffle(JUNK_LINES).slice(0, n)
      const start = [...lines.slice(0, at), ...extra, ...lines.slice(at)]
      return {
        instructions:
          n === 1
            ? "Delete the line that doesn't belong. Move down to it (j), then delete the whole line (dd)."
            : "Delete the 2 lines that don't belong. Move down to the first one (j), then delete both lines at once (2dd).",
        start: start.join('\n'),
        cursor: { line: 0, ch: 0 },
        goal: { text: lines.join('\n') },
        par: at + (n === 1 ? 2 : 3),
      }
    },
  },
  {
    id: 'u',
    title: 'Undo',
    source: 'vimtutor 2.7',
    set: 'beginner',
    keys: ['u'],
    make() {
      const lines = pick(COUPLETS)
      // Delete a word on each line, so there are two separate changes.
      const [a, b] = lines.map((l) => random(words(l).length - 1))
      return {
        instructions:
          'Two words were deleted by mistake. Undo the last change (u), then undo the one before it.',
        start: lines.join('\n'),
        cursor: { line: 0, ch: 0 },
        setup: `${toWord(a)}dwj0${toWord(b)}dw`,
        goal: { text: lines.join('\n') },
        ...known({ keys: 'u' }, { keys: 'u' }),
      }
    },
  },
  {
    id: 'redo',
    title: 'Redo',
    source: 'vimtutor 2.7',
    set: 'beginner',
    keys: ['Ctrl', 'r'],
    make() {
      const sentence = pick(SENTENCES)
      const list = words(sentence)
      const index = random(list.length - 1)
      const start = [...list.slice(0, index + 1), ...list.slice(index)].join(' ')
      return {
        instructions: `The repeated "${list[index]}" was deleted, then the fix was undone by mistake. Redo it (<C-r>).`,
        start,
        cursor: { line: 0, ch: wordStart(start, index) },
        setup: 'dwu',
        goal: { text: sentence },
        ...known({ keys: '<C-r>' }),
      }
    },
  },
  {
    id: 'p',
    title: 'Put a deleted line',
    source: 'vimtutor 3.1',
    set: 'beginner',
    keys: ['d', 'd', 'p'],
    make() {
      const lines = pick(LISTS)
      const i = random(lines.length - 1)
      const start = [...lines]
      ;[start[i], start[i + 1]] = [start[i + 1], start[i]]
      return {
        instructions: `Lines ${i + 1} and ${i + 2} are swapped. Move to line ${i + 1} (j), delete it (dd), then put it back below the next line (p).`,
        start: start.join('\n'),
        cursor: { line: 0, ch: 0 },
        goal: { text: lines.join('\n') },
        ...known({ keys: i ? `${count(i)}j` : '' }, { keys: 'dd' }, { keys: 'p' }),
      }
    },
  },
  {
    id: 'r',
    title: 'Replace characters',
    source: 'vimtutor 3.2',
    set: 'beginner',
    keys: ['r'],
    make() {
      const sentence = pick(SENTENCES)
      const n = 1 + random(3)
      // Letters at least 3 apart, so each typo stands alone.
      const spots: number[] = []
      for (const i of shuffle([...sentence].map((_, i) => i))) {
        if (!/[a-z]/i.test(sentence[i]) || spots.some((s) => Math.abs(s - i) < 3)) continue
        spots.push(i)
        if (spots.length === n) break
      }
      spots.sort((a, b) => a - b)
      const start = [...sentence].map((c, i) => (spots.includes(i) ? otherLetter(c) : c)).join('')
      // The solver doesn't simulate r, but it can find the fastest moves
      // from one typo to the next (left to right).
      const steps: Step[] = []
      let at = 0
      for (const spot of spots) {
        const move = solve(
          { instructions: '', start, cursor: { line: 0, ch: at }, goal: { cursor: { line: 0, ch: spot } }, par: moveCost(spot - at) },
          'beginner',
        )
        steps.push(...(move?.steps ?? []), { keys: 'r' + sentence[spot] })
        at = spot
      }
      return {
        instructions: `Fix the ${spots.length === 1 ? 'typo' : `${spots.length} typos`}. Move onto each wrong letter, then replace it: type r and the right letter (r).`,
        start,
        cursor: { line: 0, ch: 0 },
        goal: { text: sentence },
        ...known(...steps),
      }
    },
  },
  {
    id: 'ce',
    title: 'Change a word',
    source: 'vimtutor 3.3',
    set: 'beginner',
    keys: ['c', 'e', 'Esc'],
    make() {
      const sentence = pick(SENTENCES)
      const list = words(sentence)
      const index = pick(plainWords(list, 4))
      const word = stripPeriod(list[index])
      const keep = 1 + random(word.length - 3)
      const tail = [...word.slice(keep)].map(otherLetter).join('')
      const typo = word.slice(0, keep) + tail
      const start = list.map((w, i) => (i === index ? typo + w.slice(word.length) : w)).join(' ')
      return {
        instructions: `Fix "${typo}" so it reads "${word}". Change from the cursor to the end of the word (ce), type the right ending, then press Esc (Esc).`,
        start,
        cursor: { line: 0, ch: wordStart(start, index) + keep },
        goal: { text: sentence },
        par: 2 + tail.length + 1,
      }
    },
  },
  {
    id: 'c$',
    title: 'Change to the end of a line',
    source: 'vimtutor 3.4',
    set: 'beginner',
    keys: ['c', '$', 'Esc'],
    make() {
      const sentence = pick(SENTENCES.filter((s) => words(s).length >= 5))
      const list = words(sentence)
      const k = 2 + random(list.length - 3)
      const other = words(pick(SENTENCES.filter((s) => s !== sentence)))
      const wrong = other.slice(Math.min(k, other.length - 2)).join(' ')
      const keep = list.slice(0, k).join(' ')
      const right = list.slice(k).join(' ')
      return {
        instructions: `The end of this line is wrong: it should read "${right}". Change from the cursor to the end of the line (c$), type the right ending, then Esc.`,
        start: `${keep} ${wrong}`,
        cursor: { line: 0, ch: keep.length + 1 },
        goal: { text: sentence },
        par: 2 + right.length + 1,
      }
    },
  },
  {
    id: 'G',
    title: 'Jump around a file',
    source: 'vimtutor 4.1',
    set: 'beginner',
    keys: ['G', 'g', 'g'],
    make() {
      const lines = file(14 + random(6))
      const last = lines.length - 1
      const variant = pick(['G', 'gg', 'nG'])
      if (variant === 'G') {
        return {
          instructions: 'Jump to the last line of the file (G).',
          start: lines.join('\n'),
          cursor: { line: 0, ch: random(lines[0].length) },
          goal: { cursor: { line: last, ch: 0 } },
          par: 1,
        }
      }
      if (variant === 'gg') {
        return {
          instructions: 'Jump to the first line of the file (gg).',
          start: lines.join('\n'),
          cursor: { line: last, ch: random(lines[last].length) },
          goal: { cursor: { line: 0, ch: 0 } },
          par: 2,
        }
      }
      const from = random(5)
      const to = 9 + random(lines.length - 9)
      return {
        instructions: `Jump to line ${to + 1}. Type the line number, then G (${to + 1}G).`,
        start: lines.join('\n'),
        cursor: { line: from, ch: 0 },
        goal: { cursor: { line: to, ch: 0 } },
        par: String(to + 1).length + 1,
      }
    },
  },
  {
    id: 'search',
    title: 'Search',
    source: 'vimtutor 4.2',
    set: 'beginner',
    keys: ['/', '?', 'n', 'N'],
    make() {
      for (;;) {
        const lines = file(12 + random(5))
        const text = lines.join('\n')
        const forward = Math.random() < 0.5
        const from = forward ? 0 : lines.length - 1
        const line = forward ? 3 + random(lines.length - 3) : random(lines.length - 3)
        const list = words(lines[line])
        const candidates = plainWords(list, 4).filter((i) => i > 0)
        if (!candidates.length) continue
        const index = pick(candidates)
        const word = stripPeriod(list[index])
        const target = lines.slice(0, line).join('\n').length + (line ? 1 : 0) + wordStart(lines[line], index)
        const cursor = lines.slice(0, from).join('\n').length + (from ? 1 : 0)

        // The cheapest search: some prefix of the word, then n until it
        // reaches the right match. Searches wrap around the file.
        let best: { pattern: string; skips: number; cost: number } | null = null
        for (let len = 1; len <= word.length; len++) {
          const pattern = word.slice(0, len)
          const matches: number[] = []
          for (let i = text.indexOf(pattern); i >= 0; i = text.indexOf(pattern, i + 1)) matches.push(i)
          const order = forward
            ? [...matches.filter((m) => m > cursor), ...matches.filter((m) => m <= cursor)]
            : [...matches.filter((m) => m < cursor).reverse(), ...matches.filter((m) => m >= cursor).reverse()]
          const skips = order.indexOf(target)
          const cost = len + 2 + (skips === 0 ? 0 : count(skips).length + 1)
          if (!best || cost < best.cost) best = { pattern, skips, cost }
        }
        const { pattern, skips } = best!
        const key = forward ? '/' : '?'
        return {
          instructions: `Find "${word}" on line ${line + 1}. Search ${forward ? 'forward' : 'backward'} (${key}), type enough of the word to reach it, then press Enter. If it stops at an earlier match, jump to the next one (n).`,
          start: text,
          cursor: { line: from, ch: 0 },
          goal: { cursor: { line, ch: wordStart(lines[line], index) } },
          ...known(
            { keys: `${key}${pattern}<CR>` },
            { keys: skips ? `${count(skips)}n` : '' },
          ),
        }
      }
    },
  },
  {
    id: '%',
    title: 'Matching brackets',
    source: 'vimtutor 4.3',
    set: 'beginner',
    keys: ['%', 'd', 'x'],
    make() {
      const sentence = pick(SENTENCES.filter((s) => words(s).length >= 4))
      const list = words(sentence)
      const i = 1 + random(list.length - 2)
      const start = `${list.slice(0, i).join(' ')} (${pick(ASIDES)}) ${list.slice(i).join(' ')}`
      return {
        instructions:
          'Delete the part in brackets. Jump to the matching bracket (%), delete back to its partner (d%), then remove the extra space (x).',
        start,
        cursor: { line: 0, ch: 0 },
        goal: { text: sentence },
        ...known({ keys: '%' }, { keys: 'd%' }, { keys: 'x' }),
      }
    },
  },
  {
    id: 's',
    title: 'Substitute',
    source: 'vimtutor 4.4',
    set: 'beginner',
    keys: [':', 's', '/', 'g'],
    make() {
      for (;;) {
        const lines = file(5 + random(2))
        const typos = lines.join(' ').match(/\bthe\b/g)?.length ?? 0
        if (typos < 4) continue
        const twice = lines.some((l) => (l.match(/\bthe\b/g)?.length ?? 0) > 1)
        const command = `:%s/teh/the${twice ? '/g' : ''}`
        return {
          instructions: `Every "the" is misspelled "teh". Fix them all with one substitute command over the whole file (${command}), then press Enter.`,
          start: lines.map((l) => l.replace(/\bthe\b/g, 'teh')).join('\n'),
          cursor: { line: 0, ch: 0 },
          goal: { text: lines.join('\n') },
          ...known({ keys: `${command}<CR>` }),
        }
      }
    },
  },
  {
    id: 'v',
    title: 'Visual mode',
    source: 'vimtutor 5.3',
    set: 'beginner',
    keys: ['v', 'e', 'l', 'd'],
    make() {
      const sentence = pick(SENTENCES)
      const list = words(sentence)
      const i = 1 + random(list.length - 1)
      const filler = pick(FILLERS)
      const start = [...list.slice(0, i), filler, ...list.slice(i)].join(' ')
      const n = words(filler).length
      return {
        instructions: `Delete the filler "${filler}". Start Visual mode (v), stretch the selection to the end of the filler (${n}e), take in the space after it (l), then delete the selection (d).`,
        start,
        cursor: { line: 0, ch: wordStart(start, i) },
        goal: { text: sentence },
        par: 1 + 2 + 1 + 1,
      }
    },
  },
  {
    id: 'o',
    title: 'Open a line',
    source: 'vimtutor 6.1',
    set: 'beginner',
    keys: ['o', 'O', 'Esc'],
    make() {
      const lines = pick(LISTS)
      const m = random(lines.length)
      const start = lines.filter((_, i) => i !== m)
      // The last line can only go below the line before it.
      const below = m === lines.length - 1 || (m > 0 && Math.random() < 0.5)
      return {
        instructions: below
          ? `Line ${m + 1} is missing. Open a new line below the cursor (o), type "${lines[m]}", then Esc.`
          : `Line ${m + 1} is missing. Open a new line above the cursor (O), type "${lines[m]}", then Esc.`,
        start: start.join('\n'),
        cursor: { line: below ? m - 1 : m, ch: 0 },
        goal: { text: lines.join('\n') },
        par: 1 + lines[m].length + 1,
      }
    },
  },
  {
    id: 'a',
    title: 'Append after the cursor',
    source: 'vimtutor 6.2',
    set: 'beginner',
    keys: ['a', 'Esc'],
    make() {
      const sentence = pick(SENTENCES)
      const list = words(sentence)
      const index = pick(plainWords(list, 5))
      const word = stripPeriod(list[index])
      const cut = 2 + random(Math.min(3, word.length - 3))
      const partial = word.slice(0, word.length - cut)
      const start = list.map((w, i) => (i === index ? partial + w.slice(word.length) : w)).join(' ')
      return {
        instructions: `Finish "${partial}" so it reads "${word}". Append after the cursor (a), type the missing letters, then Esc.`,
        start,
        cursor: { line: 0, ch: wordStart(start, index) + partial.length - 1 },
        goal: { text: sentence },
        par: 1 + cut + 1,
      }
    },
  },
  {
    id: 'R',
    title: 'Replace mode',
    source: 'vimtutor 6.3',
    set: 'beginner',
    keys: ['R', 'Esc'],
    make() {
      const template = pick([
        'The code is {n}.',
        'Call me on {n} tonight.',
        'Room {n} is on the left.',
        'The safe opens with {n}.',
      ])
      const digits = 4 + random(2)
      const old = Array.from({ length: digits }, () => String(random(10))).join('')
      const next = [...old].map((d) => String((Number(d) + 1 + random(9)) % 10)).join('')
      return {
        instructions: `Change ${old} to ${next}. Enter Replace mode (R), type over the old digits, then Esc.`,
        start: template.replace('{n}', old),
        cursor: { line: 0, ch: template.indexOf('{n}') },
        goal: { text: template.replace('{n}', next) },
        ...known({ keys: 'R', insert: next }),
      }
    },
  },
  {
    id: 'y',
    title: 'Copy and paste',
    source: 'vimtutor 6.4',
    set: 'beginner',
    keys: ['y', 'p', 'P'],
    make() {
      const lines = pick(SONGS)
      const i = random(lines.length)
      const above = Math.random() < 0.5
      const goal = [...lines.slice(0, i + 1), lines[i], ...lines.slice(i + 1)]
      return {
        instructions: `Line ${i + 1} should be sung twice. Move to it (j), copy the whole line (yy), then put the copy ${above ? 'above it (P)' : 'below it (p)'}.`,
        start: lines.join('\n'),
        cursor: { line: 0, ch: 0 },
        goal: { text: goal.join('\n') },
        ...known({ keys: i ? `${count(i)}j` : '' }, { keys: 'yy' }, { keys: above ? 'P' : 'p' }),
      }
    },
  },

  // Beyond vimtutor: the rest of the Complete command set.
  {
    id: 'W',
    title: 'Move by WORDs',
    source: ':help W',
    set: 'complete',
    keys: ['W', 'B', 'E'],
    make() {
      const tokens = shuffle(TOKENS).slice(0, 8)
      const line = tokens.join(' ')
      const n = 2 + random(6)
      if (Math.random() < 0.5) {
        return {
          instructions: `Jump to the start of "${tokens[n]}". A WORD is anything between spaces, punctuation and all, so count WORDs (${n}W).`,
          start: line,
          cursor: { line: 0, ch: 0 },
          goal: { cursor: { line: 0, ch: wordStart(line, n) } },
          par: 2,
        }
      }
      const target = tokens.length - 1 - n
      return {
        instructions: `Jump back to the start of "${tokens[target]}". A WORD is anything between spaces, punctuation and all, so count WORDs (${n}B).`,
        start: line,
        cursor: { line: 0, ch: wordStart(line, tokens.length - 1) },
        goal: { cursor: { line: 0, ch: wordStart(line, target) } },
        par: 2,
      }
    },
  },
  {
    id: 'f',
    title: 'Find a character',
    source: ':help f',
    set: 'complete',
    keys: ['f', 't', 'F', 'T', ';', ','],
    make() {
      for (;;) {
        const line = shuffle(SENTENCES).slice(0, 2).join(' ')
        const backward = Math.random() < 0.5
        const from = backward ? line.length - 1 : 0
        const spot = backward ? random(line.length - 12) : 12 + random(line.length - 13)
        const c = line[spot]
        if (!/[a-z]/.test(c)) continue
        // Matches of c between the cursor and the spot, nearest first.
        const between = [...line]
          .map((ch, i) => (ch === c ? i : -1))
          .filter((i) => i >= 0 && (backward ? i < from && i >= spot : i > from && i <= spot))
        const nth = backward ? between.length - between.indexOf(spot) : between.indexOf(spot) + 1
        if (nth > 2) continue
        const word = line.slice(line.lastIndexOf(' ', spot) + 1).split(' ')[0]
        const where = `the "${c}" in "${stripPeriod(word)}"`
        const find = backward ? 'F' : 'f'
        if (nth === 2) {
          return {
            instructions: `Jump onto the second ${c} ${backward ? 'behind' : 'ahead of'} the cursor, ${where}. Find the first one (${find}${c}), then repeat the find (;).`,
            start: line,
            cursor: { line: 0, ch: from },
            goal: { cursor: { line: 0, ch: spot } },
            ...known({ keys: find + c }, { keys: ';' }),
          }
        }
        const till = Math.random() < 0.5 && Math.abs(spot - from) > 2
        if (till) {
          const key = backward ? 'T' : 't'
          return {
            instructions: `Jump to just ${backward ? 'after' : 'before'} ${where} (${key}${c}).`,
            start: line,
            cursor: { line: 0, ch: from },
            goal: { cursor: { line: 0, ch: backward ? spot + 1 : spot - 1 } },
            par: 2,
          }
        }
        return {
          instructions: `Jump onto ${where} (${find}${c}).`,
          start: line,
          cursor: { line: 0, ch: from },
          goal: { cursor: { line: 0, ch: spot } },
          par: 2,
        }
      }
    },
  },
  {
    id: 'ct',
    title: 'Change up to a character',
    source: ':help t',
    set: 'complete',
    keys: ['c', 't', 'd'],
    make() {
      const template = pick(['Dear {}, thank you for the letter.', 'Hello {}, welcome back.', 'Note to {}: please call home.'])
      const sep = template.includes('{},') ? ',' : ':'
      const [old, name] = shuffle(NAMES)
      if (Math.random() < 0.5) {
        return {
          instructions: `Delete the name, but keep the "${sep}". Delete up to it (dt${sep}).`,
          start: template.replace('{}', old),
          cursor: { line: 0, ch: template.indexOf('{}') - 1 },
          goal: { text: template.replace(' {}', '') },
          par: 3,
        }
      }
      return {
        instructions: `Change "${old}" to "${name}". Change up to the "${sep}" (ct${sep}), type the new name, then Esc.`,
        start: template.replace('{}', old),
        cursor: { line: 0, ch: template.indexOf('{}') },
        goal: { text: template.replace('{}', name) },
        par: 3 + name.length + 1,
      }
    },
  },
  {
    id: 'I',
    title: 'Insert at the line start',
    source: ':help I',
    set: 'complete',
    keys: ['I', '^', 'Esc'],
    make() {
      const starts = (lines: string[]) =>
        lines.map((_, i) => i).filter((i) => /^\s+(return|const|let) \S/.test(lines[i]))
      const lines = pick(SNIPPETS.filter((l) => starts(l).length))
      const candidates = starts(lines)
      const i = pick(candidates)
      const keyword = lines[i].trim().split(' ')[0] + ' '
      const start = [...lines]
      start[i] = lines[i].replace(keyword, '')
      const indent = start[i].search(/\S/)
      return {
        instructions: `This line lost its "${keyword.trim()}". Insert at the first non-blank character of the line (I), type it and a space, then Esc. On its own, the same spot is one jump away (^).`,
        start: start.join('\n'),
        cursor: { line: i, ch: indent + 1 + random(start[i].length - indent - 1) },
        goal: { text: lines.join('\n') },
        par: 1 + keyword.length + 1,
      }
    },
  },
  {
    id: 'D',
    title: 'Cut a line short',
    source: ':help D',
    set: 'complete',
    keys: ['D', 'C'],
    make() {
      const keep = pick(SENTENCES)
      if (Math.random() < 0.5) {
        const extra = pick(SENTENCES.filter((s) => s !== keep))
        return {
          instructions: 'Delete the second sentence, from the cursor to the end of the line (D).',
          start: `${keep} ${extra}`,
          cursor: { line: 0, ch: keep.length },
          goal: { text: keep },
          par: 1,
        }
      }
      const list = words(keep)
      const k = 2 + random(list.length - 2)
      const right = list.slice(k).join(' ')
      const wrong = words(pick(SENTENCES.filter((s) => s !== keep))).slice(-2).join(' ')
      const start = `${list.slice(0, k).join(' ')} ${wrong}`
      return {
        instructions: `The end of this line should read "${right}". Change from the cursor to the end of the line (C), type it, then Esc.`,
        start,
        cursor: { line: 0, ch: wordStart(start, k) },
        goal: { text: keep },
        par: 1 + right.length + 1,
      }
    },
  },
  {
    id: 'S',
    title: 'Substitute characters and lines',
    source: ':help s',
    set: 'complete',
    keys: ['s', 'S', 'Esc'],
    make() {
      if (Math.random() < 0.5) {
        const [wrong, right] = pick([
          ['but', 'boat'],
          ['sit', 'seat'],
          ['hot', 'heat'],
          ['bid', 'bead'],
          ['cut', 'coat'],
        ])
        const template = pick(['We saw the {} by the lake.', 'I found a {} in the box.', 'Look at that {} over there.'])
        const start = template.replace('{}', wrong)
        return {
          instructions: `"${wrong}" should be "${right}". Move onto the "${wrong[1]}" (l), substitute it (s), type "${right.slice(1, 3)}", then Esc.`,
          start,
          cursor: { line: 0, ch: start.indexOf(wrong) },
          goal: { text: template.replace('{}', right) },
          par: 1 + 1 + 2 + 1,
        }
      }
      const lines = pick(LISTS)
      const i = random(lines.length)
      const start = [...lines]
      start[i] = pick(JUNK_LINES)
      return {
        instructions: `Line ${i + 1} should read "${lines[i]}". Substitute the whole line (S), type it, then Esc.`,
        start: start.join('\n'),
        cursor: { line: i, ch: random(start[i].length) },
        goal: { text: lines.join('\n') },
        par: 1 + lines[i].length + 1,
      }
    },
  },
  {
    id: 'X',
    title: 'Delete before the cursor',
    source: ':help X',
    set: 'complete',
    keys: ['X'],
    make() {
      const sentence = pick(SENTENCES)
      const n = 1 + random(3)
      const start = stripPeriod(sentence) + junk(n) + '.'
      return {
        instructions: `Delete the junk before the period. Delete the ${n === 1 ? 'character' : `${n} characters`} before the cursor (${count(n)}X).`,
        start,
        cursor: { line: 0, ch: start.length - 1 },
        goal: { text: sentence },
        par: n === 1 ? 1 : 2,
      }
    },
  },
  {
    id: 'J',
    title: 'Join lines',
    source: ':help J',
    set: 'complete',
    keys: ['J'],
    make() {
      const sentence = pick(SENTENCES.filter((s) => words(s).length >= 6))
      const list = words(sentence)
      const n = 2 + random(2)
      // Break the sentence into n chunks of at least one word.
      const cuts = shuffle(list.slice(1).map((_, i) => i + 1))
        .slice(0, n - 1)
        .sort((a, b) => a - b)
      const chunks = [0, ...cuts].map((c, i) => list.slice(c, [...cuts, list.length][i]).join(' '))
      return {
        instructions:
          n === 2
            ? 'Put the sentence back on one line. Join the line below onto this one (J).'
            : 'Put the sentence back on one line. Join all 3 lines at once with a count (3J).',
        start: chunks.join('\n'),
        cursor: { line: 0, ch: 0 },
        goal: { text: sentence },
        ...known({ keys: `${count(n === 2 ? 1 : n)}J` }),
      }
    },
  },
  {
    id: '~',
    title: 'Change case',
    source: ':help ~',
    set: 'complete',
    keys: ['~', 'g', 'U'],
    make() {
      if (Math.random() < 0.5) {
        const [a, b] = shuffle(PEOPLE)
        const template = pick(['{a} and {b} flew to {c} today.', '{a} met {b} in {c} last week.', '{a} sent {b} a card from {c}.'])
        const start = template.replace('{a}', a).replace('{b}', b).replace('{c}', pick(PLACES))
        const list = words(start)
        const names = list
          .map((w, i) => (PEOPLE.includes(stripPeriod(w)) || PLACES.includes(stripPeriod(w)) ? i : -1))
          .filter((i) => i >= 0)
        const goal = list.map((w, i) => (names.includes(i) ? w[0].toUpperCase() + w.slice(1) : w)).join(' ')
        // ~ moves one to the right, so w from there reaches the next word.
        let at = 0
        const steps: Step[] = []
        for (const i of names) {
          steps.push({ keys: toWord(i - at) }, { keys: '~' })
          at = i
        }
        return {
          instructions: 'Capitalise the names. Switch the case of the letter under the cursor (~), which also steps right, and jump between words (w).',
          start,
          cursor: { line: 0, ch: 0 },
          goal: { text: goal },
          ...known(...steps),
        }
      }
      const sentence = pick(SENTENCES)
      const list = words(sentence)
      const index = pick(plainWords(list, 4).filter((i) => i > 0))
      const word = stripPeriod(list[index])
      return {
        instructions: `Make "${word}" shout in capitals. Move to it (w), then make it uppercase with gU and a motion (gUw).`,
        start: sentence,
        cursor: { line: 0, ch: 0 },
        goal: { text: list.map((w, i) => (i === index ? w.toUpperCase() : w)).join(' ') },
        ...known({ keys: toWord(index) }, { keys: 'gUw' }),
      }
    },
  },
  {
    id: '>',
    title: 'Indent lines',
    source: ':help >>',
    set: 'complete',
    keys: ['>', '<'],
    make() {
      const lines = pick(SNIPPETS)
      // A run of 2 or 3 indented lines.
      const starts = lines
        .map((_, i) => i)
        .filter((i) => /^ {2}/.test(lines[i]) && /^ {2}/.test(lines[i + 1] ?? ''))
      const from = pick(starts)
      let n = 2
      if (Math.random() < 0.5 && /^ {2}/.test(lines[from + 2] ?? '')) n = 3
      const indent = Math.random() < 0.5
      const start = lines.map((l, i) =>
        i >= from && i < from + n ? (indent ? l.slice(2) : '  ' + l) : l,
      )
      return {
        instructions: indent
          ? `Lines ${from + 1} to ${from + n} lost their indent. Move to line ${from + 1} (j), then indent ${n} lines at once (${n}>>).`
          : `Lines ${from + 1} to ${from + n} are indented too far. Move to line ${from + 1} (j), then unindent ${n} lines at once (${n}<<).`,
        start: start.join('\n'),
        cursor: { line: 0, ch: 0 },
        goal: { text: lines.join('\n') },
        ...known({ keys: `${count(from)}j` }, { keys: `${n}${indent ? '>>' : '<<'}` }),
      }
    },
  },
  {
    id: '.',
    title: 'Repeat a change',
    source: ':help .',
    set: 'complete',
    keys: ['.'],
    make() {
      const items = shuffle(BULLETS).slice(0, 3 + random(3))
      return {
        instructions:
          'Remove the bullets. Delete the first one (dw), then on each line below, move down (j) and repeat the change (.).',
        start: items.join('\n'),
        cursor: { line: 0, ch: 0 },
        goal: { text: items.map((i) => i.slice(2)).join('\n') },
        ...known({ keys: 'dw' }, ...items.slice(1).flatMap(() => [{ keys: 'j' }, { keys: '.' }])),
      }
    },
  },
  {
    id: '*',
    title: 'Search for the word under the cursor',
    source: ':help *',
    set: 'complete',
    keys: ['*', '#'],
    make() {
      const lines = pick(SNIPPETS)
      const text = lines.join('\n')
      const found = new Map<string, number[]>()
      for (const m of text.matchAll(/[A-Za-z]\w{2,}/g)) {
        found.set(m[0], [...(found.get(m[0]) ?? []), m.index])
      }
      const [word, spots] = pick([...found].filter(([, s]) => s.length >= 2))
      const i = random(spots.length - 1)
      const pos = (o: number) => {
        const before = text.slice(0, o).split('\n')
        return { line: before.length - 1, ch: before[before.length - 1].length }
      }
      const forward = Math.random() < 0.5
      return {
        instructions: forward
          ? `Jump to the next "${word}". Search forward for the word under the cursor (*).`
          : `Jump to the previous "${word}". Search backward for the word under the cursor (#).`,
        start: text,
        cursor: pos(forward ? spots[i] : spots[i + 1]),
        goal: { cursor: pos(forward ? spots[i + 1] : spots[i]) },
        ...known({ keys: forward ? '*' : '#' }),
      }
    },
  },
  {
    id: '}',
    title: 'Jump by paragraphs',
    source: ':help }',
    set: 'complete',
    keys: ['}', '{'],
    make() {
      const pool = shuffle(SENTENCES)
      const paragraphs = Array.from({ length: 4 }, (_, i) => pool.slice(i * 4, i * 4 + 2 + random(3)))
      const lines = paragraphs.flatMap((p, i) => (i ? ['', ...p] : p))
      // The blank line after each paragraph but the last.
      const blanks = lines.map((l, i) => (l === '' ? i : -1)).filter((i) => i >= 0)
      const k = 2 + random(2)
      if (Math.random() < 0.5) {
        return {
          instructions: `Jump to the blank line after paragraph ${k}. Move forward ${k} paragraphs (${k}}).`,
          start: lines.join('\n'),
          cursor: { line: 0, ch: 0 },
          goal: { cursor: { line: blanks[k - 1], ch: 0 } },
          ...known({ keys: `${k}}` }),
        }
      }
      return {
        instructions: `Jump to the blank line before paragraph ${5 - k}. Move back ${k} paragraphs (${k}{).`,
        start: lines.join('\n'),
        cursor: { line: lines.length - 1, ch: 0 },
        goal: { cursor: { line: blanks[blanks.length - k], ch: 0 } },
        ...known({ keys: `${k}{` }),
      }
    },
  },
  {
    id: 'm',
    title: 'Marks',
    source: ':help m',
    set: 'complete',
    keys: ['m', '`', "'"],
    make() {
      const lines = file(12 + random(5))
      const line = 2 + random(lines.length - 4)
      const list = words(lines[line])
      const index = pick(plainWords(list, 3))
      const ch = wordStart(lines[line], index) + 1
      const exact = Math.random() < 0.5
      return {
        instructions: exact
          ? 'Earlier you set mark a somewhere in this file (ma). Jump straight back to it (`a).'
          : "Earlier you set mark a somewhere in this file (ma). Jump to the start of its line ('a).",
        start: lines.join('\n'),
        cursor: { line: 0, ch: 0 },
        setup: `${line + 1}G${ch}lmagg`,
        goal: { cursor: { line, ch: exact ? ch : 0 } },
        ...known({ keys: exact ? '`a' : "'a" }),
      }
    },
  },
  {
    id: '"',
    title: 'Registers',
    source: ':help "',
    set: 'complete',
    keys: ['"', 'a', 'p', 'P'],
    make() {
      const lines = pick(LISTS)
      const m = random(lines.length)
      const start = lines.filter((_, i) => i !== m)
      return {
        instructions: m
          ? `Line ${m + 1} is missing, but it's saved in register a. Move to line ${m} (j), pick register a ("a), then put it below (p).`
          : `Line 1 is missing, but it's saved in register a. Pick register a ("a), then put it above the cursor (P).`,
        start: start.join('\n'),
        cursor: { line: 0, ch: 0 },
        registers: { a: lines[m] },
        goal: { text: lines.join('\n') },
        ...known({ keys: m > 1 ? `${count(m - 1)}j` : '' }, { keys: m ? '"ap' : '"aP' }),
      }
    },
  },
  {
    id: 'q',
    title: 'Macros',
    source: ':help q',
    set: 'complete',
    keys: ['q', '@'],
    make() {
      const n = 6 + random(3)
      const lines = shuffle([...'abcdefghxyz']).slice(0, n).map((v) => `let ${v} = ${random(100)}`)
      return {
        instructions: `Add a semicolon to the end of every line. Record a macro into register a (qa), add one to this line and move down (A;<Esc>j), stop recording (q), then play it for the other ${n - 1} lines (${n - 1}@a).`,
        start: lines.join('\n'),
        cursor: { line: 0, ch: 0 },
        goal: { text: lines.map((l) => l + ';').join('\n') },
        ...known({ keys: 'qa' }, { keys: 'A', insert: ';' }, { keys: 'j' }, { keys: 'q' }, { keys: `${n - 1}@a` }),
      }
    },
  },
  {
    id: '+',
    title: 'Line starts',
    source: ':help +',
    set: 'complete',
    keys: ['+', '-', 'Enter'],
    make() {
      const lines = pick(SNIPPETS)
      const k = 2 + random(Math.min(3, lines.length - 3))
      const down = Math.random() < 0.5
      const from = down ? random(lines.length - k) : k + random(lines.length - k)
      const to = down ? from + k : from - k
      return {
        instructions: down
          ? `Move to the first non-blank character ${k} lines down (${k}+). Enter does the same as + (<CR>).`
          : `Move to the first non-blank character ${k} lines up (${k}-).`,
        start: lines.join('\n'),
        cursor: { line: from, ch: lines[from].length - 1 },
        goal: { cursor: { line: to, ch: lines[to].search(/\S/) } },
        par: 2,
      }
    },
  },
]
