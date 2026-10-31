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

export function explainStep(step: Step): string {
  const match = step.keys.match(/^([1-9]?)(.+)$/)
  if (!match) return ''
  const counted = match[1] !== ''
  const n = counted ? Number(match[1]) : 1
  const rest = match[2]

  if (rest in INSERTS) {
    const what = INSERTS[rest]
    return `${counted && rest === 'cc' ? `Clear ${n} lines` : what}${typing(step)}.`
  }
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

  // Operator + motion: d{motion} or c{motion}, with an optional count on
  // the motion (d2w).
  const op = rest.match(/^([dc])([1-9]?)(.+)$/)
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
    // c deletes like d, then starts Insert mode (described by typing()).
    return `Delete ${what}${typing(step)}.`
  }

  const dest = destination(rest, n, counted)
  return dest ? `Move ${dest}.` : ''
}
