// Plain-English explanations of solver steps, e.g. "4l" -> "Move 4
// characters to the right."
import type { Step } from './solver.ts'

// Show typed spaces and line breaks, which are otherwise invisible.
export const visible = (text: string) => text.replaceAll(' ', '␣').replaceAll('\n', '⏎')

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function ordinal(n: number) {
  const suffix = n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'
  return n + (n >= 11 && n <= 13 ? 'th' : suffix)
}

const quoteChar = (c: string) => (c === ' ' ? 'space' : `"${c}"`)

const LINEWISE = new Set(['j', 'k', '+', '-', 'G', 'gg'])

// Where a motion goes, worded to follow "Move" or "from the cursor".
function destination(motion: string, n: number, counted: boolean): string | null {
  const kind = /^[WEB]$/.test(motion) ? 'WORD' : 'word'
  const c = motion.slice(1)
  switch (motion[0]) {
    case 'h':
      return `${plural(n, 'character')} to the left`
    case 'l':
      return `${plural(n, 'character')} to the right`
    case 'j':
      return n === 1 ? 'down a line' : `down ${n} lines`
    case 'k':
      return n === 1 ? 'up a line' : `up ${n} lines`
    case '+':
      return n === 1
        ? 'to the start of the next line'
        : `to the start of the line ${n} lines down`
    case '-':
      return n === 1
        ? 'to the start of the previous line'
        : `to the start of the line ${n} lines up`
    case 'w':
    case 'W':
      return n === 1
        ? `to the start of the next ${kind}`
        : `to the start of the ${ordinal(n)} ${kind} ahead`
    case 'e':
    case 'E':
      return n === 1 ? `to the end of the ${kind}` : `to the end of the ${ordinal(n)} ${kind} ahead`
    case 'b':
    case 'B':
      return n === 1
        ? `back to the start of the ${kind}`
        : `back to the start of the ${ordinal(n)} ${kind} behind`
    case '0':
      return 'to the very start of the line'
    case '^':
      return 'to the first non-blank character of the line'
    case '$':
      return 'to the end of the line'
    case 'G':
      return counted ? `to line ${n}` : 'to the last line'
    case 'g':
      return motion === 'gg' ? 'to the first line' : null
    case '%':
      return 'to the matching bracket'
    case '}':
      return n === 1
        ? 'forward to the blank line after this paragraph'
        : `forward ${n} paragraphs, to a blank line`
    case '{':
      return n === 1
        ? 'back to the blank line before this paragraph'
        : `back ${n} paragraphs, to a blank line`
    case 'f':
      return n === 1 ? `to the next ${quoteChar(c)}` : `to the ${ordinal(n)} ${quoteChar(c)} ahead`
    case 't':
      return n === 1
        ? `to just before the next ${quoteChar(c)}`
        : `to just before the ${ordinal(n)} ${quoteChar(c)} ahead`
    case 'F':
      return n === 1
        ? `back to the previous ${quoteChar(c)}`
        : `back to the ${ordinal(n)} ${quoteChar(c)} behind`
    case 'T':
      return n === 1
        ? `back to just after the previous ${quoteChar(c)}`
        : `back to just after the ${ordinal(n)} ${quoteChar(c)} behind`
    default:
      return null
  }
}

// "Delete this line and ..." for operators over whole lines.
function lineRange(motion: string, n: number, counted: boolean): string {
  switch (motion) {
    case 'j':
    case '+':
      return n === 1 ? 'this line and the one below' : `this line and the ${n} below`
    case 'k':
    case '-':
      return n === 1 ? 'this line and the one above' : `this line and the ${n} above`
    case 'G':
      return counted ? `every line from here to line ${n}` : 'every line from here to the last'
    default:
      return 'every line from here to the first'
  }
}

// What the Insert-mode part of a step does.
function typing(step: Step) {
  if (step.insert === undefined) return ''
  const typed = step.insert ? `, type "${visible(step.insert)}"` : ''
  return `${typed}, then press Esc to go back to Normal mode`
}

const INSERTS: Record<string, string> = {
  i: 'Insert before the cursor',
  a: 'Append after the cursor',
  A: 'Append at the end of the line',
  I: 'Insert at the start of the line',
  o: 'Open a new line below',
  O: 'Open a new line above',
  S: 'Clear the whole line',
  cc: 'Clear the whole line',
  C: 'Delete to the end of the line',
}

// Commands with a fixed meaning, worded for a count of 1 and of n.
const SIMPLE: Record<string, [string, (n: number) => string]> = {
  u: ['Undo the last change.', (n) => `Undo the last ${n} changes.`],
  '<C-r>': ['Redo the change that was undone.', (n) => `Redo ${n} undone changes.`],
  p: [
    'Put (paste) the copied or deleted text after the cursor. Whole lines go below this one.',
    (n) => `Put ${n} copies after the cursor.`,
  ],
  P: [
    'Put (paste) the copied or deleted text before the cursor. Whole lines go above this one.',
    (n) => `Put ${n} copies before the cursor.`,
  ],
  yy: ['Copy (yank) the whole line.', (n) => `Copy ${n} lines, starting with this one.`],
  J: ['Join the line below onto the end of this one.', (n) => `Join ${n} lines into one.`],
  '>>': ['Indent this line.', (n) => `Indent ${n} lines, starting with this one.`],
  '<<': ['Unindent this line.', (n) => `Unindent ${n} lines, starting with this one.`],
  '~': [
    'Switch the case of the character under the cursor, then move right.',
    (n) => `Switch the case of ${n} characters, starting under the cursor.`,
  ],
  '.': ['Repeat the last change.', (n) => `Repeat the last change, with a count of ${n}.`],
  '*': ['Search forward for the word under the cursor.', (n) => `Jump to the ${ordinal(n)} match of the word under the cursor.`],
  '#': ['Search backward for the word under the cursor.', (n) => `Jump back to the ${ordinal(n)} match of the word under the cursor.`],
  n: ['Jump to the next match of the search.', (n) => `Jump ahead ${n} matches of the search.`],
  N: ['Jump to the previous match of the search.', (n) => `Jump back ${n} matches of the search.`],
  ';': ['Repeat the last f, t, F or T jump.', (n) => `Repeat the last f, t, F or T jump ${n} times.`],
  ',': ['Repeat the last f, t, F or T jump the other way.', (n) => `Repeat the last f, t, F or T jump the other way ${n} times.`],
  q: ['Stop recording the macro.', () => 'Stop recording the macro.'],
}

// What each operator does to the text it covers. c deletes like d, then
// starts Insert mode (described by typing()).
const OPERATORS: Record<string, string> = {
  d: 'Delete',
  c: 'Delete',
  y: 'Copy (yank)',
  gU: 'Uppercase',
  gu: 'Lowercase',
  'g~': 'Switch the case of',
}

// Commands that take a register or mark letter, or a typed pattern.
function special(rest: string, n: number, step: Step): string | null {
  let m: RegExpMatchArray | null
  if ((m = rest.match(/^r(.)$/))) return `Replace the character under the cursor with ${quoteChar(m[1])}.`
  if (rest === 'R') {
    return `Enter Replace mode, type "${visible(step.insert ?? '')}" over the old text, then press Esc to go back to Normal mode.`
  }
  if ((m = rest.match(/^"([a-z])([pP])$/))) {
    return `Put the text saved in register ${m[1]} ${m[2] === 'p' ? 'after the cursor (below this line for whole lines)' : 'before the cursor (above this line for whole lines)'}.`
  }
  if ((m = rest.match(/^q([a-z])$/))) return `Start recording a macro into register ${m[1]}.`
  if ((m = rest.match(/^@([a-z])$/))) {
    return `Play the macro in register ${m[1]}${n > 1 ? `, ${n} times` : ''}.`
  }
  if ((m = rest.match(/^m([a-z])$/))) return `Set mark ${m[1]} at the cursor.`
  if ((m = rest.match(/^`([a-z])$/))) return `Jump to mark ${m[1]}.`
  if ((m = rest.match(/^'([a-z])$/))) return `Jump to the first non-blank character on mark ${m[1]}'s line.`
  if ((m = rest.match(/^([/?])(.+)<CR>$/))) {
    return `Search ${m[1] === '/' ? 'forward' : 'backward'} for "${m[2]}" and jump to the first match.`
  }
  if ((m = rest.match(/^:(%?)s\/([^/]*)\/([^/]*)(\/g)?<CR>$/))) {
    const [, all, from, to, global] = m
    if (global) return `Replace every "${from}" with "${to}" ${all ? 'in the whole file' : 'on this line'}.`
    return `${all ? 'On every line, replace' : 'Replace'} the first "${from}" with "${to}".`
  }
  return null
}

export function explainStep(step: Step): string {
  const match = step.keys.match(/^([1-9]\d*)?(.+)$/)
  if (!match) return ''
  const counted = match[1] !== undefined
  const n = counted ? Number(match[1]) : 1
  const rest = match[2]

  if (rest in INSERTS) {
    const what = INSERTS[rest]
    return `${counted && rest === 'cc' ? `Clear ${n} lines` : what}${typing(step)}.`
  }
  if (rest in SIMPLE) {
    const [one, many] = SIMPLE[rest]
    return n === 1 ? one : many(n)
  }
  const described = special(rest, n, step)
  if (described) return described
  switch (rest) {
    case 'x':
      return n === 1
        ? 'Delete the character under the cursor.'
        : `Delete ${n} characters, starting under the cursor.`
    case 'X':
      return n === 1
        ? 'Delete the character before the cursor.'
        : `Delete the ${n} characters before the cursor.`
    case 's':
      return `Delete ${n === 1 ? 'the character under the cursor' : `${n} characters`}${typing(step)}.`
    case 'D':
      return 'Delete from the cursor to the end of the line.'
    case 'dd':
      return n === 1
        ? 'Delete the whole line.'
        : `Delete ${n} whole lines, starting with this one.`
  }

  // Operator + motion: d{motion}, c{motion}, y{motion} or gU{motion}, with
  // an optional count on the motion (d2w).
  const op = rest.match(/^([dcy]|gU|gu|g~)([1-9]?)(.+)$/)
  if (op && !counted) {
    const [, operator, motionCount, motion] = op
    const m = motionCount ? Number(motionCount) : 1
    let what: string | null
    if (motion === 'h') {
      what = m === 1 ? 'the character before the cursor' : `the ${m} characters before the cursor`
    } else if (motion === 'l') {
      what = m === 1 ? 'the character under the cursor' : `${m} characters, starting under the cursor`
    } else if (operator === 'c' && (motion === 'w' || motion === 'W')) {
      // cw changes to the end of the word, like ce.
      what = `from the cursor ${destination(motion === 'w' ? 'e' : 'E', m, false)}`
    } else if (LINEWISE.has(motion)) {
      what = lineRange(motion, m, motionCount !== '')
    } else {
      const dest = destination(motion, m, motionCount !== '')
      what = dest && `from the cursor ${dest}`
    }
    if (!what) return ''
    return `${OPERATORS[operator]} ${what}${typing(step)}.`
  }

  const dest = destination(rest, n, counted)
  return dest ? `Move ${dest}.` : ''
}
